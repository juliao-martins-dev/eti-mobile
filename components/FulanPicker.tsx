import Feather from "@expo/vector-icons/Feather";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { FULAN_TETUN } from "@/lib/istoria";
import { ISTORIA_COLORS } from "./IstoriaSummary";

type Props = {
  visible: boolean;
  fulan: number;
  tinan: number;
  /** Latest selectable period — the current month. */
  maxFulan: number;
  maxTinan: number;
  onSelect: (fulan: number, tinan: number) => void;
  onClose: () => void;
};

export function FulanPicker({
  visible,
  fulan,
  tinan,
  maxFulan,
  maxTinan,
  onSelect,
  onClose,
}: Props) {
  const canGoNextYear = tinan < maxTinan;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallow taps inside the sheet so they don't dismiss it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.yearRow}>
            <Pressable
              hitSlop={8}
              onPress={() => onSelect(fulan, tinan - 1)}
              style={styles.yearButton}
            >
              <Feather
                name="chevron-left"
                size={20}
                color={ISTORIA_COLORS.text}
              />
            </Pressable>

            <Text style={styles.yearText}>{tinan}</Text>

            <Pressable
              hitSlop={8}
              disabled={!canGoNextYear}
              onPress={() => onSelect(fulan, tinan + 1)}
              style={styles.yearButton}
            >
              <Feather
                name="chevron-right"
                size={20}
                color={
                  canGoNextYear ? ISTORIA_COLORS.text : ISTORIA_COLORS.track
                }
              />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {FULAN_TETUN.map((name, index) => {
              const value = index + 1;
              const future = tinan > maxTinan || (tinan === maxTinan && value > maxFulan);
              const active = value === fulan;

              return (
                <Pressable
                  key={name}
                  disabled={future}
                  onPress={() => onSelect(value, tinan)}
                  style={[
                    styles.month,
                    active && styles.monthActive,
                    future && styles.monthDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.monthText,
                      active && styles.monthTextActive,
                      future && styles.monthTextDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: ISTORIA_COLORS.card,
    borderRadius: 20,
    padding: 16,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  yearButton: {
    padding: 8,
  },
  yearText: {
    fontSize: 17,
    fontWeight: "800",
    color: ISTORIA_COLORS.text,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    columnGap: 8,
  },
  month: {
    width: "31%",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  monthActive: {
    backgroundColor: "#2563EB",
  },
  monthDisabled: {
    backgroundColor: "#F8FAFC",
  },
  monthText: {
    fontSize: 13,
    fontWeight: "600",
    color: ISTORIA_COLORS.text,
  },
  monthTextActive: {
    color: "#FFFFFF",
  },
  monthTextDisabled: {
    color: ISTORIA_COLORS.track,
  },
});
