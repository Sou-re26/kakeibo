import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getCategoryLabel } from '@/constants/categories';
import { CategoryColors, Colors } from '@/constants/theme';
import { totalBudget, useSettings, type HomeComparison } from '@/contexts/settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  summarizeCategorySpending,
  summarizeMonthlySpending,
  type CategorySpending,
  type MonthSpending,
} from '@/lib/spending';

type SpendingRow = {
  type: string;
  amount: number;
  categoryKey: string | null;
  date: Date;
};

type Props = {
  /** 表示範囲+前月比の計算に必要な月数分の取引(ホームが7ヶ月分渡す) */
  rows: SpendingRow[];
  now: Date;
};

/** 期間別で表示する月数 */
export const SPENDING_MONTHS = 6;

type Comparison = {
  text: string;
  /** undefined はテーマの通常色(薄め) */
  tone?: 'bad' | 'good';
};

function prevMonthComparison(total: number, prevTotal: number): Comparison {
  const diff = total - prevTotal;
  if (diff === 0) return { text: '前月比 ±¥0' };
  if (diff > 0) return { text: `前月比 +¥${diff.toLocaleString()}`, tone: 'bad' };
  return { text: `前月比 -¥${Math.abs(diff).toLocaleString()}`, tone: 'good' };
}

function budgetComparison(total: number, budget: number | null): Comparison {
  if (budget === null || budget === 0) return { text: '予算未設定' };
  const pct = Math.round((total / budget) * 100);
  return { text: `予算の${pct}%`, tone: pct > 100 ? 'bad' : undefined };
}

function incomeComparison(expense: number, income: number): Comparison {
  if (income === 0) return { text: '収入なし' };
  const pct = Math.round((expense / income) * 100);
  return { text: `収入の${pct}%`, tone: pct > 100 ? 'bad' : undefined };
}

// ホーム「使ったお金」。表示方式・比較対象は設定(contexts/settings.tsx)に従う
export function SpendingSummary({ rows, now }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const categoryColors = CategoryColors[colorScheme];
  const { settings } = useSettings();

  const toneColor = (tone: Comparison['tone']) => {
    if (tone === 'bad') return colors.critical;
    if (tone === 'good') return colors.income;
    return colors.icon;
  };

  const renderAmountCell = (total: number, comparison: Comparison) => (
    <View style={styles.amountCell}>
      <ThemedText type="defaultSemiBold" style={styles.amountText}>
        ¥{total.toLocaleString()}
      </ThemedText>
      <ThemedText style={[styles.comparisonText, { color: toneColor(comparison.tone) }]}>
        {comparison.text}
      </ThemedText>
    </View>
  );

  // カテゴリ別の予算比はそのカテゴリ自身の予算、期間別はカテゴリ予算の合計と比較する
  const categoryComparison = (item: CategorySpending, kind: HomeComparison): Comparison =>
    kind === 'budget'
      ? budgetComparison(
          item.total,
          item.categoryKey === null
            ? null
            : (settings.categoryBudgets[item.categoryKey] ?? null),
        )
      : prevMonthComparison(item.total, item.prevTotal);

  const monthComparison = (item: MonthSpending, kind: HomeComparison): Comparison => {
    if (kind === 'budget') return budgetComparison(item.expense, totalBudget(settings.categoryBudgets));
    if (kind === 'income') return incomeComparison(item.expense, item.income);
    return prevMonthComparison(item.expense, item.prevExpense);
  };

  let body;
  if (settings.homeBreakdown === 'category') {
    const items = summarizeCategorySpending(rows, now);
    body =
      items.length === 0 ? (
        <ThemedText style={styles.empty}>今月の支出はまだありません。</ThemedText>
      ) : (
        items.map((item) => {
          const key = item.categoryKey ?? 'uncategorized';
          return (
            <View key={key} style={[styles.row, { borderColor: colors.border }]}>
              <View
                style={[
                  styles.chip,
                  { backgroundColor: categoryColors[key] ?? categoryColors.uncategorized },
                ]}
              />
              <ThemedText style={styles.rowLabel}>
                {getCategoryLabel(item.categoryKey) ?? '未分類'}
              </ThemedText>
              {renderAmountCell(item.total, categoryComparison(item, settings.homeComparison))}
            </View>
          );
        })
      );
  } else {
    const items = summarizeMonthlySpending(rows, now, SPENDING_MONTHS);
    body = items.map((item) => (
      <View key={item.monthStart.getTime()} style={[styles.row, { borderColor: colors.border }]}>
        <ThemedText style={styles.rowLabel}>
          {item.monthStart.getFullYear()}年{item.monthStart.getMonth() + 1}月
        </ThemedText>
        {renderAmountCell(item.expense, monthComparison(item, settings.homeComparison))}
      </View>
    ));
  }

  return (
    <View>
      <ThemedText type="subtitle">使ったお金</ThemedText>
      <View style={styles.list}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 4,
  },
  empty: {
    opacity: 0.6,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  chip: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  amountCell: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
  },
  comparisonText: {
    fontSize: 12,
  },
});
