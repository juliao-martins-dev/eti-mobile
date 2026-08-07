import { EmptyNotification } from "@/components/EmptyNotification";
import { NotificationCard } from "@/components/NotificationCard";
import { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TABS = [
  { key: "HOTU", label: "Hotu" },
  { key: "PRESENSA", label: "Presensa" },
  { key: "ESKOLA", label: "Eskola" },
];

type NotificationType = "HOTU" | "PRESENSA" | "ESKOLA";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  icon: "success" | "warning" | "announcement";
};

const notificationsMock: NotificationItem[] = [
  {
    id: "1",
    type: "PRESENSA",
    title: "Presensa Susesu",
    message: "Ita halo presensa tama ho susesu iha 07:56.",
    time: "Hoje · 07:58",
    unread: true,
    icon: "success",
  },
  {
    id: "2",
    type: "PRESENSA",
    title: "Presensa Atrasu",
    message: "Ita tama iha oras 08:15. Favor haree regulamentu.",
    time: "Hoje · 08:20",
    unread: true,
    icon: "warning",
  },
  {
    id: "3",
    type: "ESKOLA",
    title: "Avisu Eskola",
    message: "Reuniaun profesor sira iha Loron Kurta ba oni.",
    time: "Ontem · 11:30",
    unread: true,
    icon: "announcement",
  },
  {
    id: "4",
    type: "PRESENSA",
    title: "Presensa Susesu",
    message: "Ita halo presensa sai ho susesu loron Segunda.",
    time: "Segunda · 07:12",
    unread: false,
    icon: "success",
  },
];

export default function NotifikasaunScreen() {
  const [activeTab, setActiveTab] = useState<"HOTU" | "PRESENSA" | "ESKOLA">(
    "HOTU",
  );

  const filteredData =
    activeTab === "HOTU"
      ? notificationsMock
      : notificationsMock.filter((n) => n.type === activeTab);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key as any)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {filteredData.length === 0 ? (
        <EmptyNotification />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationCard {...item} />}
          contentContainerStyle={{ paddingTop: 16 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#2563EB",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
});
