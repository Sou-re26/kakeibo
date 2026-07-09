import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

type Props = {
  /** 表示中のページ(セグメントの選択状態)。タップ切替時はここを変えると追従スクロールする */
  index: number;
  /** スワイプでページが変わったときに呼ばれる */
  onIndexChange: (index: number) => void;
  children: ReactNode[];
};

// 画面内タブのコンテンツを指に追従する横ページングで切り替える。
// react-native-pager-view を追加せず、ScrollView の pagingEnabled で実現している
// (各ページの縦FlatListとは軸が違うため共存する)。
export function PagedTabs({ index, onIndexChange, children }: Props) {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(index);

  useEffect(() => {
    indexRef.current = index;
    if (width > 0) {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
    }
  }, [index, width]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newIndex !== indexRef.current) {
      onIndexChange(newIndex);
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          contentOffset={{ x: index * width, y: 0 }}
        >
          {Children.map(children, (child) => (
            <View style={{ width }}>{child}</View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
