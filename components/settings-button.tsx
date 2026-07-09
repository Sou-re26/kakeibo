import { useState } from 'react';
import { Pressable } from 'react-native';

import { SettingsDrawer } from '@/components/settings-drawer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  /** ドロワーを閉じたときに呼ばれる。定期収支の変更を画面へ反映したい場合に渡す */
  onClosed?: () => void;
};

// 全タブ共通の設定ドロワーの開閉ボタン。各タブのヘッダー左に置く
export function SettingsButton({ onClosed }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Pressable hitSlop={8} onPress={() => setIsOpen(true)}>
        <IconSymbol name="line.3.horizontal" size={24} color={Colors[colorScheme].icon} />
      </Pressable>
      <SettingsDrawer
        visible={isOpen}
        onClose={() => {
          setIsOpen(false);
          onClosed?.();
        }}
      />
    </>
  );
}
