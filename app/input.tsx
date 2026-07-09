import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTransactionDraft, type TransactionType } from '@/contexts/transaction-draft';

// JPYに小数はないため小数点キーは持たない。最後のセルは格子維持用の空きスロット
const KEYS: (string | null)[] = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', null];

const TYPE_COLORS: Record<TransactionType, string> = {
  支出: '#4CAF50',
  収入: '#2196F3',
  振替: '#9E9E9E',
};

export default function InputScreen() {
  const { draft, updateDraft } = useTransactionDraft();
  const { type, amount } = draft;

  const handleKeyPress = (key: string) => {
    if (amount === '0') {
      updateDraft({ amount: key === '00' ? '0' : key });
      return;
    }
    if (amount.length >= 9) return;
    updateDraft({ amount: amount + key });
  };

  const handleDelete = () => {
    updateDraft({ amount: amount.length > 1 ? amount.slice(0, -1) : '0' });
  };

  const handleNext = () => {
    router.push('/detail');
  };

  return (
    <ThemedView style={styles.container}>
      {/* ヘッダー(ルートStackのヘッダーは _layout.tsx で非表示にしている) */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={styles.closeIcon}>✕</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          金額の入力
        </ThemedText>
      </View>

      {/* 種別タブ */}
      <View style={styles.typeRow}>
        {(['支出', '収入', '振替'] as TransactionType[]).map((t) => (
          <Pressable
            key={t}
            style={({ pressed }) => [
              styles.typeButton,
              type === t && { backgroundColor: TYPE_COLORS[t] },
              pressed && styles.pressed,
            ]}
            onPress={() => updateDraft({ type: t })}
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
        <ThemedText style={styles.amountText}>{Number(amount).toLocaleString()}</ThemedText>
      </View>

      {/* テンキー */}
      <View style={styles.keypad}>
        {KEYS.map((key, index) =>
          key === null ? (
            <View key={index} style={styles.key} />
          ) : (
            <Pressable
              key={index}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              onPress={() => handleKeyPress(key)}
            >
              <ThemedText style={styles.keyText}>{key}</ThemedText>
            </Pressable>
          ),
        )}
      </View>

      {/* 下部エリア:カテゴリ選択・次へ・削除 */}
      <View style={styles.bottomRow}>
        <Pressable style={styles.categoryButton}>
          <ThemedText style={styles.categoryText}>カテゴリ選択</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: TYPE_COLORS[type] },
            pressed && styles.pressed,
          ]}
          onPress={handleNext}
        >
          <ThemedText style={styles.nextText}>次へ</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          onPress={handleDelete}
        >
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  closeIcon: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 22,
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
  pressed: {
    opacity: 0.6,
  },
  keyPressed: {
    backgroundColor: '#eee', // 既存キーの枠線色と同系(テーマ化は既知の負債と同時に)
  },
});