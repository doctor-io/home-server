# Homeio Documentation

Homeio is a self-hosted home server dashboard with a desktop-style Next.js UI for managing Docker Compose apps, files, terminal access, system metrics, scheduled tasks, notifications, storage, and network controls. These docs are written for maintainers and AI coding agents; factual source of truth is `PROJECT_AUDIT.md` plus the current code.

## Docs Index

| Document | Read this when you want to |
|---|---|
| [PRD.md](./PRD.md) | Understand the product vision, personas, non-goals, and roadmap links |
| [architecture.md](./architecture.md) | Understand processes, data flow, SSE/WebSocket behavior, build/deployment topology |
| [conventions.md](./conventions.md) | Follow coding patterns, route conventions, contracts, query keys, and anti-patterns |
| [api-reference.md](./api-reference.md) | Find HTTP, SSE, and WebSocket route behavior |
| [database.md](./database.md) | Inspect tables, relationships, and migration workflow |
| [security.md](./security.md) | Understand auth, host privilege risks, and known gaps |
| [testing.md](./testing.md) | Add or run Vitest tests |
| [contributing.md](./contributing.md) | Set up local development and prepare PRs |
| [AGENTS.md](./AGENTS.md) | Give Claude Code/Cursor/LLM agents the hard project rules |
| [modules/README.md](./modules/README.md) | Choose the correct feature module doc |

## Quick Links

- I want to add a feature module: [AGENTS.md](./AGENTS.md#add-a-new-feature-module), [conventions.md](./conventions.md#folder-placement)
- I want to add an API route: [AGENTS.md](./AGENTS.md#add-a-new-api-route), [api-reference.md](./api-reference.md), [conventions.md](./conventions.md#api-routes)
- I want to modify the file manager: [modules/files.md](./modules/files.md)
- I want to modify App Store installs: [modules/apps.md](./modules/apps.md), [modules/docker.md](./modules/docker.md)
- I want to modify auth/session behavior: [modules/auth.md](./modules/auth.md), [security.md](./security.md)
- I want to modify system metrics or SSE: [modules/system.md](./modules/system.md), [architecture.md](./architecture.md#sse)
- I want to modify terminal behavior: [modules/shell.md](./modules/shell.md), [api-reference.md](./api-reference.md#terminal)
- I want to add a database table: [AGENTS.md](./AGENTS.md#add-a-new-database-table), [database.md](./database.md)
- I want to add a settings section: [AGENTS.md](./AGENTS.md#add-a-new-settings-section), [contributing.md](./contributing.md#add-a-feature-module)

## Source Of Truth

- Use `PROJECT_AUDIT.md` for audit findings and architectural context.
- Use current code for exact route lists, schemas, functions, tests, and implementation details.
- If docs and code disagree, verify in code and update docs.
