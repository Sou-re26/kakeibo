import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">今月の収支</ThemedText>
      <ThemedText type="title" style={styles.amount}>
        ¥15,000
      </ThemedText>

      <View style={styles.summaryRow}>
        <ThemedView style={styles.summaryBox}>
          <ThemedText>収入</ThemedText>
          <ThemedText type="defaultSemiBold">¥50,000</ThemedText>
        </ThemedView>
        <ThemedView style={styles.summaryBox}>
          <ThemedText>支出</ThemedText>
          <ThemedText type="defaultSemiBold">¥35,000</ThemedText>
        </ThemedView>
      </View>
      <Link href="/input" asChild>
        <Pressable style={styles.fab}>
          <ThemedText style={styles.fabText}>＋</ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    gap: 16,
  },
  amount: {
    fontSize: 36,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    gap: 4,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4, // Android用の影
    shadowColor: '#000', // iOS用の影
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 32,
  },
});