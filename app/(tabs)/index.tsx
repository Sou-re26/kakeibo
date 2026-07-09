import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { and, gte, lt } from 'drizzle-orm';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { PieChart } from '@/components/pie-chart';
import { SettingsButton } from '@/components/settings-button';
import { SpendingSummary, SPENDING_MONTHS } from '@/components/spending-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCategoryLabel } from '@/constants/categories';
import { CategoryColors, Colors } from '@/constants/theme';
import { useSettings } from '@/contexts/settings';
import { db } from '@/db/client';
import { recurrings, transactions, type Recurring } from '@/db/schema';
import { useAutoHideFab } from '@/hooks/use-auto-hide-fab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { applyDueRecurrings } from '@/lib/apply-recurrings';
import { daysUntil, nextOccurrence } from '@/lib/recurring';
import { lastMonthStarts } from '@/lib/spending';
import { getMonthRange, summarizeByCategory, summarizeTransactions } from '@/lib/summary';

type SummaryRow = {
  type: string;
  amount: number;
  categoryKey: string | null;
  date: Date;
};

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings } = useSettings();
  const { hidden: fabHidden, scrollHandlers } = useAutoHideFab();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [recurringList, setRecurringList] = useState<Recurring[]>([]);
  const [now, setNow] = useState(() => new Date());
  // 設定ドロワーで定期収支が変わっても画面フォーカスは失われないため、閉じたら再読込する
  const [drawerGen, setDrawerGen] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadRows = async () => {
        try {
          const current = new Date();
          // 期日が来た定期収支を先に記帳してから読む(結果を同じフォーカスで反映する)
          await applyDueRecurrings(current);
          // 「使ったお金」(期間別+前月比)のために表示月数+1ヶ月分をまとめて読む
          const start = lastMonthStarts(current, SPENDING_MONTHS + 1)[0];
          const { end } = getMonthRange(current);
          const [result, recurringRows] = await Promise.all([
            db
              .select({
                type: transactions.type,
                amount: transactions.amount,
                categoryKey: transactions.categoryKey,
                date: transactions.date,
              })
              .from(transactions)
              .where(and(gte(transactions.date, start), lt(transactions.date, end))),
            db.select().from(recurrings),
          ]);

          if (isActive) {
            setRows(result);
            setRecurringList(recurringRows);
            setNow(current);
          }
        } catch (error) {
          console.error(error);
        }
      };

      loadRows();

      return () => {
        isActive = false;
      };
      // drawerGen は設定ドロワーを閉じたときに再読込させるための意図的な依存
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawerGen]),
  );

  const { start: monthStart, end: monthEnd } = getMonthRange(now);
  const monthRows = rows.filter((row) => row.date >= monthStart && row.date < monthEnd);

  const summary = summarizeTransactions(monthRows);
  const categoryColors = CategoryColors[colorScheme];
  const expenseByCategory = summarizeByCategory(monthRows, '支出');
  const pieData = expenseByCategory.map((item) => ({
    key: item.categoryKey ?? 'uncategorized',
    value: item.total,
    color: categoryColors[item.categoryKey ?? 'uncategorized'] ?? categoryColors.uncategorized,
    label: getCategoryLabel(item.categoryKey) ?? '未分類',
  }));

  return (
    <ThemedView style={styles.container}>
      {/* 固定ヘッダー(設定ドロワーの開閉ボタン。スクロールしても画面外に行かない) */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + 12 }]}>
        <SettingsButton onClosed={() => setDrawerGen((gen) => gen + 1)} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 88 }]}
        {...scrollHandlers}
      >
        <ThemedText type="subtitle">今月の収支</ThemedText>
        <ThemedText type="title" style={styles.amount}>
          ¥{summary.balance.toLocaleString()}
        </ThemedText>

        <View style={styles.summaryRow}>
          <ThemedView style={styles.summaryBox}>
            <ThemedText>収入</ThemedText>
            <ThemedText type="defaultSemiBold">¥{summary.income.toLocaleString()}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.summaryBox}>
            <ThemedText>支出</ThemedText>
            <ThemedText type="defaultSemiBold">¥{summary.expense.toLocaleString()}</ThemedText>
          </ThemedView>
        </View>

        {/* 支払日が近い定期支出の警告(しきい値は設定 alertDaysBefore) */}
        {recurringList
          .filter((item) => item.type === 'expense')
          .map((item) => ({ item, days: daysUntil(nextOccurrence(item.dayOfMonth, now), now) }))
          .filter(({ days }) => days <= settings.alertDaysBefore)
          .sort((a, b) => a.days - b.days)
          .map(({ item, days }) => (
            <View
              key={`alert-${item.id}`}
              style={[styles.alertCard, { borderColor: Colors[colorScheme].critical }]}
            >
              <ThemedText style={[styles.alertText, { color: Colors[colorScheme].critical }]}>
                ⚠️{' '}
                {days === 0
                  ? `今日は「${item.label}」の支払日です`
                  : `「${item.label}」の支払日まであと${days}日です`}
                {item.amount !== null ? `(¥${item.amount.toLocaleString()})` : ''}
              </ThemedText>
            </View>
          ))}

        <Link href="/analysis" asChild>
          <Pressable>
            <ThemedText type="subtitle" style={styles.chartTitle}>
              支出の内訳
            </ThemedText>
            <View style={styles.chartRow}>
              <PieChart
                data={pieData}
                size={150}
                centerTitle="支出"
                centerValue={`¥${summary.expense.toLocaleString()}`}
              />
              <View style={styles.legend}>
                {expenseByCategory.map((item) => {
                  const key = item.categoryKey ?? 'uncategorized';
                  return (
                    <View key={key} style={styles.legendRow}>
                      <View
                        style={[
                          styles.legendChip,
                          { backgroundColor: categoryColors[key] ?? categoryColors.uncategorized },
                        ]}
                      />
                      <ThemedText style={styles.legendLabel}>
                        {getCategoryLabel(item.categoryKey) ?? '未分類'}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Link>

        {/* 定期収支までの残り日数(円グラフ直下) */}
        {recurringList.length > 0 ? (
          <View style={styles.recurringSection}>
            {recurringList
              .map((item) => {
                const next = nextOccurrence(item.dayOfMonth, now);
                return { item, next, days: daysUntil(next, now) };
              })
              .sort((a, b) => a.days - b.days)
              .map(({ item, next, days }) => (
                <View
                  key={item.id}
                  style={[styles.recurringRow, { borderColor: Colors[colorScheme].border }]}
                >
                  <View
                    style={[
                      styles.recurringDot,
                      {
                        backgroundColor:
                          item.type === 'income'
                            ? Colors[colorScheme].accent
                            : Colors[colorScheme].critical,
                      },
                    ]}
                  />
                  <ThemedText style={styles.recurringLabel}>{item.label}</ThemedText>
                  <ThemedText style={styles.recurringDate}>
                    {next.getMonth() + 1}/{next.getDate()}
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.recurringDays}>
                    {days === 0 ? '今日' : `あと${days}日`}
                  </ThemedText>
                </View>
              ))}
          </View>
        ) : null}

        <SpendingSummary rows={rows} now={now} />
      </ScrollView>

      <AddTransactionFab hidden={fabHidden} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  content: {
    padding: 20,
    paddingTop: 4,
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
  chartTitle: {
    marginTop: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 12,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendChip: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 14,
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 19,
  },
  recurringSection: {
    marginTop: 4,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  recurringDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recurringLabel: {
    flex: 1,
    fontSize: 15,
  },
  recurringDate: {
    fontSize: 13,
    opacity: 0.6,
  },
  recurringDays: {
    fontSize: 15,
    minWidth: 64,
    textAlign: 'right',
  },
});
