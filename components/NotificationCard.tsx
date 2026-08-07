import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  message: string;
  time: string;
  unread: boolean;
  icon: 'success' | 'warning' | 'announcement';
};

export function NotificationCard({
  title,
  message,
  time,
  unread,
  icon,
}: Props) {
  const iconConfig = {
    success: { name: 'checkmark-circle', color: '#2563EB' },
    warning: { name: 'alert-circle', color: '#F59E0B' },
    announcement: { name: 'megaphone', color: '#0EA5E9' },
  }[icon];

  return (
    <View style={styles.card}>
      <Ionicons
        name={iconConfig.name as any}
        size={24}
        color={iconConfig.color}
      />

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>

      {unread && <View style={styles.unreadDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    marginTop: 4,
    color: '#334155',
  },
  time: {
    fontSize: 12,
    marginTop: 6,
    color: '#64748B',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginLeft: 8,
    marginTop: 6,
  },
});
