# Contributing to Homeio

Thanks for your interest in contributing. This document covers how to get set up, how to submit changes, and what to focus on.

---

## Getting Started

**Requirements:** Node.js 22.x, npm, PostgreSQL, Docker (for integration testing)

```bash
git clone https://github.com/doctor-io/homeio.git
cd homeio
npm install
cp .env.example .env.local
createdb home_server
npm run db:init
npm run dev
```

Open `http://localhost:3000`. The app routes to `/register` if no users exist — create an account and you're in.

---

## Project Structure

```
app/          Next.js App Router — pages and API routes
components/   Shared UI primitives (shadcn/ui base + custom)
lib/
  server/     Server-only code (Docker, DB, SSE, logging)
  shared/     Types and contracts shared between client and server
  ui/         Design tokens and client utilities
modules/      Feature modules — each owns its components, hooks, and types
  apps/       App grid, App Store, container logs
  files/      File manager, editor, previews
  settings/   Settings panel and all sections
  shell/      Desktop shell, dock, command palette, status bar
  system/     System monitor, network manager
scripts/      install.sh, update.sh, uninstall.sh, factory-reset.sh
```

---

## Development Workflow

### Branches

- `main` — stable, always deployable
- `feature/<name>` — new features
- `fix/<name>` — bug fixes

Open a PR against `main`. Keep branches focused — one feature or fix per PR.

### Commits

Use conventional commit prefixes:

```
feat: add Google Drive integration
fix: prevent EventSource reconnect loop after log.end
refactor: extract surface tokens to lib/ui/surface-tokens
docs: update roadmap for v1.5
```

### Before opening a PR

```bash
npm run lint      # must pass
npm run build     # must pass
npm run test      # must pass
```

If you're touching the database schema, run `npm run db:migrate` and include the migration file in your PR.

---

## Design System

Homeio uses a glass-morphism surface token system. When building or modifying UI, use the tokens from `lib/ui/surface-tokens.ts` instead of writing raw Tailwind classes:

| Token | Use |
|-------|-----|
| `PANEL_SHELL` | Outermost card or panel container |
| `PANEL_INSET` | Inner section within a shell (sub-card, info block, input) |
| `BADGE_SURFACE` | Small pill, chip, or badge |
| `MENU_SHELL` | Floating menus, popovers, context menus |

Semantic colour tokens (`text-status-red`, `text-status-green`, `border-glass-border`, etc.) are defined in the global CSS. Avoid hardcoding hex values or arbitrary opacity variants.

---

## API Conventions

### Server actions vs. API routes

- Use **Next.js Server Actions** for mutations triggered from UI (form submits, button clicks)
- Use **API routes** (`app/api/v1/`) for anything that needs to be called from a client hook, external tool, or SSE stream

### SSE endpoints

Real-time data uses Server-Sent Events. See `/app/api/v1/apps/[appId]/logs/stream/route.ts` as the reference implementation:

- Set `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`
- Send a `heartbeat` event every 30s to keep the connection alive through proxies
- Always handle `request.signal` abort to clean up resources when the client disconnects
- Emit typed events (`log.line`, `log.end`, `log.error`) — avoid generic `message` events

### Contracts

Shared types between client and server live in `lib/shared/contracts/`. Add a contract file for any new feature that has a client-facing API.

---

## What to Work On

Check the [open issues](https://github.com/doctor-io/homeio/issues) for things tagged `good first issue` or `help wanted`.

The [roadmap](./ROADMAP.md) lists what's planned. If you want to work on something from the roadmap, open an issue first so we can discuss scope and avoid duplicate effort.

### Good areas for contributions

- **App Store templates** — add new apps to the default catalogue
- **Bug fixes** — especially on non-Debian distros or ARM hardware
- **Accessibility** — keyboard navigation, ARIA labels, focus management
- **Test coverage** — unit tests for server modules under `lib/server/`
- **Translations** — the UI is English-only today

### Please avoid

- Large refactors without prior discussion
- Adding dependencies without a clear justification
- Changes that break the Docker install path
- Removing features without an issue tracking the decision

---

## Reporting Bugs

Open an issue with:

1. What you did
2. What you expected
3. What actually happened
4. Your install method (Docker / bare-metal) and OS/architecture

Logs help — grab them with `docker compose logs` or `journalctl -u homeio`.

---

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

---

*Questions? Open a discussion or drop a comment on the relevant issue.*
