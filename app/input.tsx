import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type TransactionType = '支出' | '収入' | '振替';

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '.'];

const TYPE_COLORS: Record<TransactionType, string> = {
  支出: '#4CAF50',
  収入: '#2196F3',
  振替: '#9E9E9E',
};

export default function InputScreen() {
  const [type, setType] = useState<TransactionType>('支出');
  const [amount, setAmount] = useState('0');

  const handleKeyPress = (key: string) => {
    setAmount((prev) => {
      if (key === '.') {
        // すでに小数点があれば追加しない
        return prev.includes('.') ? prev : prev + '.';
      }
      if (prev === '0') {
        return key === '00' ? '0' : key;
      }
      if (prev.length >= 9) return prev;
      return prev + key;
    });
  };

  const handleDelete = () => {
    setAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const handleNext = () => {
    // TODO: カテゴリ選択画面へ遷移、または保存処理
    console.log('種別:', type, '金額:', amount);
    router.push({
      pathname: '/detail',
      params: { type, amount },
    });
  };

  return (
    <ThemedView style={styles.container}>
      {/* 種別タブ */}
      <View style={styles.typeRow}>
        {(['支出', '収入', '振替'] as TransactionType[]).map((t) => (
          <Pressable
            key={t}
            style={[
              styles.typeButton,
              type === t && { backgroundColor: TYPE_COLORS[t] },
            ]}
            onPress={() => setType(t)}
          >
            <ThemedText style={type === t ? styles.typeTextActive : styles.typeText}>
              {t}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* 金額表示 */}
      <View style={styles.displayArea}>
        <ThemedText style={styles.currencyLabel}>¥ JPY</ThemedText>
        <ThemedText style={styles.amountText}>{amount}</ThemedText>
      </View>

      {/* テンキー */}
      <View style={styles.keypad}>
        {KEYS.map((key, index) => (
          <Pressable key={index} style={styles.key} onPress={() => handleKeyPress(key)}>
            <ThemedText style={styles.keyText}>{key}</ThemedText>
          </Pressable>
        ))}
      </View>

      {/* 下部エリア:カテゴリ選択・次へ・削除 */}
      <View style={styles.bottomRow}>
        <Pressable style={styles.categoryButton}>
          <ThemedText style={styles.categoryText}>カテゴリ選択</ThemedText>
        </Pressable>

        <Pressable style={[styles.nextButton, { backgroundColor: TYPE_COLORS[type] }]} onPress={handleNext}>
          <ThemedText style={styles.nextText}>次へ</ThemedText>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <ThemedText style={styles.deleteText}>⌫</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  typeText: {
    color: '#888',
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  displayArea: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minHeight: 120,
  },
  currencyLabel: {
    fontSize: 12,
    color: '#888',
  },
  amountText: {
    fontSize: 56,
    fontWeight: 'bold',
    lineHeight: 68,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 320,
  },
  key: {
    width: '33.33%',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#eee',
  },
  keyText: {
    fontSize: 26,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  categoryButton: {
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 12,
  },
  nextButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 18,
  },
});