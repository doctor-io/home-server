import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocketServer, WebSocket } from "ws";
import pty from "@lydell/node-pty";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { parse } from "node:url";
import { serverEnv } from "@/lib/server/env";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";

interface ResizeMessage {
  type: "resize";
  cols?: number;
  rows?: number;
}

interface AttachMessage {
  type: "attach";
  target?: string;
  sessionId?: string;
}

interface InputMessage {
  type: "input";
  data: string;
}

interface PingMessage {
  type: "ping";
}

type TerminalMessage = ResizeMessage | AttachMessage | InputMessage | PingMessage;

type AuthenticatedSession = {
  userId: string;
  username: string;
  sessionId: string;
};

type TerminalUpgradeRequest = IncomingMessage & {
  terminalSession?: AuthenticatedSession | null;
};

const activeTerminalSessionIdsByUser = new Map<string, Set<string>>();

function parseCookies(headerValue: string | undefined) {
  if (!headerValue) return {} as Record<string, string>;
  const parsed: Record<string, string> = {};
  for (const segment of headerValue.split(";")) {
    const [rawKey, ...rawValueParts] = segment.split("=");
    const key = rawKey?.trim();
    if (!key) continue;
    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) continue;
    try {
      parsed[key] = decodeURIComponent(rawValue);
    } catch {
      parsed[key] = rawValue;
    }
  }
  return parsed;
}

