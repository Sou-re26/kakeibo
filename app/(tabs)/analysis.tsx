import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { and, gte, lt } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { PagedTabs } from '@/components/paged-tabs';
import { PieChart } from '@/components/pie-chart';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORIES, getCategoryLabel } from '@/constants/categories';
import { CategoryColors, Colors } from '@/constants/theme';
import { totalBudget, useSettings } from '@/contexts/settings';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { useAutoHideFab } from '@/hooks/use-auto-hide-fab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMonthRange, summarizeByCategory, summarizeTransactions } from '@/lib/summary';

type SummaryRow = {
  type: string;
  amount: number;
  categoryKey: string | null;
};

const TABS = [
  { key: 'balance', label: '収支' },
  { key: 'budget', label: '予算比' },
] as const;

export default function AnalysisScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings } = useSettings();
  const { hidden: fabHidden, scrollHandlers } = useAutoHideFab();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('balance');
  const [selectedType, setSelectedType] = useState<'支出' | '収入'>('支出');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadRows = async () => {
        try {
          const { start, end } = getMonthRange(new Date());
          const result = await db
            .select({
              type: transactions.type,
              amount: transactions.amount,
              categoryKey: transactions.categoryKey,
            })
            .from(transactions)
            .where(and(gte(transactions.date, start), lt(transactions.date, end)));

          if (isActive) {
            setRows(result);
          }
        } catch (error) {
          console.error(error);
        }
      };

      loadRows();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const categoryColors = CategoryColors[colorScheme];
  const summary = summarizeTransactions(rows);
  const byCategory = summarizeByCategory(rows, selectedType);
  const total = selectedType === '支出' ? summary.expense : summary.income;
  const pieData = byCategory.map((item) => ({
    key: item.categoryKey ?? 'uncategorized',
    value: item.total,
    color: categoryColors[item.categoryKey ?? 'uncategorized'] ?? categoryColors.uncategorized,
    label: getCategoryLabel(item.categoryKey) ?? '未分類',
  }));

  const expenseByCategory = summarizeByCategory(rows, '支出');
  const budgetTotal = totalBudget(settings.categoryBudgets);
  const spentByKey = new Map(expenseByCategory.map((item) => [item.categoryKey, item.total]));
  // 予算があるか今月支出があるカテゴリだけを、カテゴリマスタの順で並べる
  const budgetRows = [
    ...CATEGORIES.map((cat) => ({
      key: cat.key,
      label: `${cat.icon} ${cat.label}`,
      spent: spentByKey.get(cat.key) ?? 0,
      budget: settings.categoryBudgets[cat.key] ?? null,
    })),
    {
      key: 'uncategorized',
      label: '未分類',
      spent: spentByKey.get(null) ?? 0,
      budget: null,
    },
  ].filter((row) => row.budget !== null || row.spent > 0);

  const percentText = (spent: number, base: number) => `${Math.round((spent / base) * 100)}%`;

  const renderBudgetBar = (spent: number, budget: number, barColor: string) => {
    const ratio = Math.min(spent / budget, 1);
    return (
      <View style={[styles.barTrack, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.barFill,
            { width: `${ratio * 100}%`, backgroundColor: spent > budget ? colors.critical : barColor },
          ]}
        />
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTitleRow}>
          <SettingsButton />
          <ThemedText type="title">分析</ThemedText>
        </View>
        <ThemedText style={styles.subtitle}>今月のカテゴリ別内訳</ThemedText>
      </View>

      <View style={styles.segmentRow}>
        {TABS.map((item) => {
          const selected = item.key === tab;
          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.segment,
                { borderColor: colors.tint },
                selected && { backgroundColor: colors.tint },
                pressed && styles.pressed,
              ]}
              onPress={() => setTab(item.key)}
            >
              <ThemedText
                type={selected ? 'defaultSemiBold' : 'default'}
                style={selected && { color: colors.background }}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <PagedTabs
        index={tab === 'balance' ? 0 : 1}
        onIndexChange={(index) => setTab(index === 0 ? 'balance' : 'budget')}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 88 }]}
          {...scrollHandlers}
        >
          <>
            <Pressable
              style={styles.chartArea}
              onPress={() => setSelectedType((prev) => (prev === '支出' ? '収入' : '支出'))}
            >
              <PieChart
                data={pieData}
                size={220}
                centerTitle={selectedType}
                centerValue={`¥${total.toLocaleString()}`}
              />
              <ThemedText style={styles.chartHint}>
                タップで{selectedType === '支出' ? '収入' : '支出'}に切り替え
              </ThemedText>
            </Pressable>

            {byCategory.length === 0 ? (
              <ThemedText style={styles.empty}>今月の{selectedType}はまだありません。</ThemedText>
            ) : (
              byCategory.map((item) => {
                const key = item.categoryKey ?? 'uncategorized';
                const ratio = total > 0 ? item.total / total : 0;
                return (
                  <View key={key} style={styles.categoryRow}>
                    <View
                      style={[
                        styles.colorChip,
                        { backgroundColor: categoryColors[key] ?? categoryColors.uncategorized },
                      ]}
                    />
                    <ThemedText style={styles.categoryLabel}>
                      {getCategoryLabel(item.categoryKey) ?? '未分類'}
                    </ThemedText>
                    <ThemedText style={styles.ratio}>{Math.round(ratio * 100)}%</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.amount}>
                      ¥{item.total.toLocaleString()}
                    </ThemedText>
                  </View>
                );
              })
            )}
          </>
        </ScrollView>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 88 }]}
          {...scrollHandlers}
        >
          <>
            {/* 総額の予算比 */}
            <View style={[styles.summaryCard, { borderColor: colors.border }]}>
              <ThemedText style={styles.cardLabel}>予算比(総額)</ThemedText>
              {budgetTotal === null ? (
                <ThemedText style={styles.empty}>
                  予算が未設定です。設定画面でカテゴリ別予算を入力してください。
                </ThemedText>
              ) : (
                <>
                  <View style={styles.cardValueRow}>
                    <ThemedText type="defaultSemiBold" style={styles.cardValue}>
                      ¥{summary.expense.toLocaleString()} / ¥{budgetTotal.toLocaleString()}
                    </ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={{
                        color: summary.expense > budgetTotal ? colors.critical : colors.text,
                      }}
                    >
                      {percentText(summary.expense, budgetTotal)}
                    </ThemedText>
                  </View>
                  {renderBudgetBar(summary.expense, budgetTotal, colors.tint)}
                </>
              )}
            </View>

            {/* 収入比 */}
            <View style={[styles.summaryCard, { borderColor: colors.border }]}>
              <ThemedText style={styles.cardLabel}>収入比</ThemedText>
              {summary.income === 0 ? (
                <ThemedText style={styles.empty}>今月の収入はまだありません。</ThemedText>
              ) : (
                <View style={styles.cardValueRow}>
                  <ThemedText type="defaultSemiBold" style={styles.cardValue}>
                    ¥{summary.expense.toLocaleString()} / ¥{summary.income.toLocaleString()}
                  </ThemedText>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{
                      color: summary.expense > summary.income ? colors.critical : colors.text,
                    }}
                  >
                    {percentText(summary.expense, summary.income)}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* カテゴリ別の予算比 */}
            <ThemedText type="subtitle" style={styles.budgetListTitle}>
              カテゴリ別の予算比
            </ThemedText>
            {budgetRows.length === 0 ? (
              <ThemedText style={styles.empty}>
                予算のあるカテゴリも今月の支出もまだありません。
              </ThemedText>
            ) : (
              budgetRows.map((row) => (
                <View key={row.key} style={styles.budgetRow}>
                  <View style={styles.budgetRowHeader}>
                    <ThemedText style={styles.categoryLabel}>{row.label}</ThemedText>
                    <ThemedText style={styles.budgetAmount}>
                      ¥{row.spent.toLocaleString()}
                      {row.budget !== null ? ` / ¥${row.budget.toLocaleString()}` : ''}
                    </ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.budgetPercent,
                        row.budget !== null && row.spent > row.budget
                          ? { color: colors.critical }
                          : null,
                      ]}
                    >
                      {row.budget !== null ? percentText(row.spent, row.budget) : '予算未設定'}
                    </ThemedText>
                  </View>
                  {row.budget !== null
                    ? renderBudgetBar(
                        row.spent,
                        row.budget,
                        categoryColors[row.key] ?? categoryColors.uncategorized,
                      )
                    : null}
                </View>
              ))
            )}
          </>
        </ScrollView>
      </PagedTabs>

      <AddTransactionFab hidden={fabHidden} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    gap: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subtitle: {
    opacity: 0.6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  chartArea: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  chartHint: {
    fontSize: 12,
    opacity: 0.5,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  colorChip: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 16,
  },
  ratio: {
    fontSize: 13,
    opacity: 0.6,
  },
  amount: {
    fontSize: 16,
    minWidth: 90,
    textAlign: 'right',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cardLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  cardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardValue: {
    fontSize: 16,
  },
  budgetListTitle: {
    marginTop: 8,
  },
  budgetRow: {
    gap: 6,
    paddingVertical: 4,
  },
  budgetRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetAmount: {
    fontSize: 13,
    opacity: 0.7,
  },
  budgetPercent: {
    fontSize: 13,
    minWidth: 64,
    textAlign: 'right',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
