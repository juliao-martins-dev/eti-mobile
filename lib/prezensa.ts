import { api } from "./api";
import { PREZENSA_ENDPOINTS } from "./config";
import type { Kolumna, LoronRecord } from "./istoria";
import { fetchKonfig, konfigNow, timeToMinutes } from "./konfig";

/**
 * The two punch actions, named after the endpoints that record them:
 * POST /api/prezensa/checkin/ and /checkout/.
 */
export type MarkaTipu = "checkin" | "checkout";

/** Matches `marka_foun.foto` in the punch response. */
const PHOTO_FIELD = "foto";

/**
 * Which of the sheet's four columns each action writes, per session.
 * Mirrors `Sesaun` (DADER/LOROKRAIK) x `Tipu` (TAMA/FILA) on the server.
 */
export const KOLUMNA = {
  checkin: { dader: "ORAS_DADER_TAMA", lorokraik: "ORAS_LOROKRAIK_TAMA" },
  checkout: { dader: "ORAS_DADER_FILA", lorokraik: "ORAS_LOROKRAIK_FILA" },
} as const satisfies Record<MarkaTipu, Record<string, Kolumna>>;

/**
 * Which column this punch will land in, per the server's `limite_sesaun`.
 *
 * Display only — the server picks the real column from its own clock, and the
 * app deliberately sends nothing about the session. Call `fetchKonfig()` first
 * so this reflects the server's cut-off rather than the built-in default.
 */
export function resolveKolumna(
  tipu: MarkaTipu,
  date: Date = new Date(),
): Kolumna {
  const boundary = timeToMinutes(konfigNow().limite_sesaun);
  const minutes = date.getHours() * 60 + date.getMinutes();

  return KOLUMNA[tipu][minutes < boundary ? "dader" : "lorokraik"];
}

/**
 * Scheduled time the punch is measured against, e.g. "08:00" — the server's
 * `oras_orariu`.
 */
export function orasOrariu(
  tipu: MarkaTipu,
  date: Date = new Date(),
): string {
  const k = konfigNow();
  const boundary = timeToMinutes(k.limite_sesaun);
  const dader = date.getHours() * 60 + date.getMinutes() < boundary;

  if (tipu === "checkin") {
    return dader ? k.oras_dader_tama : k.oras_lorokraik_tama;
  }
  return dader ? k.oras_dader_fila : k.oras_lorokraik_fila;
}

/**
 * "14:40:43" on the school's own clock.
 *
 * Timor-Leste, not the phone's timezone — a device left on another zone must
 * not show a time that disagrees with the one the server stamps.
 */
export function formatOrasAgora(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Dili",
  });
}

/** "Sesaun Dader" / "Sesaun Meudia" and "Tama" / "Sai" for the punch in hand. */
export function sesaunLabels(tipu: MarkaTipu, date: Date = new Date()) {
  return {
    sesaun: resolveKolumna(tipu, date).includes("DADER")
      ? "Sesaun Dader"
      : "Sesaun Meudia",
    asaun: tipu === "checkin" ? "Tama" : "Sai",
  };
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

/** A refusal the server explained: carries its `code` and any extra detail. */
export class PrezensaError extends Error {
  code?: string;
  /** Metres outside the geofence, on `dook_husi_eskola`. */
  distansia?: number;

  constructor(message: string, code?: string, distansia?: number) {
    super(message);
    this.code = code;
    this.distansia = distansia;
  }
}

/* ------------------------------------------------------------------ *
 * Today — GET /api/prezensa/ohin/
 * ------------------------------------------------------------------ */

export type Ohin = LoronRecord & {
  /** Server-computed button state. Creating the row is a side effect of GET. */
  bele_checkin: boolean;
  bele_checkout: boolean;
  oras_tama?: string | null;
  oras_fila?: string | null;
};

/** GET /api/prezensa/ohin/ — today's row plus the state of the two buttons. */
export async function fetchOhin(): Promise<Ohin> {
  const { data } = await api.get<Ohin>(PREZENSA_ENDPOINTS.ohin);
  return data;
}

/* ------------------------------------------------------------------ *
 * Marka — recording a punch
 * ------------------------------------------------------------------ */

export type MarkaCoords = {
  latitude: number;
  longitude: number;
  /** GPS accuracy in metres — evidence for a borderline geofence result. */
  presizaun?: number | null;
};

export type MarkaResult = {
  tipu: MarkaTipu;
  /** True when the server said `duplicate`: already recorded, still a success. */
  duplicate: boolean;
  data: unknown;
};

/**
 * POST /api/prezensa/checkin/ or /checkout/ with the captured photo.
 *
 * `duplicate` is treated as **success**: the punch was recorded, and a lost
 * response must not show the teacher a failure for attendance safely stored.
 */
export async function marka(
  tipu: MarkaTipu,
  photoUri?: string | null,
  coords?: MarkaCoords | null,
): Promise<MarkaResult> {
  const formData = new FormData();

  if (photoUri) {
    formData.append(PHOTO_FIELD, {
      uri: photoUri,
      name: "marka.jpg",
      type: "image/jpeg",
    } as any);
  }

  if (coords) {
    formData.append("latitude", String(coords.latitude));
    formData.append("longitude", String(coords.longitude));

    if (typeof coords.presizaun === "number") {
      formData.append("presizaun", String(coords.presizaun));
    }
  }

  const url = PREZENSA_ENDPOINTS[tipu];

  // Content-Type is intentionally omitted — the request interceptor strips it
  // so React Native can attach the multipart boundary itself.
  try {
    const { data } = await api.post(url, formData, {
      transformRequest: (value) => value,
      timeout: 60000,
    });

    return { tipu, duplicate: false, data };
  } catch (error: any) {
    const body = error?.response?.data;

    if (body?.code === "duplicate") {
      return { tipu, duplicate: true, data: body };
    }

    if (body?.detail) {
      throw new PrezensaError(
        body.detail,
        body.code,
        typeof body.distansia === "number" ? body.distansia : undefined,
      );
    }

    throw error;
  }
}

/** Warm the config cache so the session label is right on first render. */
export const primeKonfig = fetchKonfig;
