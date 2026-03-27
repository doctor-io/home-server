import { DBUS_METHOD_TIMEOUT_MS } from "./config.mjs";
import { HelperServiceError } from "./errors.mjs";

function withTimeout(promise, timeoutMs = DBUS_METHOD_TIMEOUT_MS) {
  let timeoutHandle;
  return Promise.race([
    promise.finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }),
    new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new HelperServiceError("DBus operation timeout", {
            code: "timeout",
            statusCode: 504,
          }),
        );
      }, timeoutMs);
    }),
  ]);
}

export { withTimeout };
