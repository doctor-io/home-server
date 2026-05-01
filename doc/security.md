# Security

## Threat Model

Homeio is designed for a trusted LAN or a protected reverse-proxy deployment. It manages high-privilege host surfaces: Docker, files under `FILES_ROOT`, D-Bus network/power/storage actions, and terminal access. It is not currently hardened as an internet-facing multi-user service.

Defended:

- Session cookie tampering through HMAC-SHA256 signatures.
- Password disclosure through scrypt password hashing.
- File traversal outside `FILES_ROOT` through `resolvePathWithinFilesRoot()`.
- PTY environment leakage through a terminal env allowlist.

Not fully defended:

- Brute force login attempts.
- Centralized authorization for all `/api/v1/**` routes.
- Exposure of Docker socket capabilities.

## Auth Mechanism

`lib/server/modules/auth/session-token.ts` signs `{sessionId}.{expiresAtEpochSeconds}` with HMAC-SHA256 using `AUTH_SESSION_SECRET`. The token is stored in the `homeio_session` cookie from `lib/server/modules/auth/cookies.ts` with `httpOnly` and `sameSite: lax`; the `Secure` flag depends on HTTPS request context.

Passwords are hashed in `lib/server/modules/auth/password.ts` using Node `crypto.scrypt` with a random salt. scrypt is a valid KDF, but argon2 is more common for new web password storage. The custom session format is simpler than JWT/PASETO and avoids token claims, but it is non-standard and relies on a strong `AUTH_SESSION_SECRET`.

## Path Jailing

`lib/server/modules/files/path-resolver.ts` exports `resolvePathWithinFilesRoot()`. File operations should pass all user-provided paths through this resolver before touching the filesystem. The file manager service maps `FilesPathError` to `FileServiceError`.

## Docker Socket Risk

`docker-compose.yml` mounts `/var/run/docker.sock`. Access to the Docker socket is effectively host-root equivalent in many deployments. Any route or bug that can trigger arbitrary Docker commands is high severity.

## D-Bus Privilege Model

Network and USB features use `services/dbus-helper/` over `DBUS_HELPER_SOCKET_PATH`. The sidecar talks to NetworkManager and udisks2 through D-Bus. It is a separate privilege boundary and must be tested separately when changed.

## Known Gaps

| Gap | Severity | Exploit scenario | Status |
|---|---:|---|---|
| Missing middleware-level auth | Medium | A future route could bypass auth if it is outside the architecture test scope | Mitigated by `requireApiSession()` and architecture test |
| Login rate limiting is in-memory | Medium | Distributed deployments would not share brute-force counters across processes | Mitigated for single-process installs |
| Default `AUTH_SESSION_SECRET` in examples | High | Users who do not change it risk forged session tokens | Open; documented in README |
| Docker socket mounted | High | App compromise can become host compromise through Docker | Accepted deployment trade-off |
| WebSocket terminal is full shell | High | Authenticated terminal access is host shell access, not command allowlist | Open documentation gap |
| `passwordHash` returned from session lookup | Low | Hash circulates in memory unnecessarily | Open |
| `services/dbus-helper/` plain JS | Medium | Lower type safety for privileged sidecar protocol | Open |

## Mitigation Priorities

1. Move from per-route helper auth to middleware or generated route wrappers if feasible.
2. Consider persistent/distributed login rate limiting if Homeio ever runs multiple app processes.
3. Separate terminal UX/docs for allowlisted command execution vs full PTY.
4. Reduce Docker socket exposure where deployment topology allows it.
