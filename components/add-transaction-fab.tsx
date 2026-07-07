import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// 収支追加ボタン。タブ画面内に置き、タブバーの高さ分だけ上げて重なりを防ぐ。
// style は必ず単一オブジェクトで渡す(配列だと Link asChild の Slot が style を
// オブジェクト展開でマージする際に壊れ、スタイルが全て失われる)。
export function AddTransactionFab() {
  const colorScheme = useColorScheme() ?? 'light';
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <Link href="/input" asChild>
      <Pressable
        style={StyleSheet.flatten([
          styles.fab,
          { bottom: tabBarHeight + 16, backgroundColor: Colors[colorScheme].accent },
        ])}
      >
        <IconSymbol name="square.and.pencil" size={26} color={Colors[colorScheme].onAccent} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
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
