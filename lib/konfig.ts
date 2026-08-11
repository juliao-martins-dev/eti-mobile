import { api } from "./api";
import { KONFIG_ENDPOINT } from "./config";

/**
 * Server-side schedule and geofence settings. Read-only, and the school's own
 * coordinates are deliberately never included.
 */
export type Konfig = {
  oras_dader_tama: string;
  oras_dader_fila: string;
  oras_lorokraik_tama: string;
  oras_lorokraik_fila: string;
  /** Morning/afternoon cut-off. The server uses this to pick the session. */
  limite_sesaun: string;
  eskola_raiu_metru: number;
  eskola_obriga_fatin: boolean;
};

/**
 * Mirrors the server defaults. Used only until the first fetch lands, so the
 * app never has to invent a cut-off of its own.
 */
export const KONFIG_FALLBACK: Konfig = {
  oras_dader_tama: "08:00:00",
  oras_dader_fila: "12:00:00",
  oras_lorokraik_tama: "13:30:00",
  oras_lorokraik_fila: "17:30:00",
  limite_sesaun: "13:00:00",
  eskola_raiu_metru: 100,
  eskola_obriga_fatin: true,
};

let cached: Konfig | null = null;
let inFlight: Promise<Konfig> | null = null;

/** GET /api/konfig/ — fetched once per app run, then served from memory. */
export async function fetchKonfig(): Promise<Konfig> {
  if (cached) return cached;

  if (!inFlight) {
    inFlight = api
      .get<Konfig>(KONFIG_ENDPOINT)
      .then(({ data }) => {
        cached = { ...KONFIG_FALLBACK, ...data };
        return cached;
      })
      .catch(() => KONFIG_FALLBACK)
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}

/** Whatever has been fetched so far — never blocks. */
export const konfigNow = (): Konfig => cached ?? KONFIG_FALLBACK;

/** "13:00:00" → minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** "08:00:00" → "08:00". */
export function trimSeconds(value?: string | null): string {
  if (typeof value !== "string") return "";
  const [hours, minutes] = value.split(":");
  return hours && minutes ? `${hours}:${minutes.slice(0, 2)}` : value;
}
