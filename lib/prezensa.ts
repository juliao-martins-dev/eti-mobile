import * as SecureStore from "expo-secure-store";

import { api } from "./api";
import { PREZENSA_ENDPOINTS } from "./config";

export type ClockMode = "in" | "out";
export type PeriodCode = keyof typeof SCHEDULED_TIMES;

/**
 * Scheduled times per column, mirroring the backend constants. `oras_orariu`
 * in the response is the server's copy of these — the backend stays the
 * authority on lateness (`atrazadu`); these drive the client-side session split.
 */
export const SCHEDULED_TIMES = {
  ORAS_DADER_TAMA: "08:00",
  ORAS_DADER_FILA: "12:00",
  ORAS_LOROKRAIK_TAMA: "13:30",
  ORAS_LOROKRAIK_FILA: "17:30",
} as const;

/**
 * Expected window for each column, for reference and the "sedu/atrazadu" hint.
 * These are NOT used to pick the column — the backend accepts punches outside
 * them (a 16:05 checkout was filed under ORAS_LOROKRAIK_FILA) and flags
 * lateness itself via `atrazadu`.
 */
export const PERIOD_WINDOWS = {
  ORAS_DADER_TAMA: { start: "08:00", end: "10:00" },
  ORAS_DADER_FILA: { start: "12:00", end: "13:30" },
  ORAS_LOROKRAIK_TAMA: { start: "13:30", end: "17:30" },
  ORAS_LOROKRAIK_FILA: { start: "17:30", end: "23:59" },
} as const satisfies Record<PeriodCode, { start: string; end: string }>;

/**
 * Boundary between the dader and lorokraik sessions, at the afternoon open.
 * Everything before 13:30 files against the morning columns (08:00 checkin,
 * 12:00 checkout); from 13:30 on, the afternoon ones. This reproduces the
 * observed backend behaviour for both an 15:38 checkin and a 16:05 checkout.
 */
const AFTERNOON_START_HOUR = 13;
const AFTERNOON_START_MINUTE = 30;

/** Matches `marka_foun.foto` in the backend's response payload. */
const PHOTO_FIELD = "foto";

/**
 * Form field carrying the period code. Postman confirms the API needs only
 * foto/latitude/longitude and derives the column itself, so this is an
 * ignored extra — kept because the mapping is part of the agreed contract.
 */
const PERIOD_FIELD = "periodu";

export const PERIOD_CODES = {
  in: { morning: "ORAS_DADER_TAMA", afternoon: "ORAS_LOROKRAIK_TAMA" },
  out: { morning: "ORAS_DADER_FILA", afternoon: "ORAS_LOROKRAIK_FILA" },
} as const satisfies Record<ClockMode, Record<string, PeriodCode>>;

/** Before 13:30 → *_DADER_*, from 13:30 → *_LOROKRAIK_*. */
export function resolvePeriod(
  mode: ClockMode,
  date: Date = new Date(),
): PeriodCode {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const boundary = AFTERNOON_START_HOUR * 60 + AFTERNOON_START_MINUTE;

  return PERIOD_CODES[mode][minutes < boundary ? "morning" : "afternoon"];
}

/** Scheduled time ("08:00") the current punch is measured against. */
export function scheduledTimeFor(
  mode: ClockMode,
  date: Date = new Date(),
): string {
  return SCHEDULED_TIMES[resolvePeriod(mode, date)];
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Whether the punch falls inside its column's expected window. Informational —
 * the backend is the authority and accepts out-of-window punches.
 */
export function isWithinWindow(
  mode: ClockMode,
  date: Date = new Date(),
): boolean {
  const { start, end } = PERIOD_WINDOWS[resolvePeriod(mode, date)];
  const minutes = date.getHours() * 60 + date.getMinutes();

  return minutes >= toMinutes(start) && minutes <= toMinutes(end);
}

export type ClockResult = {
  mode: ClockMode;
  periodu: string;
  time: string;
  data: unknown;
};

/** POST /api/prezensa/checkin/ or /checkout/ with the captured photo. */
export type ClockCoords = { latitude: number; longitude: number };

export async function clock(
  mode: ClockMode,
  photoUri?: string | null,
  coords?: ClockCoords | null,
): Promise<ClockResult> {
  const now = new Date();
  const periodu = resolvePeriod(mode, now);

  const formData = new FormData();
  formData.append(PERIOD_FIELD, periodu);

  if (photoUri) {
    formData.append(PHOTO_FIELD, {
      uri: photoUri,
      name: "punch.jpg",
      type: "image/jpeg",
    } as any);
  }

  if (coords) {
    formData.append("latitude", String(coords.latitude));
    formData.append("longitude", String(coords.longitude));
  }

  const url =
    mode === "in" ? PREZENSA_ENDPOINTS.clockIn : PREZENSA_ENDPOINTS.clockOut;

  console.log(
    `[prezensa] POST ${url} periodu=${periodu} lat=${coords?.latitude ?? "none"}` +
      ` lng=${coords?.longitude ?? "none"} foto=${photoUri ?? "none"}`,
  );

  // Content-Type is intentionally omitted — the request interceptor strips it
  // so React Native can attach the multipart boundary itself.
  // Photo uploads need far more headroom than the 20s default.
  const { data } = await api.post(url, formData, {
    transformRequest: (value) => value,
    timeout: 60000,
  });

  const time = formatClockTime(now);
  await rememberToday(mode, time);

  return { mode, periodu, time, data };
}

export function formatClockTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/* ------------------------------------------------------------------ *
 * Local cache of today's stamps.
 *
 * The API contract provided covers checkin/checkout only — there is no
 * read endpoint for today's record yet. Swap this for a GET once one exists.
 * ------------------------------------------------------------------ */

const TODAY_KEY = "prezensa_today";

export type TodayAttendance = {
  day: string;
  clockIn: string | null;
  clockOut: string | null;
};

const todayKey = (date: Date = new Date()) => date.toDateString();

export async function getTodayAttendance(): Promise<TodayAttendance | null> {
  try {
    const raw = await SecureStore.getItemAsync(TODAY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TodayAttendance;
    return parsed.day === todayKey() ? parsed : null;
  } catch {
    return null;
  }
}

async function rememberToday(mode: ClockMode, time: string) {
  const current = (await getTodayAttendance()) ?? {
    day: todayKey(),
    clockIn: null,
    clockOut: null,
  };

  const next: TodayAttendance = {
    ...current,
    day: todayKey(),
    ...(mode === "in" ? { clockIn: time } : { clockOut: time }),
  };

  try {
    await SecureStore.setItemAsync(TODAY_KEY, JSON.stringify(next));
  } catch {
    // Non-critical cache.
  }
}
