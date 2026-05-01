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
| `app/api/auth/login/route.ts` | Login endpoint |
| `app/api/auth/me/route.ts` | Current session endpoint |

## Public API

- `registerUser()`
- `loginUser()`
- `logoutSession()`
- `authenticateSession()`
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

- No login rate limiting or account lockout.
- No central auth middleware; routes must call `authenticateSession()` manually.
- The audit notes `passwordHash` circulates in authenticated session lookup results.
- Default session secrets in examples are unsafe if not changed before exposure.

## How To Extend

To add a protected auth-adjacent feature:

1. Add types to `lib/shared/auth/session.ts` or a new contract file.
2. Add service code in `lib/server/modules/auth/`.
3. Add repository functions if user/session persistence changes.
4. Add route code under `app/api/auth/` or protected `/api/v1/**`.
5. Call `authenticateSession()` in route handlers that require a user.
6. Add route and service tests.
