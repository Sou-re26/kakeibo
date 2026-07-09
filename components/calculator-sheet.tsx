import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { applyCalcKey, finalizeCalc, initialCalcState } from '@/lib/calculator';

type Props = {
  visible: boolean;
  /** 開いたときの初期値(整数円の文字列) */
  initialAmount: string;
  onClose: () => void;
  onConfirm: (amount: number) => void;
};

// [行, 列] のキー配置。'confirm' は確定ボタン
const KEY_ROWS: string[][] = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['0', '00', '⌫', '+'],
  ['C', '=', 'confirm'],
];

// 金額入力用の電卓。下からのモーダルシートで表示し、確定で integer 円を返す
export function CalculatorSheet({ visible, initialAmount, onClose, onConfirm }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(() => initialCalcState(initialAmount));

  useEffect(() => {
    if (visible) {
      setState(initialCalcState(initialAmount));
    }
  }, [visible, initialAmount]);

  const handleConfirm = () => {
    const value = finalizeCalc(state);
    if (value === null) {
      Alert.alert('確定できません', '金額は0以上・9桁以内の整数(円)にしてください。');
      return;
    }
    onConfirm(value);
    onClose();
  };

  const displayText = `${Number(state.entry).toLocaleString()}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* 表示部。保留中の演算子を左に小さく出す */}
          <View style={styles.display}>
            <ThemedText style={styles.pendingOp}>
              {state.op ? `${state.acc?.toLocaleString()} ${state.op}` : ' '}
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.displayText} numberOfLines={1}>
              ¥{displayText}
            </ThemedText>
          </View>

          {KEY_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keyRow}>
              {row.map((key) =>
                key === 'confirm' ? (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.key,
                      styles.confirmKey,
                      { backgroundColor: colors.accent },
                      pressed && styles.pressed,
                    ]}
                    onPress={handleConfirm}
                  >
                    <ThemedText type="defaultSemiBold" style={{ color: colors.onAccent }}>
                      確定
                    </ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.key,
                      { backgroundColor: colors.card },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setState((prev) => applyCalcKey(prev, key))}
                  >
                    <ThemedText style={styles.keyText}>{key}</ThemedText>
                  </Pressable>
                ),
              )}
            </View>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  display: {
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  pendingOp: {
    fontSize: 13,
    opacity: 0.5,
  },
  displayText: {
    fontSize: 32,
    lineHeight: 40,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  key: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmKey: {
    flex: 2,
  },
  keyText: {
    fontSize: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});