function closeUpgradeSocket(socket: Duplex, statusCode: number, message: string) {
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({
      error: message,
    })}`,
  );
  socket.destroy();
}

function sendWsErrorAndClose(ws: WebSocket, code: number, errorCode: string, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "error",
        code: errorCode,
        message,
      }),
    );
  }
  ws.close(code, message.slice(0, 120));
}

function registerActiveSession(userId: string, sessionId: string) {
  const set = activeTerminalSessionIdsByUser.get(userId) ?? new Set<string>();
  if (set.size >= serverEnv.TERMINAL_MAX_SESSIONS_PER_USER) {
    return false;
  }
  set.add(sessionId);
  activeTerminalSessionIdsByUser.set(userId, set);
  return true;
}

function unregisterActiveSession(userId: string, sessionId: string) {
  const set = activeTerminalSessionIdsByUser.get(userId);
  if (!set) return;
  set.delete(sessionId);
  if (set.size === 0) {
    activeTerminalSessionIdsByUser.delete(userId);
  }
}

function isControlMessage(value: unknown): value is TerminalMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as { type?: string };
  return record.type === "resize" ||
    record.type === "attach" ||
    record.type === "input" ||
    record.type === "ping";
}

/**
 * Initialize WebSocket server for terminal functionality
 * @param server - HTTP server instance
 */
export function initializeWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, request: TerminalUpgradeRequest) => {
    let ptyProcess: pty.IPty | null = null;
    let targetContainer: string | null = null;
    let closed = false;
    let idleTimer: NodeJS.Timeout | null = null;
    let lifetimeTimer: NodeJS.Timeout | null = null;
    const terminalSessionId = randomUUID();
    const authSession = request.terminalSession ?? null;

    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    const cwd = process.env.HOME || process.cwd();

    if (serverEnv.TERMINAL_WS_REQUIRE_AUTH && !authSession) {
      sendWsErrorAndClose(ws, 4401, "unauthorized", "Unauthorized");
      return;
    }

    if (authSession && !registerActiveSession(authSession.userId, terminalSessionId)) {
      sendWsErrorAndClose(
        ws,
        4408,
        "session_limit_reached",
        "Too many active terminal sessions for this user",
      );
      return;
    }

    const resetIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        sendWsErrorAndClose(ws, 4000, "session_idle_timeout", "Terminal session timed out");
      }, serverEnv.TERMINAL_IDLE_TIMEOUT_MS);
      idleTimer.unref?.();
    };

    const clearTimers = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (lifetimeTimer) {
        clearTimeout(lifetimeTimer);
        lifetimeTimer = null;
      }
    };

    const killPty = () => {
      if (!ptyProcess) return;
      try {
        ptyProcess.kill();
      } catch {
        // ignored
      } finally {
        ptyProcess = null;
      }
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimers();
      killPty();
      if (authSession) {
        unregisterActiveSession(authSession.userId, terminalSessionId);
      }
    };

    lifetimeTimer = setTimeout(() => {
      sendWsErrorAndClose(ws, 4001, "session_max_lifetime", "Terminal max session lifetime reached");
    }, serverEnv.TERMINAL_MAX_SESSION_MS);
    lifetimeTimer.unref?.();
    resetIdleTimer();

    const attachPty = (
      nextPty: pty.IPty,
      onExit: (exitCode: { exitCode: number; signal?: number }) => void,
    ) => {
      ptyProcess = nextPty;

      nextPty.onData((data: string) => {
        if (ptyProcess !== nextPty) return;
        resetIdleTimer();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      nextPty.onExit((exitCode: { exitCode: number; signal?: number }) => {
        if (ptyProcess !== nextPty) return;
        onExit(exitCode);
      });
    };

    // Create PTY for host shell
    const createHostPty = (): void => {
      try {
        const nextPty = pty.spawn(shell, [], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as { [key: string]: string },
        });

        attachPty(nextPty, () => {
          if (closed) return;
          ws.close();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to create PTY:", error);
        ws.send(`\r\n\x1b[1;31mFailed to create terminal: ${message}\x1b[0m\r\n`);
        ws.close();
      }
    };

    const createDockerPty = (container: string, shellBin: "bash" | "sh"): void => {
      try {
        const nextPty = pty.spawn("docker", ["exec", "-it", container, shellBin], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as { [key: string]: string },
        });

        attachPty(nextPty, (exitCode: { exitCode: number; signal?: number }) => {
          if (closed) return;
          if (exitCode.exitCode !== 0 && shellBin === "bash" && targetContainer) {
            createDockerPty(targetContainer, "sh");
            return;
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send("\r\n\x1b[1;33mContainer session ended\x1b[0m\r\n");
          }
          targetContainer = null;
          createHostPty();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to create Docker PTY:", error);
        ws.send(`\r\n\x1b[1;31mFailed to attach to container: ${message}\x1b[0m\r\n`);
        targetContainer = null;
        createHostPty();
      }
    };

    // Initialize with host shell
    createHostPty();

    // Handle WebSocket messages
    ws.on("message", (data: Buffer | string) => {
      resetIdleTimer();
      const message = data.toString();

      try {
        // Try to parse as JSON for control messages
        const parsed = JSON.parse(message) as unknown;
        if (!isControlMessage(parsed)) {
          if (ptyProcess) {
            ptyProcess.write(message);
          }
          return;
        }

        if (parsed.type === "resize" && ptyProcess) {
          ptyProcess.resize(parsed.cols || 80, parsed.rows || 24);
          return;
        }

        if (parsed.type === "ping") {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "pong" }));
          }
          return;
        }

        if (parsed.type === "input") {
          if (ptyProcess) {
            ptyProcess.write(parsed.data ?? "");
          }
          return;
        }

        if (parsed.type === "attach" && parsed.target) {
          // Switch to docker container
          killPty();
          targetContainer = parsed.target;
          createDockerPty(parsed.target, "bash");
          return;
        }
      } catch {
        // Not JSON, treat as terminal input
        if (ptyProcess) {
          ptyProcess.write(message);
        }
      }
    });

    ws.on("close", () => {
      cleanup();
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      cleanup();
    });
  });

  // Handle upgrade for WebSocket
  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = parse(request.url || "");

    if (pathname !== "/api/terminal") return;

    void (async () => {
      let terminalSession: AuthenticatedSession | null = null;

      if (serverEnv.TERMINAL_WS_REQUIRE_AUTH) {
        const cookies = parseCookies(request.headers.cookie);
        const sessionToken = cookies[getAuthCookieName()] ?? null;
        const session = await authenticateSession(sessionToken);
        if (!session) {
          closeUpgradeSocket(socket, 401, "Unauthorized");
          return;
        }
        terminalSession = {
          userId: session.userId,
          username: session.username,
          sessionId: session.sessionId,
        };
      }

      const terminalRequest = request as TerminalUpgradeRequest;
      terminalRequest.terminalSession = terminalSession;

      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, terminalRequest);
      });
    })().catch(() => {
      closeUpgradeSocket(socket, 500, "Internal Server Error");
    });
  });
}
