import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { asc } from 'drizzle-orm';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddTransactionFab } from '@/components/add-transaction-fab';
import { LineChart } from '@/components/line-chart';
import { SettingsButton } from '@/components/settings-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useSettings } from '@/contexts/settings';
import { useTransactionDraft } from '@/contexts/transaction-draft';
import { db } from '@/db/client';
import { accounts, transactions, type Account } from '@/db/schema';
import { useAutoHideFab } from '@/hooks/use-auto-hide-fab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { accountDelta, currentBalance, totalTransactionDelta } from '@/lib/balance';
import { balanceSeriesBy, type DatedBalanceTransaction } from '@/lib/balance-history';

export default function BalanceScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings, updateSettings } = useSettings();
  const { startNew, updateDraft } = useTransactionDraft();
  const { hidden: fabHidden, scrollHandlers } = useAutoHideFab();
  const [items, setItems] = useState<Account[]>([]);
  const [txRows, setTxRows] = useState<DatedBalanceTransaction[]>([]);

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
                date: transactions.date,
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

  const hide = settings.hideBalances;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRows = txRows.filter((row) => row.date >= monthStart);

  // 現在残高 = 基準残高 + 取引差分(lib/balance.ts)。今月の増減=前月末比の内訳
  const balances = items.map((acc) => ({
    account: acc,
    current: currentBalance(acc, txRows),
    monthDelta: accountDelta(acc.id, monthRows),
  }));
  const total = balances.reduce((sum, b) => sum + b.current, 0);
  const totalMonthDelta = balances.reduce((sum, b) => sum + b.monthDelta, 0);

  // 総残高のスパークライン(直近3ヶ月)。全口座合算の擬似口座として計算する
  const idSet = new Set(items.map((acc) => acc.id));
  const baseTotal = items.reduce((sum, acc) => sum + acc.balance, 0);
  const sparkStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const series = balanceSeriesBy(
    baseTotal,
    txRows,
    (tx) => totalTransactionDelta(idSet, tx),
    sparkStart,
    now,
  );

  const money = (value: number) => (hide ? '¥•••••' : `¥${value.toLocaleString()}`);
  const signedMoney = (value: number) => {
    if (hide) return '¥•••••';
    if (value > 0) return `+¥${value.toLocaleString()}`;
    if (value < 0) return `-¥${Math.abs(value).toLocaleString()}`;
    return '±¥0';
  };
  // 増=緑、減・変化なし=通常色(マスク中は薄く)
  const deltaColor = (value: number) => {
    if (hide) return colors.icon;
    return value > 0 ? colors.income : colors.text;
  };

  const startTransferFrom = (accountId: number) => {
    startNew();
    updateDraft({ type: '振替', accountId });
    router.push('/input');
  };

  const borderColor = colors.border;

  return (
    <ThemedView style={styles.container}>
      {/* 固定ヘッダー(スクロールしても画面外に行かない) */}
      <View style={[styles.titleRow, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <SettingsButton />
          <ThemedText type="title">残高</ThemedText>
        </View>
        <Pressable hitSlop={8} onPress={() => updateSettings({ hideBalances: !hide })}>
          <IconSymbol
            name={hide ? 'eye.slash.fill' : 'eye.fill'}
            size={24}
            color={colors.icon}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 88 }]}
        {...scrollHandlers}
      >
        <View style={[styles.totalCard, { borderColor }]}>
          <ThemedText style={styles.totalLabel}>総残高</ThemedText>
          <ThemedText type="title" style={styles.totalAmount}>
            {money(total)}
          </ThemedText>
          <ThemedText style={[styles.totalDelta, { color: deltaColor(totalMonthDelta) }]}>
            前月末比 {signedMoney(totalMonthDelta)}
          </ThemedText>
          {/* マスク中はグリッドラベルから金額が読めるためグラフごと隠す */}
          {!hide && items.length > 0 ? (
            <LineChart
              data={series.map((p) => ({ date: p.date, value: p.balance }))}
              height={120}
            />
          ) : null}
        </View>

        {items.length === 0 ? (
          <ThemedText style={styles.empty}>
            口座がありません。下の「口座を追加」から登録してください。
          </ThemedText>
        ) : (
          balances.map(({ account, current, monthDelta }) => (
            <Link
              key={account.id}
              href={{ pathname: '/account-detail', params: { id: String(account.id) } }}
              asChild
            >
              <Pressable
                style={StyleSheet.flatten([styles.accountRow, { backgroundColor: colors.card }])}
                onLongPress={() => startTransferFrom(account.id)}
              >
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <ThemedText style={[styles.avatarText, { color: colors.onAccent }]}>
                    {account.name.charAt(0)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.accountName}>{account.name}</ThemedText>
                <View style={styles.accountRight}>
                  <ThemedText type="defaultSemiBold" style={styles.accountBalance}>
                    {money(current)}
                  </ThemedText>
                  <ThemedText style={[styles.accountDelta, { color: deltaColor(monthDelta) }]}>
                    今月 {signedMoney(monthDelta)}
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.icon} />
              </Pressable>
            </Link>
          ))
        )}

        {items.length > 0 ? (
          <ThemedText style={styles.hint}>口座を長押しすると、その口座からの振替を開始します。</ThemedText>
        ) : null}

        <Link href="/account" asChild>
          <Pressable style={StyleSheet.flatten([styles.addButton, { borderColor: colors.tint }])}>
            <ThemedText style={{ color: colors.tint }}>＋ 口座を追加</ThemedText>
          </Pressable>
        </Link>
      </ScrollView>

      <AddTransactionFab hidden={fabHidden} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  totalDelta: {
    fontSize: 13,
    marginBottom: 4,
  },
  empty: {
    opacity: 0.6,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 'bold',
  },
  accountName: {
    flex: 1,
    fontSize: 16,
  },
  accountRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 16,
  },
  accountDelta: {
    fontSize: 12,
  },
  hint: {
    fontSize: 12,
    opacity: 0.5,
  },
  addButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
  },
});
