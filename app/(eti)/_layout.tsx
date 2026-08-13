import * as Notifications from "expo-notifications";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";

import {
  backfillReminders,
  badgeValue,
  recordReminder,
  syncDeliveredReminders,
  useUnreadCount,
} from "@/lib/feed";
import { scheduleReminders } from "@/lib/notifications";

export default function RootLayout() {
  // Live count — updates on a new punch result, a fired reminder, the list
  // being opened, and clear-all. Undefined at zero so no empty badge shows.
  const unread = useUnreadCount();
  // Reschedule once the teacher is inside the app. Idempotent, and it picks up
  // any change to the school's hours from /api/konfig/.
  useEffect(() => {
    scheduleReminders().catch(() => {
      // Permission refused or notifications unavailable — not fatal.
    });
  }, []);

  // Mirror fired reminders into the in-app list. Punch results are recorded at
  // the point of the request instead, so they are not duplicated here.
  useEffect(() => {
    const record = (notification: Notifications.Notification) => {
      const { title, body, data } = notification.request.content;
      if (typeof data?.slot !== "string") return;

      recordReminder(
        title ?? "Lembra prezensa",
        body ?? "",
        data.slot,
        new Date(),
      ).catch(() => {});
    };

    // Fired while the app is in the foreground.
    const received = Notifications.addNotificationReceivedListener(record);

    // Tapped from the tray — the app may have been backgrounded or closed.
    const responded = Notifications.addNotificationResponseReceivedListener(
      (response) => record(response.notification),
    );

    return () => {
      received.remove();
      responded.remove();
    };
  }, []);

  // Neither listener above runs while the app is closed or in the background,
  // so on launch and on every return to the foreground the list catches up
  // from the phone's own tray. Deduplicated per slot per day.
  useEffect(() => {
    const catchUp = () => {
      // Belt: derived from the schedule, so it works even when the tray was
      // emptied. Braces: the tray still carries anything the schedule cannot
      // know about, such as a test reminder.
      backfillReminders().catch(() => {
        // Konfig unreachable — the next foreground tries again.
      });

      syncDeliveredReminders().catch(() => {
        // Nothing delivered, or notifications unavailable.
      });
    };

    catchUp();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") catchUp();
    });

    return () => subscription.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Veranda",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Historia",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notification"
        options={{
          title: "Notifikasaun",
          tabBarBadge: badgeValue(unread),
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
