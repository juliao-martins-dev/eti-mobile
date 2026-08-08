# ETI PRESENSA — Mobile

Teacher attendance app for **Escola Técnica Informática de Díli**.

It replaces the paper book *"Lista Prezensa ba Profesór/a ETI Dili"*. Instead of
signing a sheet four times a day, a teacher punches from their phone: a selfie
and a GPS fix stand in for the signature, and the school administration
supervises everything from a web dashboard.

This repository is the **mobile client only**. Domain vocabulary is Tetun
throughout — in the UI and in the data layer — because that is the language of
the paper form it replaces.

---

## Where this fits

![Architecture: the mobile app and the admin dashboard both talk to eti-api over JWT-authenticated REST; the API owns PostgreSQL and the media store of punch and profile photos.](assets/images/flow.png)

| Component | Role | Stack |
| --- | --- | --- |
| **`eti-mobile`** (this repo) | Teacher app — punch in/out, own history, profile | Expo 54 · React Native 0.81 · expo-router 6 · axios |
| `eti-api` | Single source of truth: identity, punches, sheets, reports | Django · DRF · SimpleJWT · PostgreSQL |
| `eti-dashboard` | Admin web: daily panel, period grid, roster, leave, reports | Next.js · React · Tailwind |

The phone never talks to the database. Every read and write goes through
`eti-api` as JSON or multipart, authenticated with a JWT bearer token. Photos
come back as absolute URLs into the API's media store and are loaded directly.

---

## What the app does

### Punching in and out

A teacher's day has **four** slots, mirroring the columns of the paper sheet:

| Session | Slot | Scheduled | Column written by the server |
| --- | --- | --- | --- |
| Dader (morning) | Tama (arrival) | 08:00 | `ORAS_DADER_TAMA` |
| Dader | Fila (departure) | 12:00 | `ORAS_DADER_FILA` |
| Lorokraik (afternoon) | Tama | 13:30 | `ORAS_LOROKRAIK_TAMA` |
| Lorokraik | Fila | 17:30 | `ORAS_LOROKRAIK_FILA` |

Tapping **Checkin** or **Checkout** opens the front camera. After the shot, the
app takes a GPS fix and uploads photo + coordinates as `multipart/form-data`.

**The server decides everything that matters.** It stamps the time from its own
clock, picks the session, and enforces the rules: no double punch in a session,
no checkout before a checkin, no Saturday afternoon, and a geofence around the
school. The app supplies evidence; it does not get a vote. A refusal comes back
as a machine-readable code (`duplicate`, `no_clock_in`, `dook_husi_eskola`, …)
which the app surfaces in Tetun.

### Historia — the attendance history

A month or a single week of the teacher's own record, laid out like the paper
sheet. Every working day appears, **including days with no attendance at all** —
the gaps are the point of the screen, not noise to filter out.

- Month navigator with a month/year picker; never navigates past the current month
- Segmented **Fulan** (month) / **Semana** (week) control
- Summary card from `rezumu`: marked days, unmarked, late arrivals, working days
- Per-day cards showing all four slots, late arrivals in amber against their
  scheduled time, and Saturday afternoon as `—` (no session, not a missed punch)

Not-yet-marked days are **grey, never red** — a missing day is usually leave,
not misconduct. The administration decides what a gap means, not the app.

### Profile

Loaded from `/api/auth/me/`. The teacher can replace their photo from the
gallery, which `PATCH`es the `foto` field as multipart.

### Screens

| Route | Screen | Data |
| --- | --- | --- |
| `app/index.tsx` | Splash + token routing | SecureStore |
| `app/(auth)/index.tsx` | Login | `POST /api/auth/login/` |
| `app/(eti)/index.tsx` | Veranda (home) — profile, clock, punch buttons | `/api/auth/me/` |
| `app/clock.tsx` | Camera capture + punch upload | `checkin/` · `checkout/` |
| `app/(eti)/history.tsx` | Historia | `/api/prezensa/istoria/` |
| `app/(eti)/profile.tsx` | Perfil | `/api/auth/me/` (GET, PATCH) |
| `app/(eti)/notification.tsx` | Notifikasaun | **mock data** — see gaps |
| `app/announcement.tsx` | Anuncio | **static image** — see gaps |

---

## How it talks to the API

Every request goes through one axios client, [`lib/api.ts`](lib/api.ts), so the
token discipline lives in exactly one place.

