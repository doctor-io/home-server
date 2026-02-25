import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocketServer, WebSocket } from "ws";
import pty from "node-pty";
import os from "node:os";
import { parse } from "node:url";

interface ResizeMessage {
  type: "resize";
  cols?: number;
  rows?: number;
}

interface AttachMessage {
  type: "attach";
  target: string;
}

type TerminalMessage = ResizeMessage | AttachMessage;

/**
 * Initialize WebSocket server for terminal functionality
 * @param server - HTTP server instance
 */
export function initializeWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    let ptyProcess: pty.IPty | null = null;
    let targetContainer: string | null = null;

    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    const cwd = process.env.HOME || process.cwd();

    // Create PTY for host shell
    const createHostPty = (): void => {
      try {
        ptyProcess = pty.spawn(shell, [], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as { [key: string]: string },
        });

        ptyProcess.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        ptyProcess.onExit(() => {
          ws.close();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to create PTY:", error);
        ws.send(`\r\n\x1b[1;31mFailed to create terminal: ${message}\x1b[0m\r\n`);
        ws.close();
      }
    };

    // Create PTY for docker container
    const createDockerPty = (container: string): void => {
      try {
        // Try bash first, fallback to sh
        ptyProcess = pty.spawn("docker", ["exec", "-it", container, "bash"], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as { [key: string]: string },
        });

        ptyProcess.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        ptyProcess.onExit((exitCode: { exitCode: number; signal?: number }) => {
          // If bash failed, try sh
          if (exitCode.exitCode !== 0 && targetContainer) {
            try {
              ptyProcess = pty.spawn("docker", ["exec", "-it", targetContainer, "sh"], {
                name: "xterm-256color",
                cols: 80,
                rows: 24,
                cwd,
                env: process.env as { [key: string]: string },
              });

              ptyProcess.onData((data: string) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(data);
                }
              });

              ptyProcess.onExit(() => {
                ws.send("\r\n\x1b[1;33mContainer session ended\x1b[0m\r\n");
                targetContainer = null;
                createHostPty();
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              ws.send(`\r\n\x1b[1;31mFailed to attach to container: ${message}\x1b[0m\r\n`);
              targetContainer = null;
              createHostPty();
            }
          } else {
            ws.send("\r\n\x1b[1;33mContainer session ended\x1b[0m\r\n");
            targetContainer = null;
            createHostPty();
          }
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
      const message = data.toString();

      try {
        // Try to parse as JSON for control messages
        const parsed = JSON.parse(message) as TerminalMessage;

        if (parsed.type === "resize" && ptyProcess) {
          ptyProcess.resize(parsed.cols || 80, parsed.rows || 24);
          return;
        }

        if (parsed.type === "attach" && parsed.target) {
          // Switch to docker container
          if (ptyProcess) {
            ptyProcess.kill();
          }
          targetContainer = parsed.target;
          createDockerPty(parsed.target);
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
      if (ptyProcess) {
        ptyProcess.kill();
      }
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      if (ptyProcess) {
        ptyProcess.kill();
      }
    });
  });

  // Handle upgrade for WebSocket
  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = parse(request.url || "");

    if (pathname === "/api/terminal") {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });
}
