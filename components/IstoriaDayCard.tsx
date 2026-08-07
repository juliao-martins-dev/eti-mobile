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

export function IstoriaDayCard({ day }: Props) {
  const empty = seidaukMarka(day);
  const late = ihaAtrazadu(day);
  const sesaun = buildSesaun(day);

  const badgeColor = empty
    ? ISTORIA_COLORS.muted
    : late
      ? ISTORIA_COLORS.late
      : ISTORIA_COLORS.present;

  const badgeText = empty
    ? "Seidauk marka"
    : (day.status_display ?? (late ? "Atrazadu" : "Prezente"));

  return (
    <View style={[styles.card, empty && styles.cardEmpty]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.dayName, empty && styles.textMuted]}>
            {day.loron}
          </Text>
          <Text style={styles.dayDate}>{formatLoronShort(day.data)}</Text>
          {day.sabadu ? <Text style={styles.sabaduTag}>Sábadu</Text> : null}
        </View>

        <View style={[styles.badge, { backgroundColor: `${badgeColor}1A` }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>
            {badgeText}
          </Text>
        </View>
      </View>

      {sesaun.map((session) => (
        <View key={session.key} style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>{session.label}</Text>
          <View style={styles.slots}>
            {session.slots.map((slot) => (
              <Slot key={slot.kolumna} slot={slot} />
            ))}
          </View>
        </View>
      ))}

      {day.obs ? <Text style={styles.obs}>{day.obs}</Text> : null}
    </View>
  );
}

function Slot({ slot }: { slot: SlotView }) {
  // Saturday afternoon does not exist — an em dash, not a missing punch.
  if (slot.laiha) {
    return (
      <View style={styles.slot}>
        <Text style={styles.slotLabel}>{slot.label}</Text>
        <Text style={styles.slotAbsent}>—</Text>
      </View>
    );
  }

  const color = slot.oras
    ? slot.atrazadu
      ? ISTORIA_COLORS.late
      : ISTORIA_COLORS.present
    : ISTORIA_COLORS.muted;

  return (
    <View style={styles.slot}>
      <Text style={styles.slotLabel}>{slot.label}</Text>
      <Text style={[styles.slotTime, { color }]}>{slot.oras ?? "--:--"}</Text>
      {slot.atrazadu && slot.orasOrariu ? (
        <Text style={styles.slotSchedule}>orariu {slot.orasOrariu}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ISTORIA_COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardEmpty: {
    backgroundColor: "#FBFCFE",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    flexShrink: 1,
  },
  dayName: {
    fontSize: 15,
    fontWeight: "700",
    color: ISTORIA_COLORS.text,
  },
  textMuted: {
    color: ISTORIA_COLORS.subtle,
  },
  dayDate: {
    fontSize: 13,
    color: ISTORIA_COLORS.subtle,
  },
  sabaduTag: {
    fontSize: 11,
    color: ISTORIA_COLORS.subtle,
    backgroundColor: ISTORIA_COLORS.track,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sessionLabel: {
    width: 78,
    fontSize: 12,
    fontWeight: "600",
    color: ISTORIA_COLORS.subtle,
  },
  slots: {
    flex: 1,
    flexDirection: "row",
  },
  slot: {
    flex: 1,
  },
  slotLabel: {
    fontSize: 11,
    color: ISTORIA_COLORS.muted,
  },
  slotTime: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 1,
  },
  slotAbsent: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 1,
    color: ISTORIA_COLORS.muted,
  },
  slotSchedule: {
    fontSize: 10,
    color: ISTORIA_COLORS.late,
    marginTop: 1,
  },
  obs: {
    fontSize: 12,
    color: ISTORIA_COLORS.subtle,
    fontStyle: "italic",
    marginTop: 4,
  },
});