**Tokens.** Login returns `access`, `refresh` and the profile in a single
response. All three are persisted in **expo-secure-store** (the OS keychain /
keystore), never in plain storage.

**Refresh.** On a `401`, the client calls `/api/auth/refresh/` **once**,
persists the rotated refresh token — the server rotates it on every refresh, so
failing to save the new one breaks the next attempt — and replays the original
request. Concurrent 401s share a single refresh through a single-flight promise.
Only if the refresh itself fails is the session wiped and the teacher returned
to login. A teacher with a valid refresh token is never asked to log in again.

**Multipart.** `Content-Type` is deliberately left **unset** on `FormData`
requests. React Native only attaches the multipart `boundary` when that header
is absent; setting it by hand produces a boundary-less request that Django
parses as zero fields. The interceptor suppresses it rather than deleting it,
because axios re-adds a default for POST after request interceptors run.

**Host failover.** The school server is reachable on different subnets
depending on which network the phone joined. `API_HOSTS` is an ordered list; if
a host cannot be reached at all, the client rotates to the next candidate,
replays the request, and remembers the one that answered — including across
restarts, since that is a property of the network, not of the session.

### Endpoints consumed

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login/` | `email` + `password` → `access`, `refresh`, `user` |
| `POST` | `/api/auth/refresh/` | Rotate the token pair |
| `POST` | `/api/auth/logout/` | Blacklist the refresh token |
| `POST` | `/api/auth/verify/` | Check a token is still valid |
| `GET` | `/api/auth/me/` | Own profile |
| `PATCH` | `/api/auth/me/` | Replace own photo (multipart, `foto`) |
| `POST` | `/api/prezensa/checkin/` | Arrival punch — `foto`, `latitude`, `longitude` |
| `POST` | `/api/prezensa/checkout/` | Departure punch |
| `GET` | `/api/prezensa/istoria/` | Own history — `?fulan&tinan[&semana]` |

> Trailing slashes are **mandatory**. Without one Django issues a 301 and the
> request breaks.

---

## Project layout

```
app/                    expo-router routes
  (auth)/               login
  (eti)/                tab navigator — Veranda, Historia, Notifikasaun, Perfil
  clock.tsx             camera capture + punch upload
components/             presentational components
lib/
  api.ts                axios client, interceptors, host failover
  auth.ts               login / logout / refresh / profile / photo
  config.ts             API hosts and endpoint paths
  prezensa.ts           checkin & checkout, session columns
  istoria.ts            history API and the slot view model
  location.ts           GPS fix for a punch
  storage.ts            SecureStore for tokens, profile, host
```

---

## Getting started

Requires Node 20+ and a running `eti-api`.

```bash
npm install
npx expo start
```

Then open the project in **Expo Go** on a phone that can reach the API host.
All native modules used here (camera, location, image picker, secure store)
ship inside Expo Go, so no custom development build is needed.

### Pointing at a different backend

Default hosts live in [`lib/config.ts`](lib/config.ts). Override without
touching code — one URL, or several to try in order:

```bash
EXPO_PUBLIC_API_URL="http://10.0.0.5:8000"
EXPO_PUBLIC_API_URL="http://10.0.0.5:8000,http://192.168.1.20:8000"
```

The phone and the API must be on the same network. A quick check: open
`http://<host>:8000/api/prezensa/checkin/` in the phone's browser — a `401`
means the app can reach it.

---

## Known gaps

Honest state of things, so nobody is surprised:

- **Session boundary drift.** `lib/prezensa.ts` splits morning from afternoon at
  **13:30**; the server's `LIMITE_SESAUN` is **13:00**. Punches between 13:00 and
  13:30 are recorded correctly — the server decides the column — but the app
  labels them as morning. The fix is to read the cut-off from `GET /api/konfig/`
  instead of hardcoding it.
- **Today's times are cached locally.** The home screen remembers the punches it
  made rather than calling `GET /api/prezensa/ohin/`, so the times reset on
  reinstall and do not follow the teacher to another device.
- **`duplicate` is treated as a failure.** Punching twice in a session should be
  handled as "already recorded" and resynced, not shown as an error.
- **Notifikasaun and Anuncio are not live.** Notifications render mock data and
  the announcement is a bundled image; no server-side API exists for either yet.
- **Dead code.** The `istoriaOhin` endpoint constant is unused, and the punch
  upload still sends a `periodu` field the server ignores.

---

## License

Internal project of Escola Técnica Informática de Díli.
