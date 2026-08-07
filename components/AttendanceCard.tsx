import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  date: string;
  checkIn: string;
  checkOut?: string | null;
};

export function AttendanceCard({ date, checkIn, checkOut }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="log-in-outline" size={18} color="#2563EB" />
        <Text style={styles.dateText}>{date}</Text>
      </View>

      <Text style={styles.text}>
        Tama: <Text style={styles.bold}>{checkIn}</Text>
      </Text>

      <Text style={styles.text}>
        Sai:{' '}
        <Text style={styles.bold}>
          {checkOut ? checkOut : '-'}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  text: {
    fontSize: 14,
    marginTop: 4,
  },
  bold: {
    fontWeight: '700',
  },
});
