import type { Server as HttpServer } from "node:http";

type ClosableHttpServer = Pick<HttpServer, "close"> &
  Partial<Pick<HttpServer, "closeIdleConnections" | "closeAllConnections">>;

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 8_000;

export async function closeServerGracefully(
  server: ClosableHttpServer,
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
) {
  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve();
    };

    const timeoutHandle = setTimeout(() => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      finish();
    }, timeoutMs);

    server.close(() => {
      finish();
    });

    server.closeIdleConnections?.();
  });
}
