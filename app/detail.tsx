import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { asc } from 'drizzle-orm';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatCategoryLabel } from '@/constants/categories';
import { Colors } from '@/constants/theme';
import { db } from '@/db/client';
import { accounts, transactions, type Account } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { type, amount, categoryKey, subcategoryKey } = useLocalSearchParams<{
    type: string;
    amount: string;
    categoryKey?: string;
    subcategoryKey?: string;
  }>();
  const [date, setDate] = useState(new Date());
  const [store, setStore] = useState('');
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null); // 支出/収入: 対象、振替: 出金元
  const [toAccountId, setToAccountId] = useState<number | null>(null); // 振替の入金先
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadAccounts = async () => {
      try {
        const rows = await db.select().from(accounts).orderBy(asc(accounts.id));
        if (isActive) {
          setAccountList(rows);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadAccounts();

    return () => {
      isActive = false;
    };
  }, []);

  const accountName = (id: number | null) =>
    accountList.find((acc) => acc.id === id)?.name ?? '指定なし';

  const selectAccount = (id: number | null) => {
    if (pickerTarget === 'to') {
      setToAccountId(id);
    } else {
      setAccountId(id);
    }
    setPickerTarget(null);
  };

  const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${
    ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  })　${date.getHours()}時`;

  const handleSave = async () => {
    if (!type || !amount) {
      Alert.alert('保存できません', '種別と金額が必要です。');
      return;
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount)) {
      Alert.alert('保存できません', '金額の形式が正しくありません。');
      return;
    }

    if (type === '振替' && accountId !== null && accountId === toAccountId) {
      Alert.alert('保存できません', '出金元と入金先が同じ口座です。');
      return;
    }

    try {
      setIsSaving(true);
      await db.insert(transactions).values({
        type,
        amount: parsedAmount,
        categoryKey: categoryKey ?? null,
        subcategoryKey: subcategoryKey ?? null,
        accountId,
        toAccountId: type === '振替' ? toAccountId : null,
        store: store.trim() || null,
        memo: memo.trim() || null,
        date,
      });
      router.replace('/(tabs)');
    } catch (error) {
      console.error(error);
      Alert.alert('保存に失敗しました', 'もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      onChange: (event, selectedDate) => {
        if (event.type !== 'set' || !selectedDate) return;

        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type !== 'set' || !selectedTime) return;

            const combined = new Date(selectedDate);
            combined.setHours(selectedTime.getHours());
            combined.setMinutes(selectedTime.getMinutes());
            setDate(combined);
          },
        });
      },
    });
  };

  return (
    <ThemedView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={styles.closeIcon}>✕</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          記録の詳細
        </ThemedText>
      </View>

      {/* 金額表示 */}
      <View style={styles.amountRow}>
        <ThemedText style={styles.currencyLabel}>¥{'\n'}JPY</ThemedText>
        <ThemedText style={styles.amountText}>{amount}</ThemedText>
      </View>

      {/* 日付・時刻 */}
      <Pressable style={styles.row} onPress={openDatePicker}>
        <ThemedText style={styles.icon}>📅</ThemedText>
        <ThemedText style={styles.rowText}>{formattedDate}</ThemedText>
      </Pressable>

      {/* カテゴリ(振替は資産移動なのでカテゴリを持たない) */}
      {type !== '振替' ? (
        <Pressable
          style={styles.row}
          onPress={() => router.push({ pathname: '/category', params: { type, amount } })}
        >
          <ThemedText style={styles.icon}>🍴</ThemedText>
          <ThemedText style={styles.rowText}>
            {formatCategoryLabel(categoryKey, subcategoryKey) ?? 'カテゴリを選択'}
          </ThemedText>
        </Pressable>
      ) : null}

      {/* 口座 */}
      {type === '振替' ? (
        <>
          <Pressable style={styles.row} onPress={() => setPickerTarget('from')}>
            <ThemedText style={styles.icon}>🐷</ThemedText>
            <ThemedText style={styles.rowText}>出金元: {accountName(accountId)}</ThemedText>
          </Pressable>
          <Pressable style={styles.row} onPress={() => setPickerTarget('to')}>
            <ThemedText style={styles.icon}>💰</ThemedText>
            <ThemedText style={styles.rowText}>入金先: {accountName(toAccountId)}</ThemedText>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.row} onPress={() => setPickerTarget('from')}>
          <ThemedText style={styles.icon}>🐷</ThemedText>
          <ThemedText style={styles.rowText}>財布: {accountName(accountId)}</ThemedText>
        </Pressable>
      )}

      {/* お店 */}
      <View style={styles.row}>
        <ThemedText style={styles.icon}>🏬</ThemedText>
        <TextInput
          style={styles.rowInput}
          placeholder="お店"
          placeholderTextColor="#999"
          value={store}
          onChangeText={setStore}
        />
      </View>

      {/* メモ */}
      <TextInput
        style={styles.memoBox}
        placeholder="メモ"
        placeholderTextColor="#999"
        value={memo}
        onChangeText={setMemo}
        multiline
      />

      {/* 記録するボタン */}
      <Pressable
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <ThemedText style={styles.saveText}>{isSaving ? '保存中...' : '記録する'}</ThemedText>
      </Pressable>

      {/* 口座選択モーダル */}
      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: Colors[colorScheme].scrim }]}
          onPress={() => setPickerTarget(null)}
        >
          <View style={[styles.modalSheet, { backgroundColor: Colors[colorScheme].background }]}>
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
              {pickerTarget === 'to' ? '入金先の口座' : '口座を選択'}
            </ThemedText>
            <Pressable style={styles.modalRow} onPress={() => selectAccount(null)}>
              <ThemedText style={styles.rowText}>指定なし</ThemedText>
            </Pressable>
            {accountList.map((acc) => (
              <Pressable key={acc.id} style={styles.modalRow} onPress={() => selectAccount(acc.id)}>
                <ThemedText style={styles.rowText}>{acc.name}</ThemedText>
              </Pressable>
            ))}
            {accountList.length === 0 ? (
              <ThemedText style={styles.modalEmpty}>
                口座がありません。「残高」タブから追加できます。
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  closeIcon: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 22,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  currencyLabel: {
    fontSize: 14,
    color: '#888',
  },
  amountText: {
  fontSize: 48,
  fontWeight: 'bold',
  lineHeight: 56,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderColor: '#ddd',
  },
  icon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  rowText: {
    fontSize: 16,
  },
  rowInput: {
    fontSize: 16,
    flex: 1,
    color: '#000',
  },
  memoBox: {
    marginTop: 16,
    minHeight: 100,
    backgroundColor: '#eee',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 'auto',
    marginBottom: 20,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  modalSheet: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: '#ddd',
  },
  modalEmpty: {
    paddingVertical: 12,
    opacity: 0.6,
    fontSize: 14,
  },
});