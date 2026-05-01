# Network Manager

## Purpose

Network management reads network status, scans WiFi networks, connects/disconnects networks, and streams network events. The main app does not talk to D-Bus directly; it calls a helper over a Unix socket.

## Locations

- Server-side: `lib/server/modules/network/`
- Sidecar: `services/dbus-helper/`
- Client-side: `modules/system/components/status-bar/wifi-popover.tsx`, `modules/system/hooks/useNetwork*.ts`
- Routes: `app/api/v1/network/`

## Key Files

| File | Role |
|---|---|
| `lib/server/modules/network/service.ts` | High-level network service and fallback behavior |
| `lib/server/modules/network/helper-client.ts` | Unix socket client for dbus-helper |
| `lib/server/modules/network/events.ts` | In-memory network event pub/sub |
| `services/dbus-helper/index.mjs` | Sidecar entry point |
| `services/dbus-helper/network-service.mjs` | NetworkManager D-Bus calls |
| `modules/system/components/status-bar/wifi-popover.tsx` | WiFi UI |

## Public API

- `getNetworkStatus()`
- `getWifiNetworks()`
- `connectNetwork()`
- `disconnectNetwork()`
- `subscribeToNetworkEvents()`
- Client hooks: `useNetworkStatus()`, `useWifiNetworks()`, `useNetworkActions()`, `useNetworkEventsSse()`

## Contracts

- `lib/shared/contracts/network.ts`

## Database Tables

None.

## API Routes Owned

- `GET /api/v1/network/status`
- `GET /api/v1/network/networks`
- `POST /api/v1/network/connect`
- `POST /api/v1/network/disconnect`
- `GET /api/v1/network/events/stream`

## Known Issues

- `services/dbus-helper/` is plain JavaScript, not TypeScript.
- The helper is not started by `server.ts`; install scripts manage it for bare-metal setups.
- Network routes are currently unauthenticated in code.

## How To Extend

To add a NetworkManager action:

1. Add protocol handling in `services/dbus-helper/protocol.mjs` and sidecar service code.
2. Add helper-client support in `lib/server/modules/network/helper-client.ts`.
3. Add high-level service support in `lib/server/modules/network/service.ts`.
4. Add shared types in `lib/shared/contracts/network.ts`.
5. Add a protected route under `app/api/v1/network/`.
6. Add hook/UI support under `modules/system/`.
7. Test both `services/dbus-helper/__tests__/` and `lib/server/modules/network/__tests__/`.
