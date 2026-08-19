# Marka flow — the two switches

Everything lives in **`lib/marka-flow.ts`**. Each switch is a pair of lines: the
active one, and the alternative commented out beneath it. Swap the comment to
change behaviour. Nothing else in the app needs editing.

```ts
export const MARKA_TUIR_MALU = true;
// export const MARKA_TUIR_MALU = false;

export const KOMPLETA_LORON_TOMAK = true;
// export const KOMPLETA_LORON_TOMAK = false;
```

---

## 1. `MARKA_TUIR_MALU` — does one punch open the next?

**`true`** — the day is a sequence. Exactly one button is live at a time: the one
that fills the next empty slot. Finish the morning check-out and the afternoon
check-in opens immediately, whatever the hour.

```
empty day               ->  Checkin      writes DADER
after morning checkin   ->  Checkout     writes DADER
morning finished        ->  Checkin      writes LOROKRAIK   <- no waiting
afternoon checkin done  ->  Checkout     writes LOROKRAIK
day complete            ->  both shut
```

**`false`** — the school's real rule. Buttons obey `bele_checkin` /
`bele_checkout` exactly as `GET /api/prezensa/ohin/` reports them, and the
afternoon columns stay shut until the server clock passes `limite_sesaun`.

**The gap this closes:** at 10:01 with the morning complete, the server reports
`bele_checkin: false` *and* `bele_checkout: false` — both buttons dead until
13:00. That dead period is what `true` removes.

---

## 2. `KOMPLETA_LORON_TOMAK` — what about a skipped morning?

Only consulted when `MARKA_TUIR_MALU` is `true`.

Arriving at **15:00 with an empty sheet**:

| Value | First punch writes | Result |
|---|---|---|
| `true` | `DADER` | The skipped morning is filled first, then the afternoon — a full day |
| `false` | `LOROKRAIK` | Morning stays blank, the day starts at the afternoon |

Before `limite_sesaun` nothing is ever skipped, so at 09:00 both values behave
identically.

**One rule that holds either way:** a morning that was *started* stays
finishable. The test is `oras_dader_tama`, not "is the morning complete" — a
teacher who checked in at 08:05 and never checked out still gets their morning
check-out at 15:00, writing `DADER`. Without this, that session could never be
closed.

---

## Why a client-side file can do this at all

**Nothing on the server rejects a punch for being at the wrong hour.** There is
no time window to defeat. `_rejistu()` in `eti-api/attendance/models.py` raises
exactly four codes — `duplicate`, `no_checkin`, `no_session`, `dook_husi_eskola`
— and none of them is about the clock.

What the clock does is *aim*. The server reads `limite_sesaun` and decides which
pair of columns a punch lands in, so at 10:00 the afternoon columns are simply
not what you are pointed at.

`MarkaPrezensaSerializer` already accepts an optional **`sesaun`**, and a value
sent by the app overrides that choice — the field exists so a teacher can close
a session the clock has moved past. This file names the session explicitly
instead of leaving it to the hour. That is the entire mechanism.

---

## What is NOT bypassed

Every real rule still belongs to the server and is untouched:

| Rule | Code | Still enforced |
|---|---|---|
| A slot cannot be filled twice | `duplicate` | yes |
| Check-out needs its check-in | `no_checkin` | yes |
| Saturday has no afternoon | `no_session` | yes |
| Must be at the school | `dook_husi_eskola` | yes |

Saturday is handled client-side too: the afternoon pair is dropped from the
sequence, so the app never asks for a session the server would refuse.

---

## Where it is wired in

| File | Uses | For |
|---|---|---|
| `lib/marka-flow.ts` | — | Both switches and all the logic |
| `app/(eti)/index.tsx` | `markaFlow(today)` | Which button is live |
| `app/register.tsx` | `sesaunBaMarka(tipu)` | Names the session on the punch |
| `lib/prezensa.ts` | `marka(tipu, photo, coords, sesaun)` | Appends `sesaun` when given |

`sesaunBaMarka()` re-reads today's row at punch time rather than trusting a
value carried from the home screen, so a punch from a stale screen still lands
in the right column. It costs one small `GET /api/prezensa/ohin/` per punch.

Both functions take an optional `date` (defaulting to now) so the behaviour can
be tested against a fixed clock.

---

## Consequences worth remembering

**The times stored are the real punch times.** A day completed in one sitting at
10:00 records `10:00 / 10:01 / 10:02 / 10:03`. The afternoon marks will read as
very *early* against `oras_orariu`, not late. If that distorts reporting, the
fix belongs on the server, not here.

**Test punches are indistinguishable from real ones.** The server cannot tell a
named `sesaun` from a legitimate one — the field exists for honest use. There is
no audit trail marking these punches; that would need a backend change.

**Failures fall back safely.** If today's row cannot be read, `sesaunBaMarka()`
returns `null` and the punch goes out normally for the server to place. It never
guesses a column.

**Pressing the wrong button** sends no `sesaun` at all and lets the server answer
with the proper refusal, rather than forcing a column.
