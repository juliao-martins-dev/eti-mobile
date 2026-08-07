import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export function EmptyNotification() {
  return (
    <View style={styles.container}>
      <Ionicons name="notifications-outline" size={80} color="#CBD5E1" />
      <Text style={styles.title}>Seidauk iha notifikasaun</Text>
      <Text style={styles.subtitle}>
        Notifikasaun eskola sei mosu iha ne’e
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    color: '#64748B',
    textAlign: 'center',
  },
});
