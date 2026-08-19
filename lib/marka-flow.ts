/**
 * Whether the four punches of a day follow each other immediately, or wait for
 * the clock.
 *
 * ## The switch
 *
 * MARKA_TUIR_MALU = true   the day runs as a sequence. Finish the morning
 *                          check-out and the afternoon check-in opens at once,
 *                          whatever the hour.
 *
 * MARKA_TUIR_MALU = false  the school's real rule. The afternoon columns stay
 *                          shut until the server's clock passes limite_sesaun,
 *                          and the buttons obey `bele_checkin` /
 *                          `bele_checkout` exactly as the API reports them.
 *
 * Comment out the `true` and use the `false` line to go back. Nothing else in
 * the app needs touching.
 *
 * ## Why a client-side file can do this at all
 *
 * Nothing on the server rejects a punch for being at the wrong hour — there is
 * no time window to defeat. The clock only *aims*: the server reads
 * `limite_sesaun` and decides which pair of columns a punch lands in, so at
 * 10:00 the afternoon columns are simply not what you are pointed at.
 *
 * `MarkaPrezensaSerializer` already accepts an optional `sesaun`, and a value
 * sent by the app overrides that choice. So this file names the session
 * explicitly instead of leaving it to the hour. Every other rule still belongs
 * to the server and is untouched: a slot cannot be filled twice (`duplicate`),
 * a check-out still needs its check-in (`no_checkin`), Saturday still has no
 * afternoon (`no_session`), and the geofence still applies.
 */

import { konfigNow, timeToMinutes } from "./konfig";
import { fetchOhin, type MarkaTipu, type Ohin } from "./prezensa";

/** true = one punch opens the next. Swap the lines to restore the clock rule. */
// export const MARKA_TUIR_MALU = true;
export const MARKA_TUIR_MALU = false;

/**
 * What happens to a morning that was never punched at all.
 *
 * true   the day is always filled from the start. Arriving at 15:00 with an
 *        empty sheet, the first punch is the morning check-in, and the teacher
 *        works through all four slots.
 *
 * false  a morning nobody started is left empty. Arriving at 15:00, the first
 *        punch is the afternoon check-in and the morning columns stay blank.
 *
 * A morning that was *started* is always finishable either way — a check-in
 * with no check-out still gets its check-out, whatever the hour, because
 * otherwise that session could never be closed.
 *
 * Only consulted when MARKA_TUIR_MALU is true.
 */
// export const KOMPLETA_LORON_TOMAK = true;
export const KOMPLETA_LORON_TOMAK = false;

/** The two halves of the day, spelled as the server's `Sesaun` choices. */
export type Sesaun = "DADER" | "LOROKRAIK";

/** Which half of the day the clock is in, by the server's `limite_sesaun`. */
function sesaunOras(date: Date): Sesaun {
  const boundary = timeToMinutes(konfigNow().limite_sesaun);
  const minutes = date.getHours() * 60 + date.getMinutes();

  return minutes < boundary ? "DADER" : "LOROKRAIK";
}

/** One slot of the sheet: which session it belongs to and which button fills it. */
type Slot = { sesaun: Sesaun; tipu: MarkaTipu; field: keyof Ohin };

/**
 * The day in the order it is actually lived. The afternoon pair is dropped on
 * a Saturday, which has no lorokraik session.
 */
const SLOTS: Slot[] = [
  { sesaun: "DADER", tipu: "checkin", field: "oras_dader_tama" },
  { sesaun: "DADER", tipu: "checkout", field: "oras_dader_fila" },
  { sesaun: "LOROKRAIK", tipu: "checkin", field: "oras_lorokraik_tama" },
  { sesaun: "LOROKRAIK", tipu: "checkout", field: "oras_lorokraik_fila" },
];

/**
 * The first slot of the day still empty, or null once the day is complete.
 *
 * Order is what makes the sequence work: the API refuses a check-out with no
 * check-in in the same session, so the next thing to fill is always the next
 * thing in this list.
 */
function slotTuirMai(ohin: Ohin, date: Date = new Date()): Slot | null {
  let slots = ohin.sabadu
    ? SLOTS.filter((slot) => slot.sesaun === "DADER")
    : SLOTS;

  // A morning nobody started is skipped once the clock has left it. The test
  // is `oras_dader_tama`, not "is the morning complete": a session that was
  // begun must stay finishable, or its check-out could never be recorded.
  if (
    !KOMPLETA_LORON_TOMAK &&
    !ohin.oras_dader_tama &&
    sesaunOras(date) === "LOROKRAIK"
  ) {
    slots = slots.filter((slot) => slot.sesaun === "LOROKRAIK");
  }

  return slots.find((slot) => !ohin[slot.field]) ?? null;
}

export type MarkaFlow = {
  beleCheckin: boolean;
  beleCheckout: boolean;
};

/**
 * Which of the two buttons is live.
 *
 * Exactly one is enabled at a time — the one that fills the next empty slot —
 * so finishing a punch hands the day straight to the next one. When the day is
 * complete, or today's row has not arrived yet, both fall back to what the
 * server said.
 */
export function markaFlow(
  ohin: Ohin | null,
  date: Date = new Date(),
): MarkaFlow {
  const servidor = {
    beleCheckin: ohin ? ohin.bele_checkin : true,
    beleCheckout: ohin ? ohin.bele_checkout : true,
  };

  if (!MARKA_TUIR_MALU || !ohin) return servidor;

  const tuirMai = slotTuirMai(ohin, date);
  if (!tuirMai) return { beleCheckin: false, beleCheckout: false };

  return {
    beleCheckin: tuirMai.tipu === "checkin",
    beleCheckout: tuirMai.tipu === "checkout",
  };
}

/**
 * Which session the punch about to be sent should be written to, or null to
 * leave the choice to the server's clock.
 *
 * Reads today's row rather than trusting a value carried from the previous
 * screen, so a punch made from a stale screen still lands in the right column.
 * Any failure returns null: better a punch the server places itself than one
 * placed on a guess.
 */
export async function sesaunBaMarka(
  tipu: MarkaTipu,
  date: Date = new Date(),
): Promise<Sesaun | null> {
  if (!MARKA_TUIR_MALU) return null;

  try {
    const ohin = await fetchOhin();
    const tuirMai = slotTuirMai(ohin, date);

    // Only name the session for the slot actually being filled. A mismatch —
    // the checkout button pressed while a check-in is what is due — is left to
    // the server, which will answer with the right refusal.
    return tuirMai && tuirMai.tipu === tipu ? tuirMai.sesaun : null;
  } catch {
    return null;
  }
}
