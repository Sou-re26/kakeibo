import { CalculatorSheet } from '@/components/calculator-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { asc, eq } from 'drizzle-orm';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatCategoryLabel } from '@/constants/categories';
import { Colors } from '@/constants/theme';
import { useTransactionDraft } from '@/contexts/transaction-draft';
import { db } from '@/db/client';
import { accounts, transactions, type Account } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { draft, updateDraft } = useTransactionDraft();
  const { editingId, type, amount, date, categoryKey, subcategoryKey, accountId, toAccountId } =
    draft;
  const [isSaving, setIsSaving] = useState(false);
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

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
      updateDraft({ toAccountId: id });
    } else {
      updateDraft({ accountId: id });
    }
    setPickerTarget(null);
  };

  const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${
    ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  })　${date.getHours()}時`;

  const handleSave = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount)) {
      Alert.alert('保存できません', '金額は整数(円)で入力してください。');
      return;
    }

    if (type === '振替') {
      if (accountId === null || toAccountId === null) {
        Alert.alert('保存できません', '振替には出金元と入金先の口座を指定してください。');
        return;
      }
      if (accountId === toAccountId) {
        Alert.alert('保存できません', '出金元と入金先が同じ口座です。');
        return;
      }
    }

    // タグは読点/カンマ区切りを許容し、カンマ区切りへ正規化して保存する
    const normalizedTags = draft.tags
      .split(/[,、]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(',');

    // 編集で種別を切り替えた場合に、旧種別のカテゴリ/入金先が残らないよう保存時に正規化する
    const payload = {
      type,
      amount: parsedAmount,
      categoryKey: type === '振替' ? null : categoryKey,
      subcategoryKey: type === '振替' ? null : subcategoryKey,
      accountId,
      toAccountId: type === '振替' ? toAccountId : null,
      store: draft.store.trim() || null,
      memo: draft.memo.trim() || null,
      tags: normalizedTags || null,
      date,
    };

    try {
      setIsSaving(true);
      if (editingId !== null) {
        await db.update(transactions).set(payload).where(eq(transactions.id, editingId));
        // 編集は入出金タブや口座詳細から入るため、input と detail の2画面分だけ戻る
        router.dismiss(2);
      } else {
        await db.insert(transactions).values(payload);
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('保存に失敗しました', 'もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (editingId === null) return;
    Alert.alert('記録を削除', 'この記録を削除しますか?', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.delete(transactions).where(eq(transactions.id, editingId));
            router.dismiss(2);
          } catch (error) {
            console.error(error);
            Alert.alert('削除に失敗しました', 'もう一度お試しください。');
          }
        },
      },
    ]);
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
            updateDraft({ date: combined });
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
          {editingId !== null ? '記録の編集' : '記録の詳細'}
        </ThemedText>
      </View>

      {/* 金額表示(タップで電卓) */}
      <Pressable style={styles.amountRow} onPress={() => setIsCalculatorOpen(true)}>
        <ThemedText style={styles.currencyLabel}>¥{'\n'}JPY</ThemedText>
        <ThemedText style={styles.amountText}>{Number(amount).toLocaleString()}</ThemedText>
      </Pressable>

      {/* 日付・時刻 */}
      <Pressable style={styles.row} onPress={openDatePicker}>
        <ThemedText style={styles.icon}>📅</ThemedText>
        <ThemedText style={styles.rowText}>{formattedDate}</ThemedText>
      </Pressable>

      {/* カテゴリ(振替は資産移動なのでカテゴリを持たない) */}
      {type !== '振替' ? (
        <Pressable style={styles.row} onPress={() => router.push('/category')}>
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
          style={[styles.rowInput, { color: Colors[colorScheme].text }]}
          placeholder="お店"
          placeholderTextColor={Colors[colorScheme].icon}
          value={draft.store}
          onChangeText={(text) => updateDraft({ store: text })}
        />
      </View>

      {/* タグ */}
      <View style={styles.row}>
        <ThemedText style={styles.icon}>🏷️</ThemedText>
        <TextInput
          style={[styles.rowInput, { color: Colors[colorScheme].text }]}
          placeholder="タグ(カンマ区切り)"
          placeholderTextColor={Colors[colorScheme].icon}
          value={draft.tags}
          onChangeText={(text) => updateDraft({ tags: text })}
        />
      </View>

      {/* メモ */}
      <TextInput
        style={[
          styles.memoBox,
          { color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].card },
        ]}
        placeholder="メモ"
        placeholderTextColor={Colors[colorScheme].icon}
        value={draft.memo}
        onChangeText={(text) => updateDraft({ memo: text })}
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

      {/* 削除(編集時のみ) */}
      {editingId !== null ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <ThemedText style={{ color: Colors[colorScheme].critical }}>この記録を削除</ThemedText>
        </Pressable>
      ) : null}

      {/* 電卓(金額タップで下から表示) */}
      <CalculatorSheet
        visible={isCalculatorOpen}
        initialAmount={amount}
        onClose={() => setIsCalculatorOpen(false)}
        onConfirm={(value) => updateDraft({ amount: String(value) })}
      />

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
  },
  memoBox: {
    marginTop: 16,
    minHeight: 100,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 'auto',
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
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 6,
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
