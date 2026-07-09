import { Link } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useTransactionDraft } from '@/contexts/transaction-draft';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** hidden 時に画面外へ逃がす移動量(FAB高さ+タブバーを十分越える値) */
const HIDE_TRANSLATE_Y = 160;

// 収支追加ボタン。タブバーは標準配置(画面に被さらない)なので、画面下端=タブバー上端。
// bottom は小さな固定余白でよい(タブバー高さを足すと1本分浮いて見える)。
// hidden(use-auto-hide-fab)で縦スクロール中は下へスライドアウトする。
// style は必ず単一オブジェクトで渡す(配列だと Link asChild の Slot が style を
// オブジェクト展開でマージする際に壊れ、スタイルが全て失われる)。
export function AddTransactionFab({ hidden = false }: { hidden?: boolean }) {
  const colorScheme = useColorScheme() ?? 'light';
  const { startNew } = useTransactionDraft();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hidden ? HIDE_TRANSLATE_Y : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [hidden, translateY]);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      <Link href="/input" asChild>
        <Pressable
          onPress={startNew}
          style={StyleSheet.flatten([
            styles.fab,
            { backgroundColor: Colors[colorScheme].accent },
          ])}
        >
          <IconSymbol name="square.and.pencil" size={26} color={Colors[colorScheme].onAccent} />
        </Pressable>
      </Link>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    bottom: 16,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4, // Android用の影
    shadowColor: '#000', // iOS用の影
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});
