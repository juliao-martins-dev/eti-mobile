import { isRunningInExpoGo } from "expo";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { fetchKonfig, timeToMinutes, type Konfig } from "./konfig";

const CHANNEL_ID = "prezensa-lembra";

/** `data.slot` on a test notification, so it is never mistaken for a real one. */
export const TEST_SLOT = "testa";

/** How long before the scheduled time the reminder fires. */
export const LEAD_MINUTES = 10;

/**
 * `weekday` in expo-notifications is 1 = Sunday … 7 = Saturday.
 * Sunday is not a working day for the school, so it never appears here.
 */
const SEGUNDA_TO_SESTA = [2, 3, 4, 5, 6];
const SABADU = 7;

type Slot = {
  key: string;
  /** The konfig field holding this slot's scheduled time. */
  field: keyof Pick<
    Konfig,
    | "oras_dader_tama"
    | "oras_dader_fila"
    | "oras_lorokraik_tama"
    | "oras_lorokraik_fila"
  >;
  title: string;
  body: string;
  /** Afternoon slots — Saturday has no afternoon session. */
  lorokraik: boolean;
};

const SLOTS: Slot[] = [
  {
    key: "dader-tama",
    field: "oras_dader_tama",
    title: "Oras tama servisu",
    body: "Labele haluhan halo checkin ba oras tama servisu nian.",
    lorokraik: false,
  },
  {
    key: "dader-fila",
    field: "oras_dader_fila",
    title: "Oras deskansa meudia",
    body: "Labele haluhan halo checkout ba oras deskansa meudia.",
    lorokraik: false,
  },
  {
    key: "lorokraik-tama",
    field: "oras_lorokraik_tama",
    title: "Kontinuasaun servisu",
    body: "Labele haluhan halo checkin ba oras kontinuasaun servisu meudia.",
    lorokraik: true,
  },
  {
    key: "lorokraik-fila",
    field: "oras_lorokraik_fila",
    title: "Oras sai servisu",
    body: "Labele haluhan halo checkout ba oras sai servisu.",
    lorokraik: true,
  },
];

/** Show reminders even while the app is open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ------------------------------------------------------------------ *
 * Channel
 *
 * One channel for everything this app posts — reminders and punch results
 * alike — so both get the same HIGH importance and heads-up banner.
 *
 * Created at module load rather than inside scheduleReminders(): that put it
 * behind the permission gate, so a teacher who refused once had no channel at
 * all, and every later notification fell back to Expo's default.
 * ------------------------------------------------------------------ */

let channelReady: Promise<void> | null = null;

export function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();

  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Lembra prezensa",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#007AFF",
  })
    .then(() => {})
    .catch(() => {
      // Notifications unavailable here; posting will fail loudly enough.
    });

  return channelReady;
}

// Android drops a notification posted to a channel that does not exist yet.
ensureChannel();

/**
 * Shows a notification immediately (trigger `null`).
 *
 * Used for punch results, so the outcome reaches the phone's tray as well as
 * the in-app list. Never throws: a missing permission must not turn a
 * successful punch into a visible failure.
 */
export async function notifyNow(title: string, body: string): Promise<void> {
  try {
    await ensureChannel();

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        // Without this Android posts silently into the drawer instead of
        // showing a heads-up banner.
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      // A bare `null` means "now", but also "no channel", which dropped punch
      // results onto Expo's default channel. This form means "now, on ours".
      trigger:
        Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    // Permission refused or unsupported — the in-app feed still has it.
  }
}

/**
 * Posts a reminder in `seconds`, for checking delivery without waiting until
 * 07:50. Carries `data.slot` so it travels the same path a real reminder does,
 * proving the feed as well as the tray.
 */
export async function scheduleTestReminder(seconds = 60): Promise<boolean> {
  if (!(await ensurePermission())) return false;

  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Testa lembra prezensa",
      body: "Se ita simu mensajen ne'e, lembra prezensa funsiona iha telefone ne'e.",
      data: { slot: TEST_SLOT },
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: CHANNEL_ID,
    },
  });

  return true;
}

/* ------------------------------------------------------------------ *
 * Recovering reminders the app was not running to see
 *
 * `addNotificationReceivedListener` only fires while the app is in the
 * foreground. A reminder that goes off with the app closed or backgrounded
 * still reaches the phone, so these read it back from the OS on the next
 * launch and let the in-app list catch up.
 * ------------------------------------------------------------------ */

export type DeliveredReminder = {
  /** `slot.key` from SLOTS, e.g. "dader-tama". */
  slot: string;
  title: string;
  body: string;
  /** When the OS delivered it, in milliseconds. */
  date: number;
};

