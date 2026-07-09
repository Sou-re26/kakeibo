import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatCategoryLabel, getCategory } from '@/constants/categories';
import { CategoryColors, Colors } from '@/constants/theme';
import type { Transaction } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { FabScrollHandlers } from '@/hooks/use-auto-hide-fab';
import type { DayGroup } from '@/lib/timeline';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  groups: DayGroup<Transaction>[];
  /** 口座名の解決用(存在しないIDは「指定なし」扱い) */
  accountNames: ReadonlyMap<number, string>;
  /** FABやセーフエリアと重ならないための下余白 */
  contentPaddingBottom: number;
  onPressItem?: (item: Transaction) => void;
  /** FAB自動非表示(use-auto-hide-fab)用。FlatListへそのまま渡す */
  scrollHandlers?: FabScrollHandlers;
};

// 日別グループのタイムライン。左に日付、カテゴリ色のアイコン丸+縦線、右にカード
export function TransactionTimeline({
  groups,
  accountNames,
  contentPaddingBottom,
  onPressItem,
  scrollHandlers,
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
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

                <Pressable
                  style={[styles.card, { backgroundColor: colors.card }]}
                  onPress={onPressItem ? () => onPressItem(item) : undefined}
                >
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
                  {item.tags ? (
                    <View style={styles.metaRow}>
                      <ThemedText style={styles.metaIcon}>🏷️</ThemedText>
                      <ThemedText style={styles.metaText}>
                        {item.tags
                          .split(',')
                          .map((tag) => `#${tag}`)
                          .join(' ')}
                      </ThemedText>
                    </View>
                  ) : null}
                  {item.memo ? (
                    <View style={styles.metaRow}>
                      <ThemedText style={styles.metaIcon}>📝</ThemedText>
                      <ThemedText style={styles.metaText}>{item.memo}</ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={groups}
      keyExtractor={(group) => group.key}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
      renderItem={renderGroup}
      {...scrollHandlers}
    />
  );
}

const styles = StyleSheet.create({
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
