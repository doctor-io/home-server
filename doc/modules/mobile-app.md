# Mobile app

A [Capacitor](https://capacitorjs.com/) shell for Android and iOS. It is not a
second implementation of Homeio: it opens on a small bundled launcher, and once
a server is chosen the WebView navigates onto **that server's own origin**, where
the existing web app runs first-party — its `/login` page handles credentials and
TOTP, and the session cookie, terminal WebSocket, SSE and uploads all work with
no CORS and no auth bridging.

Network reachability comes from the official Tailscale app or from a public URL;
the shell does not embed a tunnel and never stores a password.

---

## The two halves, and the seam between them

| Half | Lives in | Owns |
|---|---|---|
| Launcher | `apps/mobile/src/` | Server list, reachability probes, app settings storage |
| Native shell | `apps/mobile/native/android/` | Back button, downloads, app lock, the settings bridge, the phone-UI fallback |
| Phone UI | `app/m/`, `modules/phone/` | Everything after connecting — served by the server |

The third row is the important one: **`/m` is served by the server, not by the
app.** The two are separate origins (`http://localhost` for the launcher,
`https://your-server` for Homeio), which is why nothing on `/m` can read the
app's storage directly, and why the couplings below exist at all.

---

## Contract between the app and the server

Five points where one side depends on the other. Neither compiler can see them,
and no test fails when one moves — a break shows up as a dead button on someone's
phone. Change either side and change both.

| # | App side | Server side | If it breaks |
|---|---|---|---|
| 1 | `capacitor.config.ts` sets `appendUserAgent: "HomeioApp"` | `phone-settings.tsx` checks `navigator.userAgent` for that marker | Disconnect and the app switches vanish from `/m/settings` |
| 2 | `MainActivity` injects `addJavascriptInterface(…, "HomeioApp")` | `phone-settings.tsx` calls `window.HomeioApp.{read,setLock,setAutoReconnect}` | The app settings silently stop rendering |
| 3 | `main.ts` reads `?disconnect=1` on the launcher | `phone-settings.tsx` navigates to `http://localhost/?disconnect=1` | Disconnect returns to the list but auto-reconnect drags the user back in |
| 4 | `MainActivity` catches a main-frame **404 on `/m`** and loads `<origin>/` | The `/m` route existing at all | A server older than the phone UI shows a raw 404 instead of the desktop shell |
| 5 | Launcher navigates to `<origin>/m` after a successful probe | `/m` being the phone UI's entry point | The app lands somewhere that is not the phone UI |

Point 2 is the one to be careful with: that interface is exposed to **every page
the WebView loads**, including a server that has been compromised. It is
deliberately two booleans, and weakening the app lock asks for the device
fingerprint or PIN before it applies.

---

## Native behaviour, and why each piece is native

Every item here was tried in JavaScript first and could not live there — the
launcher's listeners die the moment the WebView navigates onto a server.

- **Back button** — Capacitor's handler does `canGoBack ? goBack() : nothing`
  once a page has no JS listener, which left Back dead on a server's first page.
  `MainActivity` handles it: history, then the launcher, then exit.
- **Downloads** — a WebView does nothing with a `Content-Disposition:
  attachment` response unless the activity sets a `DownloadListener`. Downloads
  go to Android's `DownloadManager` with the session cookie copied onto the
  request, and the filename parsed from the header rather than guessed from the
  MIME type.
- **App lock** — optional biometric gate on cold start and after a minute away.
  Absence is timed from `ACTION_SCREEN_OFF`, not from the activity lifecycle:
  behind the keyguard Android starts and stops the activity every 40–90 ms, and
  each cycle would reset the clock.
- **Phone-UI fallback** — see contract point 4. The launcher cannot detect a
  missing `/m` itself, because its probe is cross-origin and a `no-cors`
  response is opaque.
- **Settings bridge** — see contract point 2.

---

## Never break these

- No credentials are stored by the app; sign-in happens on the server's own page.
- The WebView origin allowlist stays limited to configured servers.
- TLS errors are never silently accepted.
- The app must keep working against a **v1.7 server** — it may not assume any
  v2.0 endpoint exists.
