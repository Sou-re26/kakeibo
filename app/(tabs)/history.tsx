import { desc } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/db/client';
import { transactions, type Transaction } from '@/db/schema';

export default function TabTwoScreen() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadTransactions = async () => {
      try {
        const rows = await db.select().from(transactions).orderBy(desc(transactions.date));

        if (isActive) {
          setItems(rows);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadTransactions();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        履歴
      </ThemedText>

      {isLoading ? (
        <ThemedText>読み込み中...</ThemedText>
      ) : items.length === 0 ? (
        <ThemedText>まだ記録がありません。</ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const dateText = new Date(item.date).toLocaleString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.type}>{item.type}</ThemedText>
                  <ThemedText style={styles.amount}>¥{Number(item.amount).toLocaleString()}</ThemedText>
                </View>

                <ThemedText style={styles.date}>{dateText}</ThemedText>
                {item.category ? <ThemedText style={styles.category}>{item.category}</ThemedText> : null}
                {item.store ? <ThemedText style={styles.meta}>{item.store}</ThemedText> : null}
                {item.memo ? <ThemedText style={styles.memo}>{item.memo}</ThemedText> : null}
              </View>
            );
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    marginBottom: 16,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 13,
    color: '#666',
  },
  category: {
    fontSize: 15,
  },
  meta: {
    fontSize: 14,
    color: '#444',
  },
  memo: {
    fontSize: 14,
    color: '#555',
  },
});
