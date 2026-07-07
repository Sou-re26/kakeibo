import { and, gte, lt } from 'drizzle-orm';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { PieChart } from '@/components/pie-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCategoryLabel } from '@/constants/categories';
import { CategoryColors } from '@/constants/theme';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMonthRange, summarizeByCategory, summarizeTransactions } from '@/lib/summary';

type SummaryRow = {
  type: string;
  amount: number;
  categoryKey: string | null;
};

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [rows, setRows] = useState<SummaryRow[]>([]);

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

  const summary = summarizeTransactions(rows);
  const categoryColors = CategoryColors[colorScheme];
  const expenseByCategory = summarizeByCategory(rows, '支出');
  const pieData = expenseByCategory.map((item) => ({
    key: item.categoryKey ?? 'uncategorized',
    value: item.total,
    color: categoryColors[item.categoryKey ?? 'uncategorized'] ?? categoryColors.uncategorized,
  }));

  return (
    <ThemedView style={styles.container}>
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

      <AddTransactionFab />
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
});