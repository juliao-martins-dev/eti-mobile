import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const announcementItems = [
  {
    id: "1",
    title: "Enkontru Jeral Funsionariu",
    date: "18 Fev 2026",
    content:
      "Amanha dadeer iha tuku 09:00, ita sei halo enkontru iha sala konferensia atu koalia kona-ba planu servisu fulan ida ne'e.",
  },
  {
    id: "2",
    title: "Mudansa Orariu Semana Ida",
    date: "16 Fev 2026",
    content:
      "Durante semana ida ne'e, tempu tama servisu muda ba tuku 08:30 no sai tuku 16:30 tanba manutensaun sistema internu.",
  },
  {
    id: "3",
    title: "Treinamentu Seguransa Dadus",
    date: "14 Fev 2026",
    content:
      "Departamentu IT organiza treinamentu badak kona-ba seguransa password no uza email instituisaun ho di'ak liu.",
  },
  {
    id: "4",
    title: "Limpeza Jeral Edifisiu",
    date: "12 Fev 2026",
    content:
      "Kinta semana oin mai, equipa manutensaun sei halo limpeza jeral. Favor organiza dokumentu iha mesa molok tuku 17:00.",
  },
  {
    id: "5",
    title: "Informasaun Ferias Anual",
    date: "10 Fev 2026",
    content:
      "Funsionariu hotu-hotu ne'ebe hakarak aplica ferias fulan oin mai bele hatama pedidu iha RH molok loron 25 fulan ida ne'e.",
  },
];

const announcementImage = require("@/assets/images/announcement.jpg");

export default function Announcement() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Lista Anunsiu</Text>
        <Text style={styles.headerSubtitle}>
          Atualizasaun importante ba funsionariu hotu
        </Text>

        {announcementItems.map((item) => (
          <View key={item.id} style={styles.card}>
            <Image
              source={announcementImage}
              contentFit="cover"
              style={styles.cardImage}
            />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDate}>{item.date}</Text>
              <Text style={styles.cardContent}>{item.content}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    rowGap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#475569",
    marginTop: 2,
    marginBottom: 6,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardImage: {
    width: "100%",
    height: 140,
  },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  cardDate: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  cardContent: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
  },
});
