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

The app lives in its own repository — **[doctor-io/homeio-mobile](https://github.com/doctor-io/homeio-mobile)**
(private) — because it ships on a different clock: signed APKs, store metadata, a
keystore that does not belong in a public repo, and push work that touches no
server code.

| Half | Repository | Owns |
|---|---|---|
| Launcher | `homeio-mobile` → `src/` | Server list, reachability probes, app settings storage |
| Native shell | `homeio-mobile` → `native/android/` | Back button, downloads, app lock, the settings bridge, the phone-UI fallback, the push connection |
| Phone UI | this repo → `app/m/`, `modules/phone/` | Everything after connecting — served by the server |

The third row is the important one: **`/m` is served by the server, not by the
app.** The two are separate origins (`http://localhost` for the launcher,
`https://your-server` for Homeio), which is why nothing on `/m` can read the
app's storage directly, and why the couplings below exist at all.

---

## Contract between the app and the server

Eight points where one side depends on the other, and they now live in **separate
repositories**. Neither compiler can see them, and no test fails when one moves —
a break shows up as a dead button on someone's phone. Change either side and
change both, in both repos, in the same sitting.

| # | App side | Server side | If it breaks |
|---|---|---|---|
| 1 | `capacitor.config.ts` sets `appendUserAgent: "HomeioApp"` | `phone-settings.tsx` checks `navigator.userAgent` for that marker | Disconnect and the app switches vanish from `/m/settings` |
| 2 | `MainActivity` injects `addJavascriptInterface(…, "HomeioApp")` | `phone-settings.tsx` calls `window.HomeioApp.{read,setLock,setAutoReconnect}` | The app settings silently stop rendering |
| 3 | `main.ts` reads `?disconnect=1` on the launcher | `phone-settings.tsx` navigates to `http://localhost/?disconnect=1` | Disconnect returns to the list but auto-reconnect drags the user back in |
| 4 | `MainActivity` catches a main-frame **404 on `/m`** and loads `<origin>/` | The `/m` route existing at all | A server older than the phone UI shows a raw 404 instead of the desktop shell |
| 5 | Launcher navigates to `<origin>/m` after a successful probe | `/m` being the phone UI's entry point | The app lands somewhere that is not the phone UI |
| 6 | `MainActivity` exposes `HomeioApp.{setPush,clearPush}` and reports `pushTopic` from `read()` | `phone-settings.tsx` calls them from the "Notifications on this phone" row | The row disappears, or the switch moves and nothing subscribes |
| 7 | `PushService` subscribes to `<url>/<topic>/json` | `GET /api/v1/settings/push` returning the same `ntfyUrl` and `ntfyTopic` the dispatcher publishes to | The phone listens to an address nothing publishes to, silently |
| 8 | `PushService` treats the tag `homeio-ping` as "go and read `GET /api/v1/notifications`" | `push-service.ts` tagging a content-free push with `PING_TAG` | Every alert reads "New notification" and never says what happened |

Points 6 and 7 fail the same quiet way point 4 does: nothing errors, the alert
simply never arrives. The row is built to expose which half is missing — it
reads as off whenever this phone is not subscribed to *the topic the server
currently uses*, so a rotated topic shows as off and the switch moves the phone
onto the new one.

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
- **In-app navigation** — `allowNavigation` is baked in at build time, so a
  server on an mDNS name, a LAN address or the owner's own domain was handed to
  the external browser. `MainActivity` overrides `shouldOverrideUrlLoading` and
  keeps navigation in-app for any origin in the **saved server list**, which is
  the allowlist this document always described. It matters most on a pairing
  scan: the code is single use, so leaving for Chrome spent it there and put the
  session in the wrong browser. Anything that is not a saved server still opens
  externally.
- **Settings bridge** — see contract point 2.
- **Push, ping mode** — by default the push carries no alert text at all: the
  relay is told that something happened, at what severity, and nothing else.
  `PushService` then fetches the real notification from the user's own Homeio,
  with the session cookie taken from the WebView's store, and shows that. When
  the server cannot be reached — phone off the tailnet, session expired — it
  falls back to the generic text, so an alert is degraded but never lost. The
  origin it resolves against is captured from the WebView at subscribe time,
  not from the page: the bridge is reachable from every page loaded, and a page
  that could name the server could name someone else's.
- **Push** — a foreground service holding ntfy's JSON stream, because the whole
  point is alerts arriving with the app closed and nothing tied to the activity
  survives that. It costs a permanent low-priority notification, which is the
  honest price of holding a socket open. No wake lock: under Doze the connection
  can stall and messages arrive when the phone next wakes, which is the trade
  every non-FCM push app makes. The topic and address are validated in
  `MainActivity` before they are stored — the bridge is reachable from any page
  the WebView loads — and nothing is stored at all until the notification
  permission is actually granted, or a denied prompt would leave `BootReceiver`
  starting a service that can never post.

---

## Never break these

- No credentials are stored by the app; sign-in happens on the server's own page.
- The WebView origin allowlist stays limited to configured servers.
- TLS errors are never silently accepted.
- Notification text is published by whoever knows the topic, so it is displayed
  and nothing more: tapping opens the app, and there are no actions or deep links.
- `GET /api/v1/notifications` must stay `no-store`. The phone resolves a
  content-free push against it, so a cached copy is not a stale screen — it is an
  alert that never appears. A CDN in front of a self-hosted server is a normal
  deployment, and one was observed serving that API with `Age: 2916`; the app
  cache-busts the URL for the same reason.
- The app must keep working against a **v1.7 server** — it may not assume any
  v2.0 endpoint exists.
