import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { and, gte, lt } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { PieChart } from '@/components/pie-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCategoryLabel } from '@/constants/categories';
import { CategoryColors, Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMonthRange, summarizeByCategory } from '@/lib/summary';

type SummaryRow = {
  type: string;
  amount: number;
  categoryKey: string | null;
};

const TYPES = ['支出', '収入'] as const;

export default function AnalysisScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [selectedType, setSelectedType] = useState<(typeof TYPES)[number]>('支出');

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
  const byCategory = summarizeByCategory(rows, selectedType);
  const total = byCategory.reduce((sum, item) => sum + item.total, 0);
  const pieData = byCategory.map((item) => ({
    key: item.categoryKey ?? 'uncategorized',
    value: item.total,
    color: categoryColors[item.categoryKey ?? 'uncategorized'] ?? categoryColors.uncategorized,
  }));

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <ThemedText type="title">分析</ThemedText>
        <ThemedText style={styles.subtitle}>今月のカテゴリ別内訳</ThemedText>
      </View>

      <View style={styles.segmentRow}>
        {TYPES.map((type) => {
          const selected = type === selectedType;
          return (
            <Pressable
              key={type}
              style={[
                styles.segment,
                { borderColor: Colors[colorScheme].tint },
                selected && { backgroundColor: Colors[colorScheme].tint },
              ]}
              onPress={() => setSelectedType(type)}
            >
              <ThemedText
                type={selected ? 'defaultSemiBold' : 'default'}
                style={selected && { color: Colors[colorScheme].background }}
              >
                {type}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 88 }]}>
        <View style={styles.chartArea}>
          <PieChart
            data={pieData}
            size={220}
            centerTitle={selectedType}
            centerValue={`¥${total.toLocaleString()}`}
          />
        </View>

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
      </ScrollView>

      <AddTransactionFab />
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
  content: {
    padding: 20,
    gap: 12,
  },
  chartArea: {
    alignItems: 'center',
    marginBottom: 8,
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
});
