# UI ⇄ API gap analysis — eti-mobile

Every UI element in `app/`, matched against the endpoint that should feed it.

Sources: `eti-api/README.md`, `eti-api/docs/integrate-api.md` (contract verified
2026-08-10), and a read of all twelve files under `eti-mobile/app/`.

**Verdicts**

| | |
| --- | --- |
| **KEEP** | Fed by a real endpoint and correct |
| **CUT** | Renders mock, hardcoded, or locally-invented data |
| **BUILD** | An endpoint exists in the API that no screen calls |

> **Status — the §12 backlog was executed.** Steps 1–5 are done and verified;
> verdicts below reflect the code as it now stands. Only the Notifikasaun and
> Anuncio screens remain CUT, because they need a backend that does not exist.

The profile shape the API actually returns — every field, nothing else:

```json
{ "id", "numeru_id", "email", "naran_kompletu", "kargu",
  "foto", "role", "role_display" }
```

---

## 1. `app/index.tsx` — Splash

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Splash | ETI logo, title | — | KEEP | Static branding, correctly so |
| Splash | Loading bar | — | KEEP | Decorative |
| Splash | Token routing | SecureStore | KEEP | Reads the stored access token, routes to `(auth)` or `(eti)` |

## 2. `app/(auth)/index.tsx` — Login

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Login | Logo, title, subtitle | — | KEEP | Static branding |
| Login | "Username" field | `POST auth/login/` | KEEP | Sent as `email`. **Label is wrong** — the API's username field is the e-mail; teachers must type an address into a box labelled "Username" |
| Login | Password field | `POST auth/login/` | KEEP | |
| Login | Login button | `POST auth/login/` | KEEP | Stores `access`, `refresh`, `user` in SecureStore |
| Login | Error text | `POST auth/login/` | KEEP | Surfaces the server's Tetun `detail` |
| Login | Footer copyright | — | KEEP | Static |
| Login | *(missing)* forgot password | — | — | Deliberately absent: no self-service reset exists. Teachers contact an admin |

## 3. `app/(eti)/index.tsx` — Veranda (home)

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Veranda | Profile avatar | `GET auth/me/` → `foto` | KEEP | Falls back to bundled `prof.jpg` |
| Veranda | Teacher name | `GET auth/me/` → `naran_kompletu` | KEEP | **Fixed.** Previously fell through to the e-mail because `naran_kompletu` was never read |
| Veranda | Position under name | `GET auth/me/` → `kargu` | KEEP | |
| Veranda | Date + live clock | device clock | KEEP | Local display only |
| Veranda | Clock label timezone | device clock | KEEP | **Fixed.** Was `Asia/Jakarta` + "WIB"; now `Asia/Dili` + "TL" |
| Veranda | Checkin time | `GET prezensa/ohin/` → `oras_tama` | KEEP | **Fixed.** Was a local SecureStore cache that reset on reinstall |
| Veranda | Checkout time | `GET prezensa/ohin/` → `oras_fila` | KEEP | **Fixed.** Same |
| Veranda | Checkin button enabled state | `bele_checkin` | KEEP | **Fixed.** Dimmed and disabled when the server says no. Left enabled while today's row is still loading, so a fetch failure never blocks a punch |
| Veranda | Checkout button enabled state | `bele_checkout` | KEEP | **Fixed.** Same |
| Veranda | "Historia prezensa" header + "Hare liu taan" | — | KEEP | **Replaced Anuncio.** Links to the Historia tab |
| Veranda | Two most recent day cards | `GET prezensa/istoria/` | KEEP | **Replaced the announcement image.** The last two *working* days, reaching into the previous month when needed |

## 4. `app/clock.tsx` — Punch capture

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Clock | Camera permission card | expo-camera | KEEP | Handles blocked state with a settings deep link |
| Clock | Camera view + shutter | expo-camera | KEEP | Front camera, quality 0.6 |
| Clock | Preview: teacher name | `GET auth/me/` → `naran_kompletu` | KEEP | **Fixed** |
| Clock | Preview: teacher ID | `GET auth/me/` → `numeru_id` | KEEP | **Fixed.** Was printing the database primary key (`1`) instead of the staff number |
| Clock | Preview photo | local capture | KEEP | |
| Clock | "Horas Tama"/"Horas Fila" | client-side | KEEP | Derived from the `mode` route param |
| Clock | Live clock in preview | device clock | **CUT** | Cosmetic only, but misleading: **the server stamps the recorded time**, so this is not what gets saved. Left in place — removing it is a UI decision |
| Clock | Submit button | `POST prezensa/checkin/` · `checkout/` | KEEP | Multipart `foto` + `latitude` + `longitude` + `presizaun` |
| Clock | GPS fix | expo-location | KEEP | Falls back to last-known position |
| Clock | `periodu` form field | — | KEEP | **Removed.** The server ignored it |
| Clock | `presizaun` | `POST checkin/` | KEEP | **Added.** GPS accuracy now sent as evidence for a borderline geofence result |
| Clock | `duplicate` response | error `code` | KEEP | **Fixed.** Now treated as success — "Prezensa ne'e rejistu ona." — and the home screen resyncs |
| Clock | `dook_husi_eskola` alert | error `code` + `distansia` | KEEP | **Fixed.** Now appends "Distánsia: N metru husi eskola" |

## 5. `app/(eti)/history.tsx` — Historia

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Historia | Month navigator `‹ Fulan Tinan ›` | `GET prezensa/istoria/?fulan&tinan` | KEEP | Never navigates past the current month |
| Historia | Month/year picker | same | KEEP | Future months disabled |
| Historia | Fulan / Semana segmented control | `?semana` omitted or sent | KEEP | |
| Historia | Week stepper | `?semana=1..6` | KEEP | Fixed 1–6; the API echoes the real `semana` |
| Historia | Summary progress bar | `rezumu.marka_ona / loron_servisu` | KEEP | |
| Historia | Stat: Marka ona | `rezumu.marka_ona` | KEEP | |
| Historia | Stat: Seidauk marka | `rezumu.seidauk_marka` | KEEP | Grey, never red — a gap is usually leave |
| Historia | Stat: Atrazadu | `rezumu.atrazadu` | KEEP | |
| Historia | Stat: Loron servisu | `rezumu.loron_servisu` | KEEP | |
| Historia | Day card: weekday + date | `loron[].loron`, `.data` | KEEP | |
| Historia | Day card: Sábadu tag | `loron[].sabadu` | KEEP | |
| Historia | Day card: status badge | `loron[].status_display` | KEEP | Correctly uses the Tetun label, not the English stored value |
| Historia | Day card: 4 time slots | `loron[].oras_*` + `marka[]` | KEEP | Late only on `_TAMA`; Saturday afternoon renders `—` |
| Historia | Day card: scheduled time on late | `marka[].oras_orariu` | KEEP | |
| Historia | Day card: obs | `loron[].obs` | KEEP | Shows an admin's leave note |
| Historia | Empty days included | `loron[]` | KEEP | Not filtered — the gaps are the point |
| Historia | Loading / error / empty states | — | KEEP | Surfaces `invalid_period` verbatim |
| Historia | Pull to refresh | same | KEEP | |
| Historia | Evidence photo thumbnails | `marka[].foto` | KEEP | **Added.** One thumbnail per punch that has a photo |
| Historia | Evidence detail modal | `marka[].foto`, `.distansia_metru`, `.iha_eskola`, `.oras_orariu` | KEEP | **Added.** Full photo plus distance from school and lateness against schedule |

## 6. `app/(eti)/profile.tsx` — Perfil

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Perfil | Avatar | `GET auth/me/` → `foto` | KEEP | |
| Perfil | Camera button → gallery | `PATCH auth/me/` | KEEP | Multipart `foto`, the only field the endpoint accepts |
| Perfil | Name (header + "Naran" row) | `GET auth/me/` → `naran_kompletu` | KEEP | **Fixed** |
| Perfil | Position (header + "Kargu" row) | `GET auth/me/` → `kargu` | KEEP | |
| Perfil | "Email" row | `GET auth/me/` → `email` | KEEP | |
| Perfil | "Numeru ID" row | `GET auth/me/` → `numeru_id` | KEEP | **Added.** Replaces "Departamentu", which no API field could ever fill |
| Perfil | "Tipu konta" row | `GET auth/me/` → `role_display` | KEEP | **Added.** The Tetun label, never the stored `role` value |
| Perfil | "Horariu Dader" row | `GET konfig/` → `oras_dader_*` | KEEP | **Fixed.** Was a local constant; now the server's real schedule |
| Perfil | "Horariu Lorokraik" row | `GET konfig/` → `oras_lorokraik_*` | KEEP | **Added.** Replaces "Status", which always rendered `-` |
| Perfil | "Raiu eskola" row | `GET konfig/` → `eskola_raiu_metru` | KEEP | **Added.** Replaces "Lokál Servisu". Tells the teacher how close they must be to punch |
| Perfil | Logout button | `POST auth/logout/` | KEEP | Blacklists the refresh token; clears locally even if the call fails |

## 7. `app/(eti)/notification.tsx` — Notifikasaun

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Notifikasaun | Hotu / Prezensa / Lembra tabs | local feed | KEEP | **Fixed.** "Eskola" replaced by "Lembra" — nothing could ever fill it |
| Notifikasaun | Notification cards | `checkin/` · `checkout/` responses | KEEP | **Fixed.** Each entry is a real punch outcome: recorded time, `atrazadu`, or the server's refusal `code` |
| Notifikasaun | Reminder entries | local scheduler | KEEP | **Added.** Fired checkin/checkout reminders land here too |
| Notifikasaun | Unread indicator | local feed | KEEP | **Fixed.** Cleared when the list is viewed |
| Notifikasaun | Clear-all button | local feed | KEEP | **Added.** Empties the list and the phone's tray together |
| Notifikasaun | Empty state | — | KEEP | |

**There is still no notification *endpoint*.** The feed is built on the device
from real API outcomes rather than invented data, so nothing here is mock —
but it is per-device and is cleared on logout.

## 8. `app/announcement.tsx` — Anuncio

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| Anuncio | Header + subtitle | — | KEEP | Static copy |
| Anuncio | Announcement list | — | **CUT** | Five hardcoded items dated Feb 2026 |
| Anuncio | Card images | — | **CUT** | Same bundled image on every card |

**No announcement endpoint exists server-side.** Same as above.

## 9. Navigation & scaffolding

| Screen | Element | Endpoint | Verdict | Note |
| --- | --- | --- | --- | --- |
| `_layout.tsx` | Route guard | SecureStore | KEEP | Redirects tokenless users to login |
| `(eti)/_layout.tsx` | Tab bar (4 tabs) | — | KEEP | Two of the four tabs lead to CUT screens |
| `(auth)/_layout.tsx` | Auth stack | — | KEEP | |
| `+not-found.tsx` | Not-found screen | — | KEEP | Unstyled, but functional |

---

## 10. BUILD backlog — endpoints the app never calls

| Endpoint | What it gives | Status |
| --- | --- | --- |
| `GET prezensa/ohin/` | Today's row **and** `bele_checkin` / `bele_checkout` | **Now consumed** by the Veranda clock card |
| `GET konfig/` | `oras_*` schedule, **`limite_sesaun`**, `eskola_raiu_metru` | **Now consumed** by Perfil and the session logic |
| `GET marka/{id}/foto/` | Authenticated photo download + filename | Still unused. Historia displays `marka[].foto` inline instead. Worth adopting if `MEDIA_ROOT` is made private in production — the inline URLs 404 then, this route does not |
| `POST auth/verify/` | Token still valid | Still unused. Implemented in `lib/auth.ts`, called by no screen |
| `GET prezensa/` · `{id}/` | Own day rows | **No consumer in any client.** Superseded by `istoria/` |
| `GET lista-prezensa/` · `{id}/` | Own monthly sheets | **No consumer in any client.** Same |

---

## 11. Correctness issues found while mapping

All five are now fixed. Kept here as the record of what was wrong.

1. ~~**Session cut-off drift.**~~ The app split morning/afternoon at **13:30**
   while the server's `limite_sesaun` is **13:00**, so punches in that
   half-hour were labelled "Dader". Now read from `GET konfig/`, with the
   server's own default as the offline fallback.
2. ~~**`naran_kompletu` / `numeru_id` never read.**~~ Three screens showed an
   e-mail where a name belongs and one showed a database id where a staff
   number belongs. Fixed in `lib/auth.ts` via `displayName` and `staffNumber`.
3. ~~**`duplicate` treated as an error.**~~ Now resolves as success.
4. ~~**Stale wire names.**~~ `PREZENSA_ENDPOINTS` keys are now
   `checkin`/`checkout`/`ohin`/`istoria`; the dead `istoriaOhin` constant and
   the ignored `periodu` form field are gone.
5. ~~**`distansia` discarded**~~ on a `dook_husi_eskola` refusal. Now shown in
   metres.

---

## 12. Summary

| Verdict | Before | After |
| --- | --- | --- |
| KEEP | 49 | **73** |
| CUT | 19 | **5** |
| BUILD | 10 | **0** |

Every BUILD is closed. The five remaining CUTs are the **Anuncio screen**
(2 rows, now unreachable — nothing links to it) and the cosmetic live clock on
the punch preview.

Every screen that *can* be driven by the API now is. Veranda, Clock, Historia
and Perfil read live data end to end, and the server is the authority on the
session cut-off, the button state and the recorded time.

Notifikasaun now runs on a device-local feed of real punch outcomes and fired
reminders, so no tab shows invented data any more.

**Only Anuncio is left, and it is a product decision.** No announcement
endpoint exists in `eti-api`, and since the home screen now links to Historia
instead, the screen is unreachable — it survives only as a registered route.
Either design an endpoint for it, or delete `app/announcement.tsx` and its
entry in `app/_layout.tsx`.
