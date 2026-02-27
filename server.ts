import { createServer } from "node:http";
import next from "next";
import { parse } from "node:url";

const dev = process.env.NODE_ENV !== "production";
const hostname =
  process.env.HOMEIO_HTTP_HOST || (dev ? "localhost" : "127.0.0.1");
const port = parseInt(process.env.HOMEIO_HTTP_PORT || process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const shutdownHooks: Array<() => Promise<unknown> | unknown> = [];
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      await handle(req, res, parsedUrl);
    } catch (error) {
      console.error("Error occurred handling", req.url, error);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize WebSocket server for terminal (optional feature).
  // This gracefully fails if node-pty is not available.
  void import("./lib/server/modules/terminal/websocket-server")
    .then((module) => {
      module.initializeWebSocketServer(server);
      console.log("✓ Terminal WebSocket server initialized");
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("⚠ Terminal feature not available:", message);
      console.log("  The application will work without terminal functionality");
      console.log("  To enable terminal, run: npm install @lydell/node-pty");
    });

  // Network storage watcher starts from files API route modules.
  // Avoid eager server-level import here to keep startup runtime-only.

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`> Received ${signal}, shutting down...`);

    await Promise.allSettled(
      shutdownHooks.map(async (hook) => {
        try {
          await hook();
        } catch (error) {
          console.error("Shutdown hook failed", error);
        }
      }),
    );

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });

    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  server.listen(port, hostname, (error?: Error) => {
    if (error) throw error;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
