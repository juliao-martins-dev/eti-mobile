import { useCallback, useEffect, useState } from "react";

import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";
import { Link, useFocusEffect, useRouter } from "expo-router";

import { IstoriaMiniCard } from "@/components/IstoriaMiniCard";
import {
  displayName,
  fetchMe,
  getCachedUser,
  photoUrl,
  userField,
} from "@/lib/auth";
import { fetchRecentDays, formatOras, type LoronRecord } from "@/lib/istoria";
import { fetchKonfig } from "@/lib/konfig";
import { fetchOhin, type MarkaTipu, type Ohin } from "@/lib/prezensa";
import type { AuthUser } from "@/lib/storage";

const placehoderImage = require("@/assets/images/prof.jpg");

/**
 * Weekday names in Tetun, indexed by Date#getDay() (0 = Sunday).
 *
 * Same wording the API puts in `loron`, so the date here and the day names on
 * the history cards below always agree.
 */
const LORON_TETUN = [
  "Domingu",
  "Segunda-feira",
  "Tersa-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sabado",
];

export default function Index() {
  const [date, setDate] = useState<Date>(new Date());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [today, setToday] = useState<Ohin | null>(null);
  const [recent, setRecent] = useState<LoronRecord[]>([]);
  const router = useRouter();

  // Refetch on focus: today's stamps after a punch, and the profile so a photo
  // changed on the profile tab shows here without a restart.
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      // Today's row and the button state both come from the server.
      fetchOhin()
        .then((record) => {
          if (isMounted) setToday(record);
        })
        .catch(() => {
          // 401 handled by the interceptor; leave the card showing "--:--:--".
        });

      // The two most recent working days, for the history preview below.
      fetchRecentDays(3)
        .then((days) => {
          if (isMounted) setRecent(days);
        })
        .catch(() => {
          // Non-critical: the section falls back to its empty line.
        });

      fetchKonfig();

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

  // Weekday in Tetun; Intl has no tet locale, so only the numeric part is
  // formatted and the day name comes from LORON_TETUN.
  const formattedDate = `${LORON_TETUN[date.getDay()]}, ${new Intl.DateTimeFormat(
    "id-ID",
    { day: "2-digit", month: "short", year: "numeric" },
  ).format(date)}`;

  // Dili, not Jakarta — the previous name (WIB) named the wrong timezone.
  function formatOrasDili(date: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      // Timor-Leste, not Jakarta — the school's own clock (UTC+9).
      timeZone: "Asia/Dili",
    }).formatToParts(date);

    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    const second = parts.find((p) => p.type === "second")?.value;

    // OTL — Oras Timor-Leste.
    return `${hour}:${minute}:${second} OTL`;
  }

  const goToRegister = (tipu: MarkaTipu) => {
    router.push({ pathname: "/register", params: { tipu } });
  };

  const remotePhoto = photoUrl(user);
  const avatarSource = remotePhoto ? { uri: remotePhoto } : placehoderImage;

  const tama = formatOras(today?.oras_tama) ?? "--:--:--";
  const fila = formatOras(today?.oras_fila) ?? "--:--:--";

  // The server owns the button state. While today's row is still loading we
  // leave both enabled rather than block a punch the server might accept.
  const beleCheckin = today ? today.bele_checkin : true;
  const beleCheckout = today ? today.bele_checkout : true;

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

        {/* oras + marka */}
        <View style={styles.orasCard}>
          <View style={styles.orasHeader}>
            <View style={styles.orasHeaderRow}>
              <Text style={styles.date}>{formattedDate}</Text>
              <Text style={styles.time}>{formatOrasDili(date)}</Text>
            </View>
            <View style={styles.lines} />
          </View>
          <View style={styles.markaRow}>
            <View style={styles.checkinCol}>
              <Text>{tama}</Text>
              <Pressable
                style={[
                  styles.markaButton,
                  !beleCheckin && styles.markaButtonOff,
                ]}
                disabled={!beleCheckin}
                onPress={() => goToRegister("checkin")}
              >
                <Feather name="log-in" size={24} color="#fff" />
                <Text style={styles.markaButtonText}>Checkin</Text>
              </Pressable>
            </View>
            <View style={styles.checkoutCol}>
              <Text>{fila}</Text>
              <Pressable
                style={[
                  styles.markaButton,
                  !beleCheckout && styles.markaButtonOff,
                ]}
                disabled={!beleCheckout}
                onPress={() => goToRegister("checkout")}
              >
                <Feather name="log-out" size={24} color="#fff" />
                <Text style={styles.markaButtonText}>Checkout</Text>
              </Pressable>
            </View>
          </View>
        </View>
        {/* end of oras + marka */}

        {/* recent history */}
        <View style={styles.historiaContainer}>
          <View style={styles.historiaHeader}>
            <Text style={styles.historiaHeaderText}>Historia prezensa</Text>
            <Link href="/history" asChild>
              <Pressable style={styles.historiaLink} hitSlop={8}>
                <Feather name="clock" size={15} color="#666" />
                <Text style={styles.historiaHeaderSubtext}>Hare liu taan</Text>
              </Pressable>
            </Link>
          </View>

          {recent.length ? (
            recent.map((day) => <IstoriaMiniCard key={day.data} day={day} />)
          ) : (
            <Text style={styles.historiaEmpty}>
              Seidauk iha istoria husi loron uluk.
            </Text>
          )}
        </View>
        {/* end of recent history */}
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
    // Takes the width left beside the avatar so a long kargu wraps onto a
    // second line instead of running off the edge.
    flex: 1,
    rowGap: 6,
  },
  profileHeaderText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  orasCard: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    padding: 16,
  },
  orasHeader: {
    marginBottom: 16,
  },
  orasHeaderRow: {
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
  markaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  checkinCol: {
    alignItems: "center",
    columnGap: 8,
  },
  checkoutCol: {
    alignItems: "center",
    columnGap: 8,
  },
  markaButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginTop: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  markaButtonOff: {
    opacity: 0.4,
  },
  markaButtonText: {
    color: "#fff",
    fontSize: 19,
  },
  historiaContainer: {
    marginTop: 32,
    marginBottom: 16,
  },
  historiaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historiaHeaderText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  historiaLink: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  historiaHeaderSubtext: {
    fontSize: 16,
    color: "#666",
    textDecorationLine: "underline",
  },
  historiaEmpty: {
    fontSize: 14,
    color: "#94A3B8",
    paddingVertical: 12,
  },
});
