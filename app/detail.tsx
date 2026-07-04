import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { db } from '@/db/client';
import { transactions } from '@/db/schema';

export default function DetailScreen() {
  const { type, amount, category } = useLocalSearchParams<{
    type: string;
    amount: string;
    category?: string;
  }>();
  const [date, setDate] = useState(new Date());
  const [store, setStore] = useState('');
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

    try {
      setIsSaving(true);
      await db.insert(transactions).values({
        type,
        amount: parsedAmount,
        category: category ?? null,
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

      {/* カテゴリ */}
      <Pressable
        style={styles.row}
        onPress={() => router.push({ pathname: '/category', params: { type, amount } })}
      >
        <ThemedText style={styles.icon}>🍴</ThemedText>
        <ThemedText style={styles.rowText}>
          {category ?? 'カテゴリを選択'}
        </ThemedText>
      </Pressable>
      
      {/* 財布(ダミー) */}
      <View style={styles.row}>
        <ThemedText style={styles.icon}>🐷</ThemedText>
        <ThemedText style={styles.rowText}>財布</ThemedText>
      </View>

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
});