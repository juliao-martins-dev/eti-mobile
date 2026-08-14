/**
 * Schedule maths for the check-in / check-out reminders.
 *
 * Runs the real lib/notifications.ts, compiled by `npm run test:reminders`,
 * with the native modules stubbed. No test runner and no new dependencies:
 * this logic decides when 22 alarms fire on every teacher's phone, and it was
 * previously only ever checked by hand.
 *
 * Usage: npm run test:reminders
 */

const Module = require("module");
const origLoad = Module._load;

Module._load = function (request) {
  if (request === "expo") return { isRunningInExpoGo: () => false };
  if (request === "expo-notifications") {
    return {
      __esModule: true,
      AndroidImportance: { HIGH: 4 },
      AndroidNotificationPriority: { HIGH: "high" },
      SchedulableTriggerInputTypes: { WEEKLY: "weekly", TIME_INTERVAL: "timeInterval" },
      IosAuthorizationStatus: { PROVISIONAL: 3 },
      setNotificationHandler: () => {},
      setNotificationChannelAsync: async () => {},
    };
  }
  if (request === "react-native") return { Platform: { OS: "android" } };
  if (request === "expo-secure-store")
    return { getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} };
  if (request === "expo-router") return { router: { replace: () => {} } };
  return origLoad.apply(this, arguments);
};

const OUT = process.env.REMINDERS_TEST_OUT || "./node_modules/.cache/reminders-test";
const N = require(require("path").resolve(OUT, "notifications.js"));
const K = require(require("path").resolve(OUT, "konfig.js"));

let failures = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "   " + extra : ""}`);
};

const hhmm = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** expo-notifications weekdays: 1 = Sunday … 7 = Saturday. */
const DOMINGU = 1;
const SEGUNDA = 2;
const SESTA = 6;
const SABADU = 7;

console.log("=== reminderAt: konfig time minus the 10 minute lead ===");
check(N.LEAD_MINUTES === 10, "lead is 10 minutes", String(N.LEAD_MINUTES));

for (const [scheduled, want] of [
  ["08:00:00", "07:50"],
  ["12:00:00", "11:50"],
  ["13:30:00", "13:20"],
  ["17:30:00", "17:20"],
]) {
  const { hour, minute } = N.reminderAt(scheduled);
  check(hhmm(hour, minute) === want, `${scheduled} -> ${want}`, hhmm(hour, minute));
}

// A schedule inside the first ten minutes of the day must not wrap to 23:5x.
const edge = N.reminderAt("00:05:00");
check(hhmm(edge.hour, edge.minute) === "00:00", "00:05 clamps to 00:00, no wrap", hhmm(edge.hour, edge.minute));

console.log("\n=== plannedReminders: the alarm table for a full week ===");
const planned = N.plannedReminders(K.KONFIG_FALLBACK);
check(planned.length === 22, "22 alarms: 5 weekdays x 4 slots + Saturday x 2", String(planned.length));

const forDay = (weekday) =>
  planned.filter((p) => p.weekday === weekday).map((p) => hhmm(p.hour, p.minute)).sort();

check(forDay(DOMINGU).length === 0, "Domingu: no session, no alarms");

for (let weekday = SEGUNDA; weekday <= SESTA; weekday++) {
  check(
    forDay(weekday).join() === "07:50,11:50,13:20,17:20",
    `weekday ${weekday}: 07:50 11:50 13:20 17:20`,
    forDay(weekday).join(),
  );
}

check(
  forDay(SABADU).join() === "07:50,11:50",
  "Sabadu: morning only, no lorokraik session",
  forDay(SABADU).join(),
);

console.log("\n=== each alarm keeps its Tetun copy and its slot marker ===");
check(
  planned.every((p) => p.slot.title && p.slot.body && p.slot.key),
  "every alarm carries title, body and key",
);
check(
  planned.filter((p) => p.weekday === SABADU).every((p) => !p.slot.lorokraik),
  "no lorokraik slot survives onto Saturday",
);

console.log("\n=== the schedule follows konfig, never a hardcoded time ===");
const moved = N.plannedReminders({
  ...K.KONFIG_FALLBACK,
  oras_dader_tama: "09:15:00",
  oras_lorokraik_fila: "16:00:00",
});
const monday = moved.filter((p) => p.weekday === SEGUNDA).map((p) => hhmm(p.hour, p.minute)).sort();
check(
  monday.join() === "09:05,11:50,13:20,15:50",
  "changing konfig moves the alarms with it",
  monday.join(),
);

console.log("\n=== desvioOrasDili: device clock against the school's ===");

// Node applies a runtime TZ change, so both cases run in one process and the
// npm script stays portable -- a TZ= prefix would not work on Windows.
const withTimezone = (zone, run) => {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
};

withTimezone("Asia/Dili", () => {
  const desvio = N.desvioOrasDili(new Date());
  check(desvio === 0, "a phone set to Dili reports no offset", String(desvio));
});

withTimezone("Asia/Jakarta", () => {
  // WIB is UTC+7 against Dili's UTC+9 -- two hours, not one.
  const desvio = N.desvioOrasDili(new Date());
  check(
    desvio === -120,
    "a phone left on Jakarta time reports -120min, so 07:50 would fire at 09:50 school time",
    String(desvio),
  );
});

withTimezone("UTC", () => {
  const desvio = N.desvioOrasDili(new Date());
  check(desvio === -540, "a phone on UTC reports -540min", String(desvio));
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
