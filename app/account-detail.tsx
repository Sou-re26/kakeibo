import { asc, desc, eq, or } from 'drizzle-orm';
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineChart } from '@/components/line-chart';
import { PagedTabs } from '@/components/paged-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionTimeline } from '@/components/transaction-timeline';
import { Colors } from '@/constants/theme';
import { useTransactionDraft } from '@/contexts/transaction-draft';
import { db } from '@/db/client';
import { accounts, transactions, type Account, type Transaction } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  balanceChangesDesc,
  balanceSeries,
  RANGE_OPTIONS,
  rangeStart,
  type BalanceChange,
  type RangeKey,
} from '@/lib/balance-history';
import { groupTransactionsByDay } from '@/lib/timeline';

const formatDate = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

export default function AccountDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const { startEdit } = useTransactionDraft();

  const [account, setAccount] = useState<Account | null>(null);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [accountNames, setAccountNames] = useState<Map<number, string>>(new Map());
  const [tab, setTab] = useState<'history' | 'trend'>('history');
  const [range, setRange] = useState<RangeKey>('1m');
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const load = async () => {
        try {
          const [accountRows, allAccounts, txRows] = await Promise.all([
            db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1),
            db.select().from(accounts).orderBy(asc(accounts.id)),
            db
              .select()
              .from(transactions)
              .where(
                or(eq(transactions.accountId, accountId), eq(transactions.toAccountId, accountId)),
              )
              .orderBy(desc(transactions.date)),
          ]);
          if (isActive) {
            setAccount(accountRows[0] ?? null);
            setAccountNames(new Map(allAccounts.map((acc) => [acc.id, acc.name])));
            setRows(txRows);
          }
        } catch (error) {
          console.error(error);
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      load();

      return () => {
        isActive = false;
      };
    }, [accountId]),
  );

  const groups = useMemo(() => groupTransactionsByDay(rows), [rows]);

  const { series, changes } = useMemo(() => {
    if (!account) {
      return { series: [], changes: [] as BalanceChange<Transaction>[] };
    }
    const now = new Date();
    const start = rangeStart(range, now);
    return {
      series: balanceSeries(account, rows, start, now),
      changes: balanceChangesDesc(account.id, rows, start),
    };
  }, [account, rows, range]);

  const handlePressItem = (item: Transaction) => {
    startEdit(item);
    router.push('/input');
  };

  const contentPaddingBottom = insets.bottom + 24;

  const trendHeader = (
    <View>
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setRange(option.key)}
            style={[
              styles.rangeChip,
              { backgroundColor: range === option.key ? colors.accent : colors.card },
            ]}
          >
            <ThemedText
              style={[
                styles.rangeChipText,
                { color: range === option.key ? colors.onAccent : colors.text },
              ]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <LineChart data={series.map((p) => ({ date: p.date, value: p.balance }))} />
    </View>
  );

  const renderChange = ({ item }: { item: BalanceChange<Transaction> }) => (
    <View style={[styles.changeRow, { borderColor: colors.border }]}>
      <ThemedText style={styles.changeDate}>{formatDate(item.tx.date)}</ThemedText>
      <ThemedText
        type="defaultSemiBold"
        style={{ color: item.delta >= 0 ? colors.income : colors.text }}
      >
        {item.delta >= 0 ? '+' : '-'}¥{Math.abs(item.delta).toLocaleString()}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: account?.name ?? '口座',
          headerRight: () => (
            <Link href={{ pathname: '/account', params: { id: String(accountId) } }} asChild>
              <Pressable hitSlop={8}>
                <ThemedText style={{ color: colors.tint }}>編集</ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />

      {/* 履歴/推移の切り替え */}
      <View style={styles.segmentRow}>
        {(
          [
            { key: 'history', label: '履歴' },
            { key: 'trend', label: '推移' },
          ] as const
        ).map((segment) => (
          <Pressable
            key={segment.key}
            onPress={() => setTab(segment.key)}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: tab === segment.key ? colors.accent : colors.card },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={{ color: tab === segment.key ? colors.onAccent : colors.text }}
              type={tab === segment.key ? 'defaultSemiBold' : 'default'}
            >
              {segment.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ThemedText style={styles.message}>読み込み中...</ThemedText>
      ) : (
        <PagedTabs
          index={tab === 'history' ? 0 : 1}
          onIndexChange={(index) => setTab(index === 0 ? 'history' : 'trend')}
        >
          {groups.length === 0 ? (
            <ThemedText style={styles.message}>この口座の記録はまだありません。</ThemedText>
          ) : (
            <TransactionTimeline
              groups={groups}
              accountNames={accountNames}
              contentPaddingBottom={contentPaddingBottom}
              onPressItem={handlePressItem}
            />
          )}
          <FlatList
            data={changes}
            keyExtractor={(change) => String(change.tx.id)}
            ListHeaderComponent={trendHeader}
            ListEmptyComponent={
              <ThemedText style={styles.message}>この期間の記録はありません。</ThemedText>
            }
            contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
            renderItem={renderChange}
          />
        </PagedTabs>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 20,
  },
  message: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.6,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rangeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  rangeChipText: {
    fontSize: 13,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  changeDate: {
    fontSize: 15,
  },
});
