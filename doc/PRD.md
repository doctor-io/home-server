# Product Requirements

## Vision

Homeio is a self-hosted home server dashboard with a desktop-style UI for managing Docker apps, files, terminal access, system resources, scheduled tasks, notifications, storage, and network status. It targets people running services at home who want a local-first alternative to CasaOS, Umbrel, and Portainer with a modern UI and direct host management.

## Personas

- Self-hosters who found CasaOS abandoned or not moving in the direction they need.
- Users who find Umbrel too restrictive for general Docker Compose app management.
- Home lab owners who want Docker apps, files, metrics, and settings in one browser UI.
- Raspberry Pi / mini-PC users who want a Debian/Ubuntu/Raspberry Pi OS install path.

## Non-Goals

From `README.md` and `ROADMAP.md`:

- Not a NAS OS replacement for TrueNAS, Unraid, or similar systems.
- Not a Kubernetes, Swarm, or cluster orchestrator.
- Not a cloud service or hosted account system.
- Not currently a multi-user/RBAC platform; that is roadmap work.
- Not currently a hardened internet-facing admin panel.

## Core Features

| Feature | Current documentation |
|---|---|
| Desktop shell, dock, windows, command palette, lock screen | [modules/shell.md](./modules/shell.md) |
| Docker app grid, App Store, app operations | [modules/apps.md](./modules/apps.md) |
| Docker Compose runner and Docker integration | [modules/docker.md](./modules/docker.md) |
| File manager, previews, editor, shares, USB, Google Drive | [modules/files.md](./modules/files.md) |
| Authentication and single-user sessions | [modules/auth.md](./modules/auth.md) |
| System metrics, disks, updates, backups, power | [modules/system.md](./modules/system.md) |
| Network manager with D-Bus helper | [modules/network.md](./modules/network.md) |
| Notifications | [modules/notifications.md](./modules/notifications.md) |
| Scheduled tasks | [modules/tasks.md](./modules/tasks.md) |
| Mobile app (Tailscale access) | [modules/mobile-app.md](./modules/mobile-app.md) |

## Roadmap Summary

The canonical roadmap is [../ROADMAP.md](../ROADMAP.md). As of the current repo docs, v1.6.x is the current release line for storage expansion and polish, including disk/partition management, server information, safer uploads, Google Drive integration, and shell visual polish. v2.0 is planned around multi-user access, API tokens, 2FA, audit logs, and a dedicated mobile app that reaches the server over Tailscale ([modules/mobile-app.md](./modules/mobile-app.md)).

Do not duplicate roadmap detail in module docs; link to `ROADMAP.md` and document only current code behavior.

## Success Metrics

Homeio is early-stage. Realistic success metrics:

- GitHub stars and issue/PR activity for community interest.
- Install count or active instance count from the anonymous telemetry ping described in `README.md`.
- Successful Docker Compose installs through App Store operations.
- Reduction in support issues around setup, auth, Docker access, and file permissions.
- Test coverage increasing on `compose-runner.ts`, `operations.ts`, and `files/service.ts`.
