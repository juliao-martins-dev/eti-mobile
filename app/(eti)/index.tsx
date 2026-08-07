import { useCallback, useEffect, useState } from "react";

import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";
import { Link, useFocusEffect, useRouter } from "expo-router";

import {
  displayName,
  fetchMe,
  getCachedUser,
  photoUrl,
  userField,
} from "@/lib/auth";
import { getTodayAttendance, type TodayAttendance } from "@/lib/prezensa";
import type { AuthUser } from "@/lib/storage";

const placehoderImage = require("@/assets/images/prof.jpg");

export default function Index() {
  const [date, setDate] = useState<Date>(new Date());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const router = useRouter();

  // Refetch on focus: today's stamps after a punch, and the profile so a photo
  // changed on the profile tab shows here without a restart.
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      getTodayAttendance().then((record) => {
        if (isMounted) setToday(record);
      });

      getCachedUser().then((cached) => {
        if (isMounted && cached) setUser(cached);
      });

      fetchMe()
        .then((profile) => {
          if (isMounted) setUser(profile);
        })
        .catch(() => {
          // 401 handled by the interceptor; cached profile stays on screen.
        });

      return () => {
        isMounted = false;
      };
    }, []),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setDate(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  function formatTimeWIB(date: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).formatToParts(date);

    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    const second = parts.find((p) => p.type === "second")?.value;

    return `${hour}:${minute}:${second} WIB`;
  }

  const goToClock = (mode: "in" | "out") => {
    router.push({ pathname: "/clock", params: { mode } });
  };

  const remotePhoto = photoUrl(user);
  const avatarSource = remotePhoto ? { uri: remotePhoto } : placehoderImage;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* profile */}
        <Pressable onPress={() => router.push("/profile")}>
          <View style={styles.profileContainer}>
            <Image source={avatarSource} style={styles.profileImage} />
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileHeaderText}>
                {displayName(user, "-")}
              </Text>
              <Text>
                {userField(user, ["kargu", "position", "role", "title"], "-")}
              </Text>
            </View>
          </View>
        </Pressable>
        {/* end of profile */}

        {/* clock */}
        <View style={styles.clockContainer}>
          <View style={styles.clockHeader}>
            <View style={styles.clockHeaderLabel}>
              <Text style={styles.date}>{formattedDate}</Text>
              <Text style={styles.time}>{formatTimeWIB(date)}</Text>
            </View>
            <View style={styles.lines} />
          </View>
          <View style={styles.clockBody}>
            <View style={styles.clockIn}>
              <Text>{today?.clockIn ?? "--:--:--"}</Text>
              <Pressable
                style={styles.clockButton}
                onPress={() => goToClock("in")}
              >
                <Feather name="log-in" size={24} color="#fff" />
                <Text style={styles.clockButtonText}>Checkin</Text>
              </Pressable>
            </View>
            <View style={styles.clockOut}>
              <Text>{today?.clockOut ?? "--:--:--"}</Text>
              <Pressable
                style={styles.clockButton}
                onPress={() => goToClock("out")}
              >
                <Feather name="log-out" size={24} color="#fff" />
                <Text style={styles.clockButtonText}>Checkout</Text>
              </Pressable>
            </View>
          </View>
        </View>
        {/* end of clock */}

        {/* announcement */}
        <View style={styles.announcementContainer}>
          <View style={styles.announcementHeader}>
            <Text style={styles.announcementHeaderText}>Anuncio</Text>
            <Link href="/announcement">
              <Text style={styles.announcementHeaderSubtext}>
                Hare liu taan
              </Text>
            </Link>
          </View>
          <View>
            <Image
              source={require("@/assets/images/announcement.jpg")}
              style={styles.announcementImage}
            />
          </View>
        </View>
        {/* end of announcement */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileTextContainer: {
    rowGap: 6,
  },
  profileHeaderText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  clockContainer: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    padding: 16,
  },
  clockHeader: {
    marginBottom: 16,
  },
  clockHeaderLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  date: {
    fontSize: 16,
  },
  time: {
    fontWeight: "bold",
    fontSize: 16,
  },
  lines: {
    height: 1,
    width: "100%",
    backgroundColor: "#ccc",
    marginVertical: 16,
  },
  clockBody: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clockIn: {
    alignItems: "center",
    columnGap: 8,
  },
  clockOut: {
    alignItems: "center",
    columnGap: 8,
  },
  clockButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginTop: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  clockButtonText: {
    color: "#fff",
    fontSize: 19,
  },
  announcementContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 16,
  },
  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
  },
  announcementHeaderText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  announcementHeaderSubtext: {
    fontSize: 16,
    color: "#666",
    textDecorationLine: "underline",
  },
  announcementImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
  },
});
