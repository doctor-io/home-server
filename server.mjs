import { createServer } from "http";
import next from "next";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOMEIO_HTTP_HOST || (dev ? "localhost" : "127.0.0.1");
const port = parseInt(
  process.env.HOMEIO_HTTP_PORT || process.env.PORT || "3000",
  10,
);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const shutdownHooks = [];
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize WebSocket server for terminal (optional feature)
  // This will gracefully fail if node-pty is not available
  import("./lib/server/modules/terminal/websocket-server.js")
    .then((module) => {
      module.initializeWebSocketServer(server);
      console.log("✓ Terminal WebSocket server initialized");
    })
    .catch((err) => {
      console.warn("⚠ Terminal feature not available:", err.message);
      console.log("  The application will work without terminal functionality");
      console.log(
        "  To enable terminal, run: npm install @lydell/node-pty",
      );
    });

  import("./lib/server/modules/files/network-storage.ts")
    .then((module) => {
      if (typeof module.startNetworkStorageWatcher === "function") {
        module.startNetworkStorageWatcher();
      }
      if (typeof module.stopNetworkStorageWatcher === "function") {
        shutdownHooks.push(() => module.stopNetworkStorageWatcher());
      }
      console.log("✓ Files network storage watcher initialized");
    })
    .catch((err) => {
      console.warn("⚠ Files network storage watcher not available:", err.message);
    });

  let shuttingDown = false;
  const shutdown = async (signal) => {
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

    await new Promise((resolve) => {
      server.close(() => {
        resolve(undefined);
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

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
