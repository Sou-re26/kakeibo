import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { asc, desc } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatCategoryLabel, getCategory } from '@/constants/categories';
import { CategoryColors, Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { accounts, transactions, type Transaction } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupTransactionsByDay, type DayGroup } from '@/lib/timeline';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function HistoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [groups, setGroups] = useState<DayGroup<Transaction>[]>([]);
  const [accountNames, setAccountNames] = useState<Map<number, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadTransactions = async () => {
        try {
          const [rows, accountRows] = await Promise.all([
            db.select().from(transactions).orderBy(desc(transactions.date)),
            db.select().from(accounts).orderBy(asc(accounts.id)),
          ]);
          if (isActive) {
            setGroups(groupTransactionsByDay(rows));
            setAccountNames(new Map(accountRows.map((acc) => [acc.id, acc.name])));
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
    }, []),
  );

  const colors = Colors[colorScheme];
  const categoryColors = CategoryColors[colorScheme];

  const dateColor = (weekday: number) => {
    if (weekday === 0) return colors.sunday;
    if (weekday === 6) return colors.saturday;
    return colors.text;
  };

  // タイムラインの丸アイコン。支出はカテゴリの絵文字+カテゴリ色、収入/振替は記号+グレー
  const iconFor = (item: Transaction): { glyph: string; bg: string } => {
    if (item.type === '収入') return { glyph: '¥', bg: colors.icon };
    if (item.type === '振替') return { glyph: '⇄', bg: colors.icon };
    const category = getCategory(item.categoryKey);
    if (!category) return { glyph: '💸', bg: categoryColors.uncategorized };
    return {
      glyph: category.icon,
      bg: categoryColors[category.key] ?? categoryColors.uncategorized,
    };
  };

  const amountColor = (item: Transaction) => {
    if (item.type === '収入') return colors.income;
    return colors.text;
  };

  const renderGroup = ({ item: group }: { item: DayGroup<Transaction> }) => {
    const weekday = group.date.getDay();
    return (
      <View style={styles.group}>
        <View style={styles.dateCol}>
          <ThemedText type="defaultSemiBold" style={[styles.dateText, { color: dateColor(weekday) }]}>
            {group.date.getMonth() + 1}/{group.date.getDate()}
          </ThemedText>
          <ThemedText style={[styles.weekdayText, { color: dateColor(weekday) }]}>
            ({WEEKDAYS[weekday]})
          </ThemedText>
        </View>

        <View style={styles.groupBody}>
          <View style={styles.groupHeader}>
            <ThemedText style={styles.groupHeaderText}>
              支出 ¥{group.expenseTotal.toLocaleString()}
            </ThemedText>
          </View>

          {group.items.map((item) => {
            const icon = iconFor(item);
            const categoryText = formatCategoryLabel(item.categoryKey, item.subcategoryKey);
            const fromName = item.accountId != null ? accountNames.get(item.accountId) : undefined;
            const toName = item.toAccountId != null ? accountNames.get(item.toAccountId) : undefined;
            const label =
              item.type === '振替'
                ? fromName || toName
                  ? `振替 ${fromName ?? '指定なし'} > ${toName ?? '指定なし'}`
                  : '振替'
                : (categoryText ?? '未分類');
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.iconCol}>
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
                    <ThemedText style={[styles.iconGlyph, { color: colors.onAccent }]}>
                      {icon.glyph}
                    </ThemedText>
                  </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  <ThemedText type="defaultSemiBold" style={[styles.amount, { color: amountColor(item) }]}>
                    ¥ {item.amount.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={styles.categoryText}>{label}</ThemedText>
                  {item.type !== '振替' && fromName ? (
                    <View style={styles.metaRow}>
                      <ThemedText style={styles.metaIcon}>👛</ThemedText>
                      <ThemedText style={styles.metaText}>{fromName}</ThemedText>
                    </View>
                  ) : null}
                  {item.store ? (
                    <View style={styles.metaRow}>
                      <ThemedText style={styles.metaIcon}>🏬</ThemedText>
                      <ThemedText style={styles.metaText}>{item.store}</ThemedText>
                    </View>
                  ) : null}
                  {item.memo ? (
                    <View style={styles.metaRow}>
                      <ThemedText style={styles.metaIcon}>📝</ThemedText>
                      <ThemedText style={styles.metaText}>{item.memo}</ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedText type="title" style={styles.title}>
        履歴
      </ThemedText>

      {isLoading ? (
        <ThemedText style={styles.message}>読み込み中...</ThemedText>
      ) : groups.length === 0 ? (
        <ThemedText style={styles.message}>まだ記録がありません。</ThemedText>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.key}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 88 }}
          renderItem={renderGroup}
        />
      )}

      <AddTransactionFab />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    marginBottom: 16,
  },
  message: {
    opacity: 0.7,
  },
  group: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dateCol: {
    width: 48,
    paddingTop: 2,
  },
  dateText: {
    fontSize: 16,
  },
  weekdayText: {
    fontSize: 13,
  },
  groupBody: {
    flex: 1,
  },
  groupHeader: {
    paddingLeft: 56,
    paddingBottom: 8,
    paddingTop: 4,
  },
  groupHeaderText: {
    fontSize: 13,
    opacity: 0.6,
  },
  itemRow: {
    flexDirection: 'row',
  },
  iconCol: {
    width: 56,
    alignItems: 'center',
  },
  timelineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
    lineHeight: 24,
  },
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 4,
  },
  amount: {
    fontSize: 20,
    lineHeight: 26,
  },
  categoryText: {
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    fontSize: 12,
  },
  metaText: {
    fontSize: 13,
    opacity: 0.7,
    flex: 1,
  },
});
