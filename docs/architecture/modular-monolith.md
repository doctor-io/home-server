# Modular Monolith Rules

This repo stays a single deployable Next.js + Node application. Refactors should strengthen domain boundaries inside that monolith, not split the runtime.

## Dependency Rules
- `app/api/*` are HTTP translators only: validate input, call server application services, map response and errors.
- `app/*` pages and shell components can compose feature modules, but should not embed domain logic.
- `lib/server/modules/*` is the server application/domain layer. Infra details such as Docker, DB, filesystem, D-Bus, NetworkManager, and spawned processes stay behind local adapters.
- `modules/*` owns feature UI and feature hooks. Feature code must not import `app/api/*`.
- Shared contracts only move to `lib/shared/contracts/*` when they cross a real client/server boundary.

## Server Shape
For new server work inside a domain, prefer this layout:
- `contracts/types`: DTOs and boundary-level types
- `application/use-cases`: orchestrators that express one business action
- `domain`: policies, invariants, business decisions
- `infrastructure`: repositories and host adapters

Avoid placing new behavior into broad `service.ts` files when a narrower use-case or adapter file is a better fit.

## UI Shape
Large feature screens should converge on three roles:
- container/orchestrator: data loading, section selection, high-level actions
- presentational components: cards, rows, forms, dialogs, menus
- focused hooks: one capability per hook when state and effects are non-trivial

If a file grows beyond roughly 300-400 lines and owns multiple responsibilities, extract at least one responsibility before adding more logic.

## Refactor Definition of Done
Each vertical pass should leave the codebase with:
- one `todo.md` item easier to test
- at least one hotspot file reduced
- no new cross-domain coupling
- targeted tests and production build green

## First Hotspots
Current priority hotspots:
- `lib/server/modules/docker/compose-runner.ts`
- `modules/settings/hooks/useSettingsBackend.ts`
- `modules/apps/components/app-store.tsx`

The goal is steady extraction, not a rewrite branch.
