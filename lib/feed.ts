import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { formatOras } from "./istoria";
import { fetchKonfig } from "./konfig";
import {
  clearTappedReminder,
  deliveredReminders,
  plannedReminders,
  tappedReminder,
} from "./notifications";
import {
  PrezensaError,
  type MarkaResult,
  type MarkaTipu,
} from "./prezensa";

const FEED_KEY = "notif_feed";

/** Newest entries kept; older ones fall off the end. */
const MAX_ITEMS = 100;

export type FeedKind = "PREZENSA" | "LEMBRA";
export type FeedLevel = "success" | "warning" | "info";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  level: FeedLevel;
  title: string;
  message: string;
  /** ISO timestamp of when it happened. */
  at: string;
  unread: boolean;
  /**
   * Identity of the underlying event, when one exists. A reminder can reach
   * the feed from three directions — fired in the foreground, found in the
   * tray on the next launch, or tapped open — and this is what stops the same
   * 07:50 alarm being listed three times.
   */
  key?: string;
};

/** Dedupe key for a reminder: one entry per slot per day. */
export const reminderKey = (slot: string, at: Date) =>
  `LEMBRA:${slot}:${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;

/** Maps a feed level onto the icon set NotificationCard already understands. */
export const feedIcon = (level: FeedLevel) =>
  level === "success"
    ? ("success" as const)
    : level === "warning"
      ? ("warning" as const)
      : ("announcement" as const);

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Change notification
 *
 * The tab badge lives in the layout while the data lives here, so every
 * mutation announces itself rather than the UI polling for changes.
 * ------------------------------------------------------------------ */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Returns an unsubscribe function. */
export function subscribeFeed(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others.
    }
  });
}

/** How many entries the teacher has not seen yet. */
export async function unreadCount(): Promise<number> {
  const items = await getFeed();
  return items.filter((item) => item.unread).length;
}

export async function getFeed(): Promise<FeedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(FEED_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeedItem[]) : [];
  } catch {
    return [];
  }
}

async function write(items: FeedItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FEED_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // A full disk must never break a punch.
  }
}

/**
 * Prepends an entry — newest first.
 *
 * An item carrying a `key` that is already in the feed is not added again; the
 * stored entry is returned untouched, so a re-run is always safe.
 */
export async function appendFeed(
  item: Omit<FeedItem, "id" | "at" | "unread"> & { at?: string },
): Promise<FeedItem> {
  const items = await getFeed();

  if (item.key) {
    const existing = items.find((stored) => stored.key === item.key);
    if (existing) return existing;
  }

  const entry: FeedItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: item.at ?? new Date().toISOString(),
    unread: true,
  };

  // Keep the list in time order — a tray entry recovered on launch is older
  // than whatever happened while the app was running.
  const next = [entry, ...items].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );

  await write(next);
  announce();

  return entry;
}

export async function markAllRead(): Promise<void> {
  const items = await getFeed();
  if (!items.some((item) => item.unread)) return;

  await write(items.map((item) => ({ ...item, unread: false })));
  announce();
}

/** Wipes the list. Also used on logout — a shared phone must not leak history. */
export async function clearFeed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FEED_KEY);
  } catch {
    // Nothing to do; the next write overwrites it anyway.
  }

  announce();
}

/* ------------------------------------------------------------------ *
 * Messages — derived from what the endpoint actually returned
 * ------------------------------------------------------------------ */

type Composed = { level: FeedLevel; title: string; message: string };

const tipuLabel = (tipu: MarkaTipu) =>
  tipu === "checkin" ? "Checkin" : "Checkout";

/** Reads the recorded time and lateness out of a marka response. */
function readMarkaFoun(data: unknown) {
  const body = (data ?? {}) as Record<string, any>;
  const marka = body.marka_foun ?? {};

  return {
    oras: formatOras(marka.oras ?? body.oras ?? null),
    orasOrariu: formatOras(marka.oras_orariu ?? null),
    atrazadu: marka.atrazadu === true,
  };
}

/** A successful marka, or a `duplicate` the server already had on file. */
export function composeMarkaSuccess(result: MarkaResult): Composed {
  const label = tipuLabel(result.tipu);

  if (result.duplicate) {
    return {
      level: "info",
      title: "Prezensa rejistu ona",
      message: `Marka ne'e rejistu tiha ona ba sesaun ne'e.`,
    };
  }

  const { oras, orasOrariu, atrazadu } = readMarkaFoun(result.data);
  const when = oras ? ` iha ${oras}` : "";

  // Lateness is the server's verdict, never a time this phone computed.
  const late =
    atrazadu && orasOrariu ? ` Atrazadu — orariu ${orasOrariu}.` : "";

  return {
    level: atrazadu ? "warning" : "success",
    title: `${label} susesu`,
    message: `${label} rejistu${when}.${late}`,
  };
}

/** A refusal the server explained, or a local failure before it was reached. */
export function composeMarkaFailure(
  tipu: MarkaTipu,
  error: unknown,
): Composed {
  const label = tipuLabel(tipu);

  if (error instanceof PrezensaError) {
    switch (error.code) {
      case "no_checkin":
        return {
          level: "warning",
          title: "Presiza checkin uluk",
          message: "Labele halo checkout molok halo checkin.",
        };

      case "no_session":
        return {
          level: "warning",
          title: "Laiha sesaun",
          message: "Sábadu laiha sesaun lorokraik.",
        };

      case "dook_husi_eskola": {
        const metres =
          typeof error.distansia === "number"
            ? ` Ita iha ${Math.round(error.distansia)} metru husi eskola.`
            : "";
        return {
          level: "warning",
          title: "Dook husi eskola",
          message: `Presiza besik liu ba eskola atu marka.${metres}`,
        };
      }

      default:
        // The server's own Tetun wording is already user-facing.
        return {
          level: "warning",
          title: `${label} la susesu`,
          message: error.message,
        };
    }
  }

  const message =
    error instanceof Error && error.message
      ? error.message
      : "Marka la haruka. Verifika koneksaun no koko fila fali.";

  return { level: "warning", title: `${label} la susesu`, message };
}

/** Records a marka outcome and returns the entry that was stored. */
export const recordMarkaSuccess = (result: MarkaResult) =>
  appendFeed({ kind: "PREZENSA", ...composeMarkaSuccess(result) });

export const recordMarkaFailure = (tipu: MarkaTipu, error: unknown) =>
  appendFeed({ kind: "PREZENSA", ...composeMarkaFailure(tipu, error) });

/**
 * Records a reminder that fired, so the list shows it alongside results.
 *
 * `slot` and `at` make the entry idempotent: the same alarm recorded twice —
 * once live, once recovered from the tray — produces one row.
 */
export const recordReminder = (
  title: string,
  message: string,
  slot?: string,
  at: Date = new Date(),
) =>
  appendFeed({
    kind: "LEMBRA",
    level: "info",
    title,
    message,
    at: at.toISOString(),
    ...(slot ? { key: reminderKey(slot, at) } : {}),
  });

/**
 * Catches the list up on reminders that fired while the app was closed or in
 * the background, which the foreground listener could not see.
 *
 * Reads the phone's own tray, so an entry only appears if the OS really
 * delivered it. Safe to call on every launch and every return to foreground.
 *
 * @returns how many entries were new.
 */
/**
 * Fills `Fo hanoin` from the schedule itself, without asking the OS anything.
 *
 * The tray sync below can only see reminders still sitting in the tray, so a
 * reminder that fired while the app was closed and was then swiped away — or
 * cleared by "Hamoos notifikasaun hotu", which empties the tray — could never
 * reach the list. That is why the tab was permanently empty.
 *
 * This walks today's planned reminders and records every one whose time has
 * already passed. Times come from `GET /api/konfig/` minus the lead, so
 * nothing here is hardcoded, and Saturday's missing afternoon is respected
 * because plannedReminders() already encodes it.
 *
 * Idempotent: `reminderKey(slot, at)` is one entry per slot per day, shared
 * with the listener and the tray path, so an alarm seen twice is listed once.
 *
 * @returns how many entries were new.
 */
export async function backfillReminders(
  now: Date = new Date(),
): Promise<number> {
  const konfig = await fetchKonfig();

  // expo-notifications weekdays are 1 = Sunday; JS getDay() is 0 = Sunday.
  const weekday = now.getDay() + 1;
  const today = plannedReminders(konfig).filter(
    (planned) => planned.weekday === weekday,
  );

  const before = (await getFeed()).length;

  for (const { hour, minute, slot } of today) {
    const at = new Date(now);
    at.setHours(hour, minute, 0, 0);

    // Still to come today — recording it now would be a lie.
    if (at.getTime() > now.getTime()) continue;

    await recordReminder(slot.title, slot.body, slot.key, at);
  }

  return (await getFeed()).length - before;
}

export async function syncDeliveredReminders(): Promise<number> {
  const tapped = tappedReminder();
  const delivered = await deliveredReminders();

  // Consume the tap: the OS replays it forever otherwise, which would undo a
  // clear-all on the next foreground.
  if (tapped) clearTappedReminder();

  const all = tapped ? [...delivered, tapped] : delivered;
  if (!all.length) return 0;

  const before = (await getFeed()).length;

  for (const reminder of all) {
    await recordReminder(
      reminder.title,
      reminder.body,
      reminder.slot,
      new Date(reminder.date),
    );
  }

  return (await getFeed()).length - before;
}

/* ------------------------------------------------------------------ *
 * Display
 * ------------------------------------------------------------------ */

/**
 * Live unread count for the tab badge. Re-reads on every feed mutation —
 * a new punch result, a fired reminder, the list being viewed, or clear-all —
 * so no polling is involved.
 */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const refresh = () => {
      unreadCount()
        .then((next) => {
          if (isMounted) setCount(next);
        })
        .catch(() => {});
    };

    refresh();
    const unsubscribe = subscribeFeed(refresh);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return count;
}

/** Badge label: hidden at zero, capped so it never widens the tab bar. */
export function badgeValue(count: number): number | string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : count;
}

/** "Ohin · 07:58", "Horiseik · 17:05", or "12/08 · 08:03". */
export function formatFeedTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(at.getHours())}:${pad(at.getMinutes())}`;

  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((midnight.getTime() - startOfDay(at).getTime()) / 86400000);

  if (days <= 0) return `Ohin · ${clock}`;
  if (days === 1) return `Horiseik · ${clock}`;

  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)} · ${clock}`;
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
