const ALLOWED_METHODS = new Set([
  "network.getStatus",
  "network.scan",
  "network.connect",
  "network.disconnect",
]);

class HelperProtocolError extends Error {
  constructor(message, options = {}) {
    super(message, {
      cause: options.cause,
    });
    this.name = "HelperProtocolError";
    this.code = options.code ?? "invalid_request";
    this.statusCode = options.statusCode ?? 400;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asOptionalString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateConnectParams(params) {
  if (!isRecord(params)) {
    throw new HelperProtocolError("Invalid connect parameters");
  }

  const ssid = asOptionalString(params.ssid);
  if (!ssid || ssid.length > 128) {
    throw new HelperProtocolError("Invalid ssid");
  }

  const password = params.password;
  if (password !== undefined && (typeof password !== "string" || password.length < 1 || password.length > 128)) {
    throw new HelperProtocolError("Invalid password");
  }

  return {
    ssid,
    password,
  };
}

function validateDisconnectParams(params) {
  if (params === undefined || params === null) {
    return {};
  }

  if (!isRecord(params)) {
    throw new HelperProtocolError("Invalid disconnect parameters");
  }

  const iface = asOptionalString(params.iface);
  if (params.iface !== undefined && (!iface || iface.length > 64)) {
    throw new HelperProtocolError("Invalid iface");
  }

  return iface ? { iface } : {};
}

function validateMethodParams(method, params) {
  if (method === "network.getStatus" || method === "network.scan") {
    return {};
  }

  if (method === "network.connect") {
    return validateConnectParams(params);
  }

  if (method === "network.disconnect") {
    return validateDisconnectParams(params);
  }

  throw new HelperProtocolError("Method not allowed");
}

function parseRpcRequest(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new HelperProtocolError("Invalid JSON request");
  }

  if (!isRecord(parsed)) {
    throw new HelperProtocolError("Request payload must be an object");
  }

  const id = asOptionalString(parsed.id);
  const method = asOptionalString(parsed.method);
  const requestId = asOptionalString(parsed.requestId);

  if (!id || id.length > 128) {
    throw new HelperProtocolError("Missing or invalid request id");
  }

  if (!method || !ALLOWED_METHODS.has(method)) {
    throw new HelperProtocolError("Method not allowed");
  }

  return {
    id,
    method,
    requestId,
    params: validateMethodParams(method, parsed.params),
  };
}

function toErrorPayload(error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof HelperProtocolError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: "internal_error",
      message: error.message,
    };
  }

  return {
    code: "internal_error",
    message: "Unknown error",
  };
}

export { ALLOWED_METHODS, HelperProtocolError, parseRpcRequest, toErrorPayload };
