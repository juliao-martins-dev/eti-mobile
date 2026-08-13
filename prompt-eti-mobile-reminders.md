# Prompt ba Claude Code — eti-mobile notification reminders

---

We are fixing the local reminder notifications in this Expo app (`eti-mobile`,
Expo 54, expo-router 6, expo-notifications 0.32). Before writing any code, use
the debugging skill: investigate and show me the root cause first. Do not start
editing until I approve the plan.

## What works today

Check-in and check-out results already work end to end. `lib/prezensa.ts` calls
the API, `lib/feed.ts` records the outcome, and `notifyNow()` in
`lib/notifications.ts` posts it to the phone's tray. The `Prezensa` tab of
`app/(eti)/notification.tsx` shows those entries correctly. Keep this behaviour.

## What is broken

The `Fo hanoin` tab (`kind: "LEMBRA"`) is always empty, and I never see the
scheduled reminders in the Android notification tray.

## What the reminders must be

The schedule is already correct — `LEAD_MINUTES = 10` applied to the times from
`GET /api/konfig/`. Verify it, do not redesign it, and do not hardcode times:

| Sesaun    | Slot            | Konfig field          | Scheduled | Reminder |
| --------- | --------------- | --------------------- | --------- | -------- |
| Dader     | Tama (checkin)  | `oras_dader_tama`     | 08:00     | 07:50    |
| Dader     | Fila (checkout) | `oras_dader_fila`     | 12:00     | 11:50    |
| Lorokraik | Tama (checkin)  | `oras_lorokraik_tama` | 13:30     | 13:20    |
| Lorokraik | Fila (checkout) | `oras_lorokraik_fila` | 17:30     | 17:20    |

Monday–Friday all four slots; Saturday morning only (no afternoon session) — 22
weekly alarms in total. Keep all user-facing copy in Tetun exactly as it is in
`SLOTS`.

## Root causes I want you to confirm or refute

1. **The feed depends on the tray surviving.** `syncDeliveredReminders()` in
   `lib/feed.ts` reads `getPresentedNotificationsAsync()`, which only returns
   notifications _still present_ in the tray. If a reminder fires while the app
   is closed and the teacher swipes it away — or presses "Hamoos notifikasaun
   hotu", which calls `dismissDelivered()` — that reminder can never reach the
   feed. I believe this is why `Fo hanoin` is permanently empty.
2. **No visibility into whether the alarms exist.** `reminderDiagnostics()` in
   `lib/notifications.ts` is written but never called from anywhere, so I cannot
   tell whether the OS is actually holding 22 alarms, or whether
   `scheduleReminders()` silently returned 0 because permission was refused.
3. **Channel inconsistency.** `scheduleReminders()` creates the
   `prezensa-lembra` channel with `AndroidImportance.HIGH` and passes
   `channelId` in the trigger, but `notifyNow()` passes no `channelId` at all,
   so punch results land on a different channel. Check whether the reminder
   channel is created early enough, and whether the notification content needs
   `AndroidNotificationPriority.HIGH` for a heads-up banner.
4. **Runtime environment.** Report which of these applies to me: Expo Go still
   supports _local_ scheduled notifications (only remote push was removed on
   Android from SDK 53), but behaviour when the app is killed is not reliable
   there, and Android does not restore scheduled alarms after a reboot. Tell me
   plainly whether I need `npx expo run:android` / an EAS development build to
   test this properly, and what I can and cannot verify inside Expo Go.

## What I want built

1. **Make the feed independent of the tray.** On launch and on every return to
   foreground, backfill `Fo hanoin` deterministically: compute every reminder
   time for today that has already passed (from konfig minus `LEAD_MINUTES`,
   respecting the weekday and Saturday rules) and append a `LEMBRA` entry for
   each. Reuse the existing `reminderKey(slot, at)` dedupe so this is idempotent
   and cannot double-list an alarm that also arrived via the listener or the
   tray. Keep the existing tray-sync path as well — belt and braces.
2. **Make sure the reminder reaches the Android tray**, with a heads-up banner,
   while the app is in the foreground, in the background, and killed. Use a
   single consistent channel strategy for both reminders and punch results.
3. **Surface the diagnostics.** Add a developer panel — hidden behind a long
   press on the version row in `app/(eti)/profile.tsx` is fine — that shows
   `reminderDiagnostics()`: running in Expo Go yes/no, permission status,
   whether notifications are allowed, how many alarms the OS holds, and the
   resolved reminder times for each of the 22 alarms. Add a "Test reminder in 60
   seconds" button so I can verify delivery without waiting until 07:50.
4. **Fix the empty state.** `EmptyNotification` currently says
   "Notifikasaun eskola sei mosu iha ne'e" on every tab, including `Fo hanoin`.
   Give each tab its own Tetun empty message.

## Constraints

- Do not change the check-in/check-out flow, the API client, or the token logic.
- Do not add a backend dependency — these reminders stay local.
- Do not hardcode any time; everything comes from `GET /api/konfig/`.
- Tetun stays Tetun. No English strings in the UI.
- TypeScript strict; keep the existing comment style, which explains _why_.
- Note explicitly if the device timezone differs from Dili (UTC+9) and what that
  does to a weekly trigger.

## How I want to work

Investigate first and report the root cause with the file and line that proves
it. Then write a plan and wait for my approval. Then implement. Then tell me
exactly what to do on my phone to verify each of the four items above.

---

## Oinsá uza ho Superpowers

Iha Claude Code, uza ordem tuir mai:

1. `/superpowers:brainstorm` + kola prompt iha leten.
   Nia sei husu perguntas antes kódigu ida deit hakerek.
2. Depois de dezeñu ok: `/superpowers:write-plan`
3. Depois aprova planu: `/superpowers:execute-plan`

Se lakohi uza slash command, bele mós hakerek deit:
"Use superpowers to debug and plan this before touching any file."
