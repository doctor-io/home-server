class HelperServiceError extends Error {
  constructor(message, options = {}) {
    super(message, {
      cause: options.cause,
    });
    this.name = "HelperServiceError";
    this.code = options.code ?? "internal_error";
    this.statusCode = options.statusCode ?? 500;
  }
}

function toCodeFromError(error) {
  if (error instanceof HelperServiceError) return error;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("org.freedesktop.networkmanager") ||
      message.includes("networkmanager") ||
      message.includes("serviceunknown")
    ) {
      return new HelperServiceError("NetworkManager is unavailable", {
        code: "network_manager_unavailable",
        statusCode: 503,
        cause: error,
      });
    }

    if (
      message.includes("secrets") ||
      message.includes("invalid password") ||
      message.includes("authentication") ||
      message.includes("802-11-wireless-security")
    ) {
      return new HelperServiceError("Wi-Fi authentication failed", {
        code: "auth_failed",
        statusCode: 401,
        cause: error,
      });
    }
  }

  return new HelperServiceError(
    error instanceof Error ? error.message : "Unknown helper error",
    {
      code: "internal_error",
      statusCode: 500,
      cause: error,
    },
  );
}

export { HelperServiceError, toCodeFromError };
