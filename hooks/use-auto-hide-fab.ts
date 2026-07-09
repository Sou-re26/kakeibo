import { useMemo, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export type FabScrollHandlers = {
  onScrollBeginDrag: () => void;
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: () => void;
};

// 縦スクロール中はFABを隠し、スワイプが終わったら戻すための共通フック。
// 返り値の scrollHandlers を画面内の縦スクロール(ScrollView/FlatList)へ渡し、
// hidden を AddTransactionFab に渡す。
export function useAutoHideFab(): { hidden: boolean; scrollHandlers: FabScrollHandlers } {
  const [hidden, setHidden] = useState(false);

  const scrollHandlers = useMemo<FabScrollHandlers>(
    () => ({
      onScrollBeginDrag: () => setHidden(true),
      onScrollEndDrag: (event) => {
        // 指を離した時点で慣性が残っていれば onMomentumScrollEnd 側で戻す
        const velocityY = event.nativeEvent.velocity?.y ?? 0;
        if (Math.abs(velocityY) < 0.1) {
          setHidden(false);
        }
      },
      onMomentumScrollEnd: () => setHidden(false),
    }),
    [],
  );

  return { hidden, scrollHandlers };
}
