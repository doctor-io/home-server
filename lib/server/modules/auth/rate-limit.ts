import "server-only";

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;

type LoginAttemptRecord = {
  failures: number;
  resetAt: number;
};

const loginAttempts = new Map<string, LoginAttemptRecord>();

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function getLoginRateLimitKey(request: Request, username: string) {
  return `${normalizeUsername(username)}:${getClientIp(request)}`;
}

export function isLoginRateLimited(key: string, now = Date.now()) {
  const record = loginAttempts.get(key);
  if (!record) return false;

  if (record.resetAt <= now) {
    loginAttempts.delete(key);
    return false;
  }

  return record.failures >= LOGIN_RATE_LIMIT_MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()) {
  const existing = loginAttempts.get(key);
  if (!existing || existing.resetAt <= now) {
    loginAttempts.set(key, {
      failures: 1,
      resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  existing.failures += 1;
}

export function clearLoginFailures(key: string) {
  loginAttempts.delete(key);
}

export function _resetLoginRateLimitForTesting() {
  loginAttempts.clear();
}