/** Only reminders carry `data.slot`; punch results are recorded elsewhere. */
function toReminder(
  notification: Notifications.Notification,
): DeliveredReminder[] {
  const { title, body, data } = notification.request.content;
  const slot = typeof data?.slot === "string" ? data.slot : null;
  if (!slot) return [];

  // Android has been seen reporting seconds here rather than milliseconds.
  const raw = notification.date;
  const date = raw > 1e12 ? raw : raw * 1000;

  return [
    {
      slot,
      title: title ?? "Lembra prezensa",
      body: body ?? "",
      date: Number.isFinite(date) ? date : Date.now(),
    },
  ];
}

/** Reminders still sitting in the phone's tray. */
export async function deliveredReminders(): Promise<DeliveredReminder[]> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    return presented.flatMap(toReminder);
  } catch {
    // Unsupported platform, or nothing delivered.
    return [];
  }
}

/** The reminder the teacher tapped to open the app, if that is how they got here. */
export function tappedReminder(): DeliveredReminder | null {
  try {
    // The ...Async form is deprecated in expo-notifications 0.32.
    const response = Notifications.getLastNotificationResponse();
    if (!response) return null;

    return toReminder(response.notification)[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Forgets the last tap.
 *
 * The OS keeps returning the same response indefinitely, so without this a
 * reminder the teacher already cleared would reappear on the next foreground.
 */
export function clearTappedReminder(): void {
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Not supported here — the dedupe key still prevents duplicates.
  }
}

/** Clears everything already delivered to the phone's tray. */
export async function dismissDelivered(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Nothing delivered, or unsupported.
  }
}

/** "08:00:00" minus the lead time → {hour, minute}. */
export function reminderAt(scheduled: string): {
  hour: number;
  minute: number;
} {
  const minutes = Math.max(0, timeToMinutes(scheduled) - LEAD_MINUTES);
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 };
}

/** Every reminder that should exist, derived from the server's schedule. */
export function plannedReminders(konfig: Konfig) {
  const planned: {
    weekday: number;
    hour: number;
    minute: number;
    slot: Slot;
  }[] = [];

  for (const weekday of [...SEGUNDA_TO_SESTA, SABADU]) {
    for (const slot of SLOTS) {
      // No afternoon session on Saturday — the API refuses it as `no_session`.
      if (weekday === SABADU && slot.lorokraik) continue;

      const { hour, minute } = reminderAt(konfig[slot.field]);
      planned.push({ weekday, hour, minute, slot });
    }
  }

  return planned;
}

/**
 * Whether the app may post notifications.
 *
 * `granted` alone is not enough on iOS: provisional authorisation delivers
 * quietly to the notification centre and reports `granted: false`. Reading only
 * `granted` made scheduleReminders() bail out and schedule nothing at all on
 * every iPhone in that state.
 */
export function isAllowed(
  status: Notifications.NotificationPermissionsStatus,
): boolean {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (isAllowed(current)) return true;

  if (!current.canAskAgain) return false;

  // Defaults to alert + sound + badge, which is what a reminder needs.
  const asked = await Notifications.requestPermissionsAsync();
  return isAllowed(asked);
}

/**
 * Cancels every reminder. Called on logout so a signed-out phone stops
 * nagging, and before each reschedule so nothing is ever duplicated.
 */
export async function cancelReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Notifications unavailable on this device — nothing to cancel.
  }
}

/**
 * The state of the reminders on *this* phone.
 *
 * Everything about scheduling happens inside the OS, so this reads it back:
 * whether notifications are allowed, how many alarms the system is holding,
 * and when each one next fires. `scheduleReminders()` swallows its failures so
 * a punch is never blocked, which also means a silent failure leaves no trace
 * — this is how to see one.
 */
export type ReminderDiagnostics = {
  /** Expo Go does not fully support expo-notifications; a build is needed. */
  expoGo: boolean;
  /** "granted" | "denied" | "undetermined" */
  permission: string;
  allowed: boolean;
  canAskAgain: boolean;
  /** How many alarms the OS is holding. Should be 22. */
  scheduled: number;
  /** Every held alarm, soonest first. */
  alarms: { title: string; weekday: number; hour: number; minute: number }[];
  /**
   * Minutes the device clock is ahead of Dili. Non-zero means every reminder
   * fires at the wrong moment relative to the school day.
   */
  desvioOras: number;
  /**
   * The Android channel's importance, read back from the OS. A channel that
   * does not exist, or that the teacher has turned down, silences every alarm
   * attached to it no matter how correctly it was scheduled — and Android
   * refuses to let the app raise it again once lowered.
   */
  channel: "laiha" | "kiik" | "HIGH" | "seluk";
};

