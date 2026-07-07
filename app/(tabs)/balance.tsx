import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { asc } from 'drizzle-orm';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { accounts, transactions, type Account } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { currentBalance, type BalanceTransaction } from '@/lib/balance';

export default function BalanceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [items, setItems] = useState<Account[]>([]);
  const [txRows, setTxRows] = useState<BalanceTransaction[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadAccounts = async () => {
        try {
          const [accountRows, transactionRows] = await Promise.all([
            db.select().from(accounts).orderBy(asc(accounts.id)),
            db
              .select({
                type: transactions.type,
                amount: transactions.amount,
                accountId: transactions.accountId,
                toAccountId: transactions.toAccountId,
              })
              .from(transactions),
          ]);
          if (isActive) {
            setItems(accountRows);
            setTxRows(transactionRows);
          }
        } catch (error) {
          console.error(error);
        }
      };

      loadAccounts();

      return () => {
        isActive = false;
      };
    }, []),
  );

  // 現在残高 = 基準残高 + 取引差分(lib/balance.ts)
  const balances = items.map((acc) => ({ account: acc, current: currentBalance(acc, txRows) }));
  const total = balances.reduce((sum, b) => sum + b.current, 0);
  const borderColor = Colors[colorScheme].border;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: tabBarHeight + 88 },
        ]}
      >
        <ThemedText type="title">残高</ThemedText>

        <View style={[styles.totalCard, { borderColor }]}>
          <ThemedText style={styles.totalLabel}>総残高</ThemedText>
          <ThemedText type="title" style={styles.totalAmount}>
            ¥{total.toLocaleString()}
          </ThemedText>
        </View>

        {items.length === 0 ? (
          <ThemedText style={styles.empty}>
            口座がありません。下の「口座を追加」から登録してください。
          </ThemedText>
        ) : (
          balances.map(({ account, current }) => (
            <Link
              key={account.id}
              href={{ pathname: '/account', params: { id: String(account.id) } }}
              asChild
            >
              <Pressable style={StyleSheet.flatten([styles.accountRow, { borderColor }])}>
                <ThemedText style={styles.accountName}>{account.name}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.accountBalance}>
                  ¥{current.toLocaleString()}
                </ThemedText>
                <IconSymbol name="chevron.right" size={20} color={Colors[colorScheme].icon} />
              </Pressable>
            </Link>
          ))
        )}

        <Link href="/account" asChild>
          <Pressable style={StyleSheet.flatten([styles.addButton, { borderColor: Colors[colorScheme].tint }])}>
            <ThemedText style={{ color: Colors[colorScheme].tint }}>＋ 口座を追加</ThemedText>
          </Pressable>
        </Link>
      </ScrollView>

      <AddTransactionFab />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  totalCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  totalLabel: {
    opacity: 0.6,
  },
  totalAmount: {
    fontSize: 32,
  },
  empty: {
    opacity: 0.6,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  accountName: {
    flex: 1,
    fontSize: 16,
  },
  accountBalance: {
    fontSize: 16,
  },
  addButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
  },
});
