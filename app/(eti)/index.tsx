import { useCallback, useEffect, useState } from "react";

import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";
import { Link, useFocusEffect, useRouter } from "expo-router";

import { IstoriaMiniCard } from "@/components/IstoriaMiniCard";
import { ISTORIA_COLORS } from "@/components/IstoriaSummary";
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
import { markaFlow } from "@/lib/marka-flow";

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
  const [linkPressed, setLinkPressed] = useState(false);
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
      fetchRecentDays(2)
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

    // The OTL suffix is rendered beside this, not baked into the digits, so
    // the clock can use tabular figures on its own.
    return `${hour}:${minute}:${second}`;
  }

  const goToRegister = (tipu: MarkaTipu) => {
    router.push({ pathname: "/register", params: { tipu } });
  };

  const remotePhoto = photoUrl(user);
  const avatarSource = remotePhoto ? { uri: remotePhoto } : placehoderImage;

  // Null rather than a placeholder: the column decides how an unmarked slot
  // looks, and whether it shows a button or a stamp.
  const tama = formatOras(today?.oras_tama);
  const fila = formatOras(today?.oras_fila);

  // Exactly one button is live: the one that fills the next empty slot of the
  // day. See lib/marka-flow.ts to go back to waiting for the clock.
  const { beleCheckin, beleCheckout } = markaFlow(today);

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
          <Text style={styles.orasEyebrow}>{formattedDate}</Text>

          <View style={styles.orasClockRow}>
            <Text style={styles.orasClock}>{formatOrasDili(date)}</Text>
            <Text style={styles.orasZone}>OTL</Text>
          </View>

          <View style={styles.orasDivider} />

          <View style={styles.markaRow}>
            <MarkaColumn
              label="Tama"
              icon="log-in"
              oras={tama}
              enabled={beleCheckin}
              action="Checkin"
              onPress={() => goToRegister("checkin")}
            />
            <MarkaColumn
              label="Sai"
              icon="log-out"
              oras={fila}
              enabled={beleCheckout}
              action="Checkout"
              onPress={() => goToRegister("checkout")}
            />
          </View>
        </View>
        {/* end of oras + marka */}

        {/* recent history */}
        <View style={styles.historiaContainer}>
          <View style={styles.historiaHeader}>
            <Text style={styles.historiaHeaderText}>Historia prezensa</Text>
            <Link href="/history" asChild>
              <Pressable
                hitSlop={8}
                onPressIn={() => setLinkPressed(true)}
                onPressOut={() => setLinkPressed(false)}
                /*
                  Must be a single flattened object. `asChild` renders through
                  Radix's Slot, which merges style with `{...slot, ...child}`;
                  spreading a function gives {} and spreading an array gives
                  numeric keys, so either one silently drops every style and
                  the pill collapses to a default column View.
                */
                style={StyleSheet.flatten([
                  styles.historiaLink,
                  linkPressed && styles.historiaLinkPressed,
                ])}
              >
                <Text style={styles.historiaLinkText} numberOfLines={1}>
                  Hare liu taan
                </Text>
                <Feather name="chevron-right" size={16} color="#007AFF" />
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

/**
 * One session of the day: its label, its time, and either the action that
 * records it or the stamp proving it is done.
 *
 * A recorded punch is never shown as a disabled button — on the paper sheet
 * this app mirrors, a signed box has ink in it, not a control you cannot use.
 */
function MarkaColumn({
  label,
  icon,
  oras,
  enabled,
  action,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  oras: string | null;
  enabled: boolean;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.markaCol}>
      <Text style={styles.markaLabel}>{label}</Text>

      <Text
        style={[
          styles.markaOras,
          oras ? styles.markaOrasDone : styles.markaOrasEmpty,
        ]}
      >
        {oras ?? "--:--"}
      </Text>

      {oras ? (
        <View style={styles.markaStamp}>
          <Feather name="check" size={14} color={ISTORIA_COLORS.present} />
          <Text style={styles.markaStampText}>Marka ona</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.markaButton, !enabled && styles.markaButtonOff]}
          disabled={!enabled}
          onPress={onPress}
        >
          <Feather
            name={icon}
            size={16}
            color={enabled ? "#FFFFFF" : ISTORIA_COLORS.muted}
          />
          <Text
            style={[
              styles.markaButtonText,
              !enabled && styles.markaButtonTextOff,
            ]}
          >
            {action}
          </Text>
        </Pressable>
      )}
    </View>
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
    marginTop: 24,
    backgroundColor: ISTORIA_COLORS.card,
    borderWidth: 1,
    borderColor: ISTORIA_COLORS.track,
    borderRadius: 18,
    padding: 18,
  },
  orasEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: ISTORIA_COLORS.subtle,
  },
  orasClockRow: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 8,
    marginTop: 6,
  },
  orasClock: {
    fontSize: 32,
    fontWeight: "700",
    color: ISTORIA_COLORS.text,
    // The seconds tick every second; without this the whole line jitters.
    fontVariant: ["tabular-nums"],
  },
  orasZone: {
    fontSize: 12,
    fontWeight: "600",
    color: ISTORIA_COLORS.muted,
  },
  orasDivider: {
    height: 1,
    backgroundColor: ISTORIA_COLORS.track,
    marginVertical: 16,
  },
  markaRow: {
    flexDirection: "row",
    columnGap: 12,
  },
  markaCol: {
    // Equal halves, so the two sessions read as a pair rather than two
    // buttons sized by their own text.
    flex: 1,
  },
  markaLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: ISTORIA_COLORS.muted,
  },
  markaOras: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  markaOrasDone: {
    color: ISTORIA_COLORS.present,
  },
  markaOrasEmpty: {
    color: ISTORIA_COLORS.muted,
  },
  markaStamp: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    marginTop: 10,
    // Matches the button height so a stamped column and an actionable one
    // stay the same height.
    height: 44,
  },
  markaStampText: {
    fontSize: 13,
    fontWeight: "600",
    color: ISTORIA_COLORS.present,
  },
  markaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#007AFF",
  },
  markaButtonOff: {
    // A solid neutral, not a faded blue: unavailable, not broken.
    backgroundColor: "#F1F5F9",
  },
  markaButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  markaButtonTextOff: {
    color: ISTORIA_COLORS.muted,
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
    // The heading gives way, never the control: at a large system font scale
    // it wraps instead of squeezing the pill.
    flex: 1,
    marginRight: 12,
  },
  historiaLink: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    // Tight: the chevron reads as punctuation on the label, not a sibling.
    columnGap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    // Same pill idiom as the status badges on the history cards.
    borderRadius: 999,
    backgroundColor: "#EAF3FF",
  },
  historiaLinkPressed: {
    backgroundColor: "#D7E8FF",
  },
  historiaLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#007AFF",
  },
  historiaEmpty: {
    fontSize: 14,
    color: "#94A3B8",
    paddingVertical: 12,
  },
});
