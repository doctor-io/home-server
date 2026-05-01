# Authentication And Sessions

## Purpose

Homeio is currently single-user. Authentication uses a username/password account, scrypt password hashing, and an HMAC-SHA256 signed session token stored in the `homeio_session` HTTP-only cookie.

## Locations

- Server-side: `lib/server/modules/auth/`
- Client-side: `components/auth/`, `hooks/useCurrentUser.ts`, login/register pages under `app/`
- Routes: `app/api/auth/`

## Key Files

| File | Role |
|---|---|
| `lib/server/modules/auth/service.ts` | Register, login, logout, authenticate, unlock |
| `lib/server/modules/auth/session-token.ts` | HMAC token creation and verification |
| `lib/server/modules/auth/password.ts` | scrypt hashing and verification |
| `lib/server/modules/auth/cookies.ts` | Cookie name and cookie options |
| `lib/server/modules/auth/repository.ts` | `users` and `sessions` queries |
| `lib/server/modules/auth/api.ts` | Shared `requireApiSession()` helper for protected API routes |
| `lib/server/modules/auth/rate-limit.ts` | In-memory failed-login limiter |
| `app/api/auth/login/route.ts` | Login endpoint |
| `app/api/auth/me/route.ts` | Current session endpoint |

## Public API

- `registerUser()`
- `loginUser()`
- `logoutSession()`
- `authenticateSession()`
- `requireApiSession()`
- `verifyUnlockPassword()`
- `createSessionToken()`
- `parseSessionToken()`

## Contracts

- `lib/shared/auth/session.ts`

## Database Tables

- `users`
- `sessions`

## API Routes Owned

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `GET /api/auth/status`
- `POST /api/auth/unlock`

## Known Issues

- Login rate limiting is in-memory only: 5 failures per 15 minutes per normalized username/client IP.
- No central auth middleware; protected `/api/v1/**` routes must call `requireApiSession()` and are checked by `app/api/v1/__tests__/auth-architecture.test.ts`.
- The audit notes `passwordHash` circulates in authenticated session lookup results.
- Development/test session secret defaults are allowed, but production startup rejects known defaults and secrets shorter than 32 characters.

## How To Extend

To add a protected auth-adjacent feature:

1. Add types to `lib/shared/auth/session.ts` or a new contract file.
2. Add service code in `lib/server/modules/auth/`.
3. Add repository functions if user/session persistence changes.
4. Add route code under `app/api/auth/` or protected `/api/v1/**`.
5. Call `requireApiSession()` in protected `/api/v1/**` route handlers.
6. Add route and service tests.
