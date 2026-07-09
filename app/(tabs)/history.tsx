import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { asc, desc } from 'drizzle-orm';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { PagedTabs } from '@/components/paged-tabs';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionCalendar } from '@/components/transaction-calendar';
import { TransactionSearchSheet } from '@/components/transaction-search-sheet';
import { TransactionTimeline } from '@/components/transaction-timeline';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useTransactionDraft } from '@/contexts/transaction-draft';
import { db } from '@/db/client';
import {
  accounts,
  recurrings,
  transactions,
  type Account,
  type Recurring,
  type Transaction,
} from '@/db/schema';
import { useAutoHideFab } from '@/hooks/use-auto-hide-fab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupTransactionsByDay, type DayGroup } from '@/lib/timeline';
import {
  countActiveConditions,
  EMPTY_FILTER,
  filterTransactions,
  isEmptyFilter,
  type TransactionFilter,
} from '@/lib/transaction-filter';

const VIEWS = ['timeline', 'calendar'] as const;

export default function HistoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { startEdit } = useTransactionDraft();
  const { hidden: fabHidden, scrollHandlers } = useAutoHideFab();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [recurringList, setRecurringList] = useState<Recurring[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<(typeof VIEWS)[number]>('timeline');
  const [selectedDay, setSelectedDay] = useState<DayGroup<Transaction> | null>(null);
  const [filter, setFilter] = useState<TransactionFilter>(EMPTY_FILTER);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // 設定ドロワーで定期収支が変わっても画面フォーカスは失われないため、閉じたら再読込する
  const [drawerGen, setDrawerGen] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadTransactions = async () => {
        try {
          const [txRows, accountRows, recurringRows] = await Promise.all([
            db.select().from(transactions).orderBy(desc(transactions.date)),
            db.select().from(accounts).orderBy(asc(accounts.id)),
            db.select().from(recurrings).orderBy(asc(recurrings.dayOfMonth)),
          ]);
          if (isActive) {
            setRows(txRows);
            setAccountList(accountRows);
            setRecurringList(recurringRows);
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
      // drawerGen は設定ドロワーを閉じたときに再読込させるための意図的な依存
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawerGen]),
  );

  const handlePressItem = (item: Transaction) => {
    setSelectedDay(null);
    startEdit(item);
    router.push('/input');
  };

  const accountNames = useMemo(
    () => new Map(accountList.map((acc) => [acc.id, acc.name])),
    [accountList],
  );
  // 絞り込みはタイムライン・カレンダーの両方に効く(カレンダーの日別合計も絞り込み後の値)
  const groups = useMemo(
    () => groupTransactionsByDay(filterTransactions(rows, filter)),
    [rows, filter],
  );
  const filterActive = !isEmptyFilter(filter);
  const matchCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.titleRow}>
        <View style={styles.headerLeft}>
          <SettingsButton onClosed={() => setDrawerGen((gen) => gen + 1)} />
          <ThemedText type="title">履歴</ThemedText>
        </View>
        <Pressable hitSlop={8} onPress={() => setIsSearchOpen(true)}>
          <IconSymbol
            name="magnifyingglass"
            size={24}
            color={filterActive ? colors.accent : colors.icon}
          />
        </Pressable>
      </View>

      {/* タイムライン/カレンダーの切り替え(タップ+左右スワイプ) */}
      <View style={styles.segmentRow}>
        {(
          [
            { key: 'timeline', label: 'タイムライン' },
            { key: 'calendar', label: 'カレンダー' },
          ] as const
        ).map((segment) => (
          <Pressable
            key={segment.key}
            onPress={() => setView(segment.key)}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: view === segment.key ? colors.accent : colors.card },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              style={{ color: view === segment.key ? colors.onAccent : colors.text }}
              type={view === segment.key ? 'defaultSemiBold' : 'default'}
            >
              {segment.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* 絞り込み中の表示(検索モーダルで条件を適用すると出る) */}
      {filterActive ? (
        <View style={[styles.filterBar, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.filterBarText}>
            {countActiveConditions(filter)}件の条件で絞り込み中(該当{matchCount}件)
          </ThemedText>
          <Pressable hitSlop={8} onPress={() => setFilter(EMPTY_FILTER)}>
            <ThemedText type="defaultSemiBold" style={{ color: colors.tint }}>
              解除
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <PagedTabs
        index={VIEWS.indexOf(view)}
        onIndexChange={(index) => setView(VIEWS[index] ?? 'timeline')}
      >
        {isLoading ? (
          <ThemedText style={styles.message}>読み込み中...</ThemedText>
        ) : groups.length === 0 ? (
          <ThemedText style={styles.message}>
            {rows.length === 0 ? 'まだ記録がありません。' : '条件に一致する記録がありません。'}
          </ThemedText>
        ) : (
          <TransactionTimeline
            groups={groups}
            accountNames={accountNames}
            contentPaddingBottom={tabBarHeight + 88}
            onPressItem={handlePressItem}
            scrollHandlers={scrollHandlers}
          />
        )}
        <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 88 }} {...scrollHandlers}>
          <TransactionCalendar
            groups={groups}
            recurrings={recurringList}
            onPressDay={setSelectedDay}
          />
        </ScrollView>
      </PagedTabs>

      {/* 日別履歴のボトムシート(カレンダーの日タップで表示) */}
      <Modal
        visible={selectedDay !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDay(null)}
      >
        <Pressable
          style={[styles.sheetBackdrop, { backgroundColor: colors.scrim }]}
          onPress={() => setSelectedDay(null)}
        >
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {selectedDay ? (
              <TransactionTimeline
                groups={[selectedDay]}
                accountNames={accountNames}
                contentPaddingBottom={8}
                onPressItem={handlePressItem}
              />
            ) : null}
          </View>
        </Pressable>
      </Modal>

      {/* 検索・絞り込みモーダル */}
      <TransactionSearchSheet
        visible={isSearchOpen}
        initial={filter}
        accounts={accountList}
        onClose={() => setIsSearchOpen(false)}
        onApply={setFilter}
      />

      <AddTransactionFab hidden={fabHidden} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  filterBarText: {
    flex: 1,
    fontSize: 13,
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
  pressed: {
    opacity: 0.6,
  },
  message: {
    opacity: 0.7,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
});
