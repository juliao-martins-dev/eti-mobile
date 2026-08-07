import { api } from "./api";
import { PREZENSA_ENDPOINTS } from "./config";

/* ------------------------------------------------------------------ *
 * API shapes — field names stay Tetun, matching the serializer.
 * ------------------------------------------------------------------ */

/**
 * `attendance.Prezensa.Status` — stored values are English since 2026-08-06;
 * the Tetun label to show comes back in `status_display`.
 */
export type Status = "PRESENT" | "ABSENT" | "LEAVE" | "MISSION" | "HOLIDAY";

export type Kolumna =
  | "ORAS_DADER_TAMA"
  | "ORAS_DADER_FILA"
  | "ORAS_LOROKRAIK_TAMA"
  | "ORAS_LOROKRAIK_FILA";

export type Marka = {
  kolumna: Kolumna | string;
  oras: string | null;
  oras_orariu: string | null;
  /** Only meaningful on arrival (_TAMA) punches; null on departures. */
  atrazadu: boolean | null;
  foto: string | null;
  latitude: string | null;
  longitude: string | null;
  distansia_metru: number | null;
  iha_eskola: boolean | null;
};

export type LoronRecord = {
  data: string;
  loron: string;
  semana: number;
  /** Saturday — no afternoon session. */
  sabadu: boolean;
  oras_dader_tama: string | null;
  oras_dader_fila: string | null;
  oras_lorokraik_tama: string | null;
  oras_lorokraik_fila: string | null;
  status: Status | null;
  status_display: string | null;
  obs: string | null;
  marka: Marka[];
};

export type Rezumu = {
  loron_servisu: number;
  marka_ona: number;
  seidauk_marka: number;
  marka_total: number;
  atrazadu: number;
};

export type IstoriaResponse = {
  profesor: string;
  fulan: number;
  fulan_display: string;
  tinan: number;
  semana: number | null;
  rezumu: Rezumu;
  loron: LoronRecord[];
};

export type IstoriaParams = {
  fulan?: number;
  tinan?: number;
  semana?: number;
};

export const FULAN_TETUN = [
  "Janeiru",
  "Fevereiru",
  "Marsu",
  "Abril",
  "Maiu",
  "Juñu",
  "Jullu",
  "Agostu",
  "Setembru",
  "Outubru",
  "Novembru",
  "Dezembru",
];

/** 1-based month number → Tetun name. */
export const fulanName = (fulan: number) => FULAN_TETUN[fulan - 1] ?? String(fulan);

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/** "08:03:00" → "08:03". Null stays null so the UI can render its own dash. */
export function formatOras(value?: string | null): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const [hours, minutes] = value.split(":");
  if (hours === undefined || minutes === undefined) return value;

  return `${hours.padStart(2, "0")}:${minutes.slice(0, 2)}`;
}

/** "2026-02-18" → "18/02". */
export function formatLoronShort(iso?: string | null): string {
  if (typeof iso !== "string" || iso.length < 10) return "";
  const [, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}`;
}

/* ------------------------------------------------------------------ *
 * Slot view model — the four columns of the paper book
 * ------------------------------------------------------------------ */

export type SlotView = {
  kolumna: Kolumna;
  /** "Tama" (arrival) or "Fila" (departure). */
  label: string;
  oras: string | null;
  orasOrariu: string | null;
  atrazadu: boolean;
  /** Saturday afternoon: render "—" rather than an empty slot. */
  laiha: boolean;
};

export type SesaunView = {
  key: "dader" | "lorokraik";
  label: string;
  slots: SlotView[];
};

const SLOT_FIELDS: Record<Kolumna, keyof LoronRecord> = {
  ORAS_DADER_TAMA: "oras_dader_tama",
  ORAS_DADER_FILA: "oras_dader_fila",
  ORAS_LOROKRAIK_TAMA: "oras_lorokraik_tama",
  ORAS_LOROKRAIK_FILA: "oras_lorokraik_fila",
};

function buildSlot(day: LoronRecord, kolumna: Kolumna, label: string): SlotView {
  const raw = day[SLOT_FIELDS[kolumna]];
  const marka = day.marka?.find((m) => m.kolumna === kolumna);

  // Saturday has no afternoon session at all.
  const laiha = day.sabadu && kolumna.includes("LOROKRAIK");

  return {
    kolumna,
    label,
    oras: formatOras(typeof raw === "string" ? raw : (marka?.oras ?? null)),
    orasOrariu: formatOras(marka?.oras_orariu),
    // atrazadu is null on departures — coerce so the UI never flags one.
    atrazadu: kolumna.endsWith("TAMA") ? marka?.atrazadu === true : false,
    laiha,
  };
}

/** The two sessions of a day, each with its arrival and departure slot. */
export function buildSesaun(day: LoronRecord): SesaunView[] {
  return [
    {
      key: "dader",
      label: "Dader",
      slots: [
        buildSlot(day, "ORAS_DADER_TAMA", "Tama"),
        buildSlot(day, "ORAS_DADER_FILA", "Fila"),
      ],
    },
    {
      key: "lorokraik",
      label: "Lorokraik",
      slots: [
        buildSlot(day, "ORAS_LOROKRAIK_TAMA", "Tama"),
        buildSlot(day, "ORAS_LOROKRAIK_FILA", "Fila"),
      ],
    },
  ];
}

/** A day with no punches at all — the gaps this screen exists to show. */
export const seidaukMarka = (day: LoronRecord) => !day.marka?.length;

/** Any late arrival on this day. */
export const ihaAtrazadu = (day: LoronRecord) =>
  !!day.marka?.some((m) => m.atrazadu === true);

/* ------------------------------------------------------------------ *
 * Fetch
 * ------------------------------------------------------------------ */

export class IstoriaError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/**
 * GET /api/prezensa/istoria/ — one month (or one week of it) for the signed-in
 * teacher. The trailing slash matters: without it Django 301-redirects and the
 * Authorization header can be dropped on the hop.
 */
export async function fetchIstoria(
  params: IstoriaParams = {},
): Promise<IstoriaResponse> {
  try {
    const { data } = await api.get<IstoriaResponse>(
      PREZENSA_ENDPOINTS.istoria,
      { params },
    );

    return {
      ...data,
      loron: Array.isArray(data?.loron) ? data.loron : [],
    };
  } catch (error: any) {
    const body = error?.response?.data;

    // 400 { detail, code: "invalid_period" } — surface the server's wording.
    if (body?.detail) throw new IstoriaError(body.detail, body.code);
    throw error;
  }
}
