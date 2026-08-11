import { EmptyNotification } from "@/components/EmptyNotification";
import { NotificationCard } from "@/components/NotificationCard";
import {
  clearFeed,
  feedIcon,
  formatFeedTime,
  getFeed,
  markAllRead,
  type FeedItem,
} from "@/lib/feed";
import { dismissDelivered } from "@/lib/notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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
  { key: "PREZENSA", label: "Prezensa" },
  { key: "LEMBRA", label: "Lembra" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function NotifikasaunScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("HOTU");
  const [items, setItems] = useState<FeedItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      getFeed().then((stored) => {
        if (!isMounted) return;

        setItems(stored);
        // Seen is seen — drop the unread dots once the list is on screen.
        markAllRead().catch(() => {});
      });

      return () => {
        isMounted = false;
      };
    }, []),
  );

  const handleClearAll = async () => {
    setItems([]);
    await clearFeed();
    // Keep the phone's tray consistent with the list the teacher just emptied.
    await dismissDelivered();
  };

  const filteredData =
    activeTab === "HOTU"
      ? items
      : items.filter((item) => item.kind === activeTab);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
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
          renderItem={({ item }) => (
            <NotificationCard
              title={item.title}
              message={item.message}
              time={formatFeedTime(item.at)}
              unread={item.unread}
              icon={feedIcon(item.level)}
            />
          )}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        />
      )}

      {/* Clear all — only when there is something to clear */}
      {items.length > 0 ? (
        <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
          <Text style={styles.clearButtonText}>Hamoos notifikasaun hotu</Text>
        </TouchableOpacity>
      ) : null}
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
  clearButton: {
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B45309",
  },
});