/** Reads back the channel alarms are attached to, not the one we asked for. */
async function channelState(): Promise<ReminderDiagnostics["channel"]> {
  if (Platform.OS !== "android") return "HIGH";

  try {
    const channel = await Notifications.getNotificationChannelAsync(CHANNEL_ID);
    if (!channel) return "laiha";

    if (channel.importance >= Notifications.AndroidImportance.HIGH) return "HIGH";
    // MIN or NONE means the OS shows no banner, or nothing at all.
    if (channel.importance <= Notifications.AndroidImportance.LOW) return "kiik";

    return "seluk";
  } catch {
    return "seluk";
  }
}

/**
 * How far the device clock sits from the school's, in minutes.
 *
 * A weekly trigger carries only `weekday`, `hour` and `minute`, and Android
 * resolves them with `Calendar.getInstance()` — the device timezone. A phone
 * left on WIB fires "07:50" an hour off the school's 07:50, and no scheduling
 * option can correct it. All the app can do is notice and say so.
 */
export function desvioOrasDili(now: Date = new Date()): number {
  const dili = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dili",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const [hour, minute] = dili.split(":").map(Number);
  let diff = now.getHours() * 60 + now.getMinutes() - (hour * 60 + minute);

  // Normalise across midnight: the two clocks are never 23 hours apart.
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;

  return diff;
}

export async function reminderDiagnostics(): Promise<ReminderDiagnostics> {
  const status = await Notifications.getPermissionsAsync();

  let requests: Notifications.NotificationRequest[] = [];
  try {
    requests = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    // Unsupported platform — leave the list empty rather than throw.
  }

  const alarms = requests
    .map((request) => {
      const trigger = request.trigger as Partial<{
        weekday: number;
        hour: number;
        minute: number;
      }> | null;

      return {
        title: request.content.title ?? "",
        weekday: trigger?.weekday ?? 0,
        hour: trigger?.hour ?? 0,
        minute: trigger?.minute ?? 0,
      };
    })
    .sort((a, b) =>
      a.weekday - b.weekday || a.hour - b.hour || a.minute - b.minute,
    );

  return {
    expoGo: isRunningInExpoGo(),
    permission: status.status,
    allowed: isAllowed(status),
    canAskAgain: status.canAskAgain,
    scheduled: requests.length,
    alarms,
    desvioOras: desvioOrasDili(),
    channel: await channelState(),
  };
}

/**
 * Schedules the weekly check-in/check-out reminders.
 *
 * Times come from `GET /api/konfig/` minus {@link LEAD_MINUTES}, so a change
 * to the school's hours moves the reminders with it. Safe to call repeatedly:
 * it clears the previous set first.
 *
 * @returns how many reminders are now scheduled (0 if permission was refused).
 */
export async function scheduleReminders(): Promise<number> {
  // Every failure below used to be invisible: the caller swallows the error so
  // a punch is never blocked, so a phone with zero alarms looked exactly like
  // a phone with 22. One line per attempt, greppable in `expo start` output
  // and in `adb logcat -s ReactNativeJS`.
  const status = await Notifications.getPermissionsAsync();

  if (!isAllowed(status)) {
    if (!status.canAskAgain) {
      console.warn(
        `[lembra] refused: permission=${status.status}, canAskAgain=false — nothing scheduled`,
      );
      return 0;
    }

    const asked = await Notifications.requestPermissionsAsync();
    if (!isAllowed(asked)) {
      console.warn(
        `[lembra] refused: permission=${asked.status} after asking — nothing scheduled`,
      );
      return 0;
    }
  }

  // Everything slow happens BEFORE anything is destroyed. fetchKonfig() is a
  // real request — 12s timeout, and again on the second host after a failover.
  // Cancelling first left the phone holding zero alarms for that whole window,
  // and a teacher who opened the app off-network and switched away had them
  // wiped with nothing scheduled in their place.
  const konfig = await fetchKonfig();
  const planned = plannedReminders(konfig);

  await ensureChannel();
  await cancelReminders();

  for (const { weekday, hour, minute, slot } of planned) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: slot.title,
        body: slot.body,
        data: { slot: slot.key, weekday },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });
  }

  // What the OS says it is holding, not what we believe we sent. A mismatch
  // here is the difference between "our bug" and "the phone dropped them".
  let held = -1;
  try {
    held = (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    // Unsupported — leave it as -1 so the log says "unknown", not "zero".
  }

  const desvio = desvioOrasDili();
  const oras = [
    konfig.oras_dader_tama,
    konfig.oras_dader_fila,
    konfig.oras_lorokraik_tama,
    konfig.oras_lorokraik_fila,
  ].join(" ");

  console.warn(
    `[lembra] planned=${planned.length} heldByOS=${held} ` +
      `expoGo=${isRunningInExpoGo()} tzOffsetVsDili=${desvio}min konfig=[${oras}]`,
  );

  return planned.length;
}
