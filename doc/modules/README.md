# Feature Modules

Homeio uses vertical feature modules for client UI and matching server modules for backend behavior.

| Module | Read when working on |
|---|---|
| [apps.md](./apps.md) | Installed apps, App Store, app lifecycle operations, container logs |
| [auth.md](./auth.md) | Login, registration, sessions, unlock flow |
| [docker.md](./docker.md) | Compose parsing/running, Docker stats, Docker maintenance |
| [files.md](./files.md) | File manager, uploads/downloads, trash, stars, SMB shares, USB, Google Drive |
| [mobile-app.md](./mobile-app.md) | Capacitor mobile app (`apps/mobile/`), Tailscale access, Connect flow |
| [network.md](./network.md) | WiFi/Ethernet, NetworkManager, D-Bus helper sidecar |
| [notifications.md](./notifications.md) | Persistent notifications and notification SSE |
| [shell.md](./shell.md) | Desktop shell, dock, windows, lock screen, terminal UI |
| [system.md](./system.md) | Metrics, updates, backups, power, disks, widgets |
| [tasks.md](./tasks.md) | Scheduled tasks and execution history |

Cross-cutting settings UI lives in `modules/settings/` and is documented in [../contributing.md](../contributing.md) and [../AGENTS.md](../AGENTS.md).
