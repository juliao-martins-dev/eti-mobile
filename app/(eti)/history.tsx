import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FulanPicker } from "@/components/FulanPicker";
import { IstoriaDayCard } from "@/components/IstoriaDayCard";
import { ISTORIA_COLORS, IstoriaSummary } from "@/components/IstoriaSummary";
import {
  fetchIstoria,
  fulanName,
  IstoriaError,
  type IstoriaResponse,
} from "@/lib/istoria";

type Mode = "fulan" | "semana";

const MAX_SEMANA = 6;

const now = new Date();
const CURRENT_FULAN = now.getMonth() + 1;
const CURRENT_TINAN = now.getFullYear();

export default function IstoriaScreen() {
  const [fulan, setFulan] = useState(CURRENT_FULAN);
  const [tinan, setTinan] = useState(CURRENT_TINAN);
  const [mode, setMode] = useState<Mode>("fulan");
  const [semana, setSemana] = useState(1);

  const [data, setData] = useState<IstoriaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);

      try {
        const result = await fetchIstoria({
          fulan,
          tinan,
          // Omitted in month mode so the server returns the whole month.
          ...(mode === "semana" ? { semana } : {}),
        });
        setData(result);
      } catch (e: any) {
        // 401 is handled by the interceptor, which routes to login.
        setError(
          e instanceof IstoriaError
            ? e.message
            : "La konsege karrega istoria. Koko fila fali.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fulan, tinan, mode, semana],
  );

  useEffect(() => {
    load();
  }, [load]);

  const isCurrentPeriod = tinan === CURRENT_TINAN && fulan === CURRENT_FULAN;

  const stepFulan = (delta: number) => {
    const next = new Date(tinan, fulan - 1 + delta, 1);
    const nextFulan = next.getMonth() + 1;
    const nextTinan = next.getFullYear();

    // Never navigate past the current month.
    if (
      nextTinan > CURRENT_TINAN ||
      (nextTinan === CURRENT_TINAN && nextFulan > CURRENT_FULAN)
    ) {
      return;
    }

    setFulan(nextFulan);
    setTinan(nextTinan);
  };

  const days = data?.loron ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Month navigator */}
      <View style={styles.navRow}>
        <Pressable
          hitSlop={8}
          style={styles.navButton}
          onPress={() => stepFulan(-1)}
        >
          <Feather name="chevron-left" size={22} color={ISTORIA_COLORS.text} />
        </Pressable>

        <Pressable style={styles.navLabel} onPress={() => setPickerOpen(true)}>
          <Text style={styles.navLabelText}>
            {data?.fulan_display ?? fulanName(fulan)} {tinan}
          </Text>
          <Feather name="chevron-down" size={16} color={ISTORIA_COLORS.subtle} />
        </Pressable>

        <Pressable
          hitSlop={8}
          disabled={isCurrentPeriod}
          style={styles.navButton}
          onPress={() => stepFulan(1)}
        >
          <Feather
            name="chevron-right"
            size={22}
            color={isCurrentPeriod ? ISTORIA_COLORS.track : ISTORIA_COLORS.text}
          />
        </Pressable>
      </View>

      {/* Fulan / Semana segmented control */}
      <View style={styles.segment}>
        {(["fulan", "semana"] as Mode[]).map((value) => (
          <Pressable
            key={value}
            onPress={() => setMode(value)}
            style={[styles.segmentItem, mode === value && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                mode === value && styles.segmentTextActive,
              ]}
            >
              {value === "fulan" ? "Fulan" : "Semana"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Week stepper — only in week mode */}
      {mode === "semana" ? (
        <View style={styles.weekRow}>
          <Pressable
            hitSlop={8}
            disabled={semana <= 1}
            onPress={() => setSemana((s) => Math.max(1, s - 1))}
          >
            <Feather
              name="chevron-left"
              size={20}
              color={semana <= 1 ? ISTORIA_COLORS.track : ISTORIA_COLORS.text}
            />
          </Pressable>

          <Text style={styles.weekText}>Semana {semana}</Text>

          <Pressable
            hitSlop={8}
            disabled={semana >= MAX_SEMANA}
            onPress={() => setSemana((s) => Math.min(MAX_SEMANA, s + 1))}
          >
            <Feather
              name="chevron-right"
              size={20}
              color={
                semana >= MAX_SEMANA
                  ? ISTORIA_COLORS.track
                  : ISTORIA_COLORS.text
              }
            />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        {data?.rezumu ? <IstoriaSummary rezumu={data.rezumu} /> : null}

        {loading ? (
          <ActivityIndicator style={styles.state} color={ISTORIA_COLORS.muted} />
        ) : error ? (
          <View style={styles.state}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => load()}>
              <Text style={styles.retryText}>Koko fila fali</Text>
            </Pressable>
          </View>
        ) : days.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.emptyText}>Laiha dadus ba períodu ne&apos;e.</Text>
          </View>
        ) : (
          days.map((day) => <IstoriaDayCard key={day.data} day={day} />)
        )}
      </ScrollView>

      <FulanPicker
        visible={pickerOpen}
        fulan={fulan}
        tinan={tinan}
        maxFulan={CURRENT_FULAN}
        maxTinan={CURRENT_TINAN}
        onSelect={(nextFulan, nextTinan) => {
          setFulan(nextFulan);
          setTinan(nextTinan);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  navButton: {
    padding: 6,
  },
  navLabel: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  navLabelText: {
    fontSize: 18,
    fontWeight: "800",
    color: ISTORIA_COLORS.text,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#2563EB",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 20,
    marginTop: 12,
  },
  weekText: {
    fontSize: 15,
    fontWeight: "700",
    color: ISTORIA_COLORS.text,
    minWidth: 100,
    textAlign: "center",
  },
  state: {
    paddingVertical: 32,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#B45309",
    textAlign: "center",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: ISTORIA_COLORS.subtle,
  },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
