import { StyleSheet, Text, View } from "react-native";

import {
  buildSesaun,
  formatLoronShort,
  ihaAtrazadu,
  seidaukMarka,
  type LoronRecord,
  type SlotView,
} from "@/lib/istoria";
import { ISTORIA_COLORS } from "./IstoriaSummary";

type Props = { day: LoronRecord };

/**
 * Compact summary of a day, for the home screen preview.
 *
 * Shows all four punches the API returns — Dader and Lorokraik, Tama and Fila —
 * but drops the photo evidence, the `orariu` lines and the status pill that the
 * full IstoriaDayCard carries on the Historia screen.
 */
export function IstoriaMiniCard({ day }: Props) {
  const empty = seidaukMarka(day);
  const late = ihaAtrazadu(day);
  const sesaun = buildSesaun(day);

  const dotColor = empty
    ? ISTORIA_COLORS.muted
    : late
      ? ISTORIA_COLORS.late
      : ISTORIA_COLORS.present;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.dayName} numberOfLines={1}>
          {day.loron}
        </Text>
        <Text style={styles.dayDate}>{formatLoronShort(day.data)}</Text>
      </View>

      {sesaun.map((session) => (
        <View key={session.key} style={styles.row}>
          <Text style={styles.session}>{session.label}</Text>
          {/* Arrow in place of Tama/Fila headings: entry on the left, exit on
              the right, without spending a line on labels. */}
          <Time slot={session.slots[0]} />
          <Text style={styles.arrow}>→</Text>
          <Time slot={session.slots[1]} />
        </View>
      ))}
    </View>
  );
}

/** A punched time, an unmarked slot, or a session that does not exist. */
function Time({ slot }: { slot: SlotView }) {
  // Saturday has no afternoon session — an em dash, not a missing punch.
  if (slot.laiha) return <Text style={[styles.time, styles.timeOff]}>—</Text>;

  const color = slot.oras
    ? slot.atrazadu
      ? ISTORIA_COLORS.late
      : ISTORIA_COLORS.present
    : ISTORIA_COLORS.muted;

  return <Text style={[styles.time, { color }]}>{slot.oras ?? "--:--"}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ISTORIA_COLORS.card,
    borderWidth: 1,
    borderColor: ISTORIA_COLORS.track,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayName: {
    fontSize: 14,
    fontWeight: "700",
    color: ISTORIA_COLORS.text,
    flexShrink: 1,
  },
  dayDate: {
    fontSize: 12,
    color: ISTORIA_COLORS.subtle,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  session: {
    width: 84,
    fontSize: 12,
    color: ISTORIA_COLORS.subtle,
  },
  time: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  timeOff: {
    color: ISTORIA_COLORS.muted,
  },
  arrow: {
    fontSize: 12,
    color: ISTORIA_COLORS.muted,
    paddingHorizontal: 6,
  },
});
