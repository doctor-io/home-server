import "server-only";

import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/server/env";
import {
  createSession,
  createUser,
  deleteSessionById,
  findSessionWithUser,
  findUserByUsername,
} from "@/lib/server/modules/auth/repository";
import { hashPassword, verifyPassword } from "@/lib/server/modules/auth/password";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/server/modules/auth/session-token";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function validateUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9_-]{3,32}$/.test(normalized)) {
    throw new AuthError(
      "Username must be 3-32 chars and use only lowercase letters, numbers, underscore, or dash",
      400,
    );
  }

  return normalized;
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw new AuthError("Password must be at least 8 characters", 400);
  }
}

function getSessionExpiryDate() {
  return new Date(Date.now() + serverEnv.AUTH_SESSION_HOURS * 60 * 60 * 1000);
}

export async function registerUser(params: {
  username: string;
  password: string;
  confirmPassword: string;
}) {
  const username = validateUsername(params.username);
  validatePassword(params.password);

  if (params.password !== params.confirmPassword) {
    throw new AuthError("Password confirmation does not match", 400);
  }

  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    throw new AuthError("Username is already registered", 409);
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(params.password);

  await createUser({
    id: userId,
    username,
    passwordHash,
  });

  return {
    id: userId,
    username,
  };
}

export async function loginUser(params: {
  username: string;
  password: string;
}) {
  const username = normalizeUsername(params.username);

  const user = await findUserByUsername(username);

  if (!user) {
    throw new AuthError("Invalid username or password", 401);
  }

  const isPasswordValid = await verifyPassword(params.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AuthError("Invalid username or password", 401);
  }

  const expiresAt = getSessionExpiryDate();
  const sessionId = randomUUID();

  await createSession({
    id: sessionId,
    userId: user.id,
    expiresAt,
  });

  const token = createSessionToken(
    sessionId,
    Math.floor(expiresAt.getTime() / 1000),
  );

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      username: user.username,
    },
  };
}

export async function logoutSession(sessionToken: string | null | undefined) {
  if (!sessionToken) return;

  const verified = verifySessionToken(sessionToken);
  if (!verified) return;

  await deleteSessionById(verified.sessionId);
}

export async function authenticateSession(sessionToken: string | null | undefined) {
  if (!sessionToken) return null;

  const verified = verifySessionToken(sessionToken);
  if (!verified) return null;

  const session = await findSessionWithUser(verified.sessionId);
  if (!session) return null;

  return {
    sessionId: session.sessionId,
    userId: session.userId,
    username: session.username,
    passwordHash: session.passwordHash,
    expiresAt: session.expiresAt,
  };
}

export async function verifyUnlockPassword(params: {
  sessionToken: string | null | undefined;
  password: string;
}) {
  const session = await authenticateSession(params.sessionToken);
  if (!session) {
    throw new AuthError("Unauthorized", 401);
  }

  const isPasswordValid = await verifyPassword(
    params.password,
    session.passwordHash,
  );

  if (!isPasswordValid) {
    throw new AuthError("Invalid password", 401);
  }

  return {
    userId: session.userId,
    username: session.username,
  };
}
