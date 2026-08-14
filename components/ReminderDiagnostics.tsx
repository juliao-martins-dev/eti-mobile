import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  reminderDiagnostics,
  scheduleTestReminder,
  type ReminderDiagnostics as Diagnostics,
} from "@/lib/notifications";
import { ISTORIA_COLORS } from "./IstoriaSummary";

/** expo-notifications weekdays: 1 = Domingu. */
const LORON_KURTU = ["", "Dom", "Seg", "Ters", "Qua", "Qui", "Sex", "Sab"];

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * What the OS actually holds, read back from it.
 *
 * Scheduling happens inside Android and iOS, and scheduleReminders() swallows
 * its failures so a punch is never blocked — which also means a silent failure
 * leaves no trace. This is the only way to see one from the phone itself.
 */
export function ReminderDiagnosticsPanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [testState, setTestState] = useState<"idle" | "sent" | "refused">(
    "idle",
  );

  const refresh = useCallback(() => {
    reminderDiagnostics()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    if (visible) {
      setTestState("idle");
      refresh();
    }
  }, [visible, refresh]);

  const handleTest = async () => {
    const sent = await scheduleTestReminder(60);
    setTestState(sent ? "sent" : "refused");
    refresh();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Diagnostiku fo hanoin</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={ISTORIA_COLORS.subtle} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {data ? (
              <>
                <Row
                  label="Permisaun"
                  value={data.permission}
                  ok={data.allowed}
                />
                <Row
                  label="Bele fo notifikasaun"
                  value={data.allowed ? "Sim" : "Lae"}
                  ok={data.allowed}
                />
                <Row
                  label="Alarme iha sistema"
                  value={`${data.scheduled} / 22`}
                  ok={data.scheduled === 22}
                />
                <Row
                  label="Kanal prezensa-lembra"
                  value={
                    { laiha: "Laiha", kiik: "Kiik liu", HIGH: "OK", seluk: "?" }[
                      data.channel
                    ]
                  }
                  ok={data.channel === "HIGH"}
                />
                <Row
                  label="Expo Go"
                  value={data.expoGo ? "Sim" : "Lae"}
                  ok={!data.expoGo}
                />
                <Row
                  label="Oras telefone vs Dili"
                  value={
                    data.desvioOras === 0
                      ? "Hanesan"
                      : `${data.desvioOras > 0 ? "+" : ""}${data.desvioOras} minutu`
                  }
                  ok={data.desvioOras === 0}
                />

                {data.expoGo ? (
                  <Text style={styles.warning}>
                    Iha Expo Go, fo hanoin la garante bainhira aplikasaun taka.
                    Presiza build (npx expo run:android) atu testa loloos.
                  </Text>
                ) : null}

                {data.channel === "kiik" ? (
                  <Text style={styles.warning}>
                    Kanal notifikasaun hamriik ho importansia kiik. Aplikasaun
                    labele hasa’e fila fali — presiza troka iha konfigurasaun
                    telefone: Notifications → Lembra prezensa.
                  </Text>
                ) : null}

                {data.desvioOras !== 0 ? (
                  <Text style={styles.warning}>
                    Fuso orariu telefone la hanesan Dili. Alarme sei toka tuir
                    oras telefone, laos oras eskola.
                  </Text>
                ) : null}

                <Text style={styles.sectionTitle}>Oras alarme</Text>
                {data.alarms.length ? (
                  data.alarms.map((alarm, index) => (
                    <View key={index} style={styles.alarmRow}>
                      <Text style={styles.alarmDay}>
                        {LORON_KURTU[alarm.weekday] ?? alarm.weekday}
                      </Text>
                      <Text style={styles.alarmTime}>
                        {pad(alarm.hour)}:{pad(alarm.minute)}
                      </Text>
                      <Text style={styles.alarmTitle} numberOfLines={1}>
                        {alarm.title}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.empty}>
                    Laiha alarme. Taka no loke fila fali aplikasaun.
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.empty}>La konsege lee diagnostiku.</Text>
            )}
          </ScrollView>

          <Pressable style={styles.testButton} onPress={handleTest}>
            <Feather name="bell" size={18} color="#FFFFFF" />
            <Text style={styles.testButtonText}>
              Testa lembra iha 60 segundu
            </Text>
          </Pressable>

          {testState === "sent" ? (
            <Text style={styles.testNote}>
              Taka aplikasaun ne’e agora. Mensajen sei mosu iha 60 segundu.
            </Text>
          ) : null}
          {testState === "refused" ? (
            <Text style={styles.testNote}>
              Permisaun rejeitadu. Loke konfigurasaun telefone atu fo permisaun.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>
        <Feather
          name={ok ? "check-circle" : "alert-triangle"}
          size={14}
          color={ok ? ISTORIA_COLORS.present : ISTORIA_COLORS.late}
        />
        <Text
          style={[
            styles.rowValueText,
            { color: ok ? ISTORIA_COLORS.present : ISTORIA_COLORS.late },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: ISTORIA_COLORS.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowLabel: {
    fontSize: 14,
    color: ISTORIA_COLORS.subtle,
    flexShrink: 0,
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  rowValueText: {
    fontSize: 14,
    fontWeight: "700",
  },
  warning: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#B45309",
    backgroundColor: "#FDF3E3",
    borderRadius: 10,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: ISTORIA_COLORS.subtle,
    marginTop: 18,
    marginBottom: 6,
  },
  alarmRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    paddingVertical: 5,
  },
  alarmDay: {
    width: 38,
    fontSize: 12,
    fontWeight: "700",
    color: ISTORIA_COLORS.muted,
  },
  alarmTime: {
    width: 52,
    fontSize: 14,
    fontWeight: "700",
    color: ISTORIA_COLORS.text,
    fontVariant: ["tabular-nums"],
  },
  alarmTitle: {
    flex: 1,
    fontSize: 12,
    color: ISTORIA_COLORS.subtle,
  },
  empty: {
    fontSize: 13,
    color: ISTORIA_COLORS.subtle,
    paddingVertical: 12,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#007AFF",
  },
  testButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  testNote: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: ISTORIA_COLORS.subtle,
  },
});
