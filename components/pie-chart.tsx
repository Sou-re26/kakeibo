import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { computePieAngles, donutSlicePath } from '@/lib/pie';

export type PieChartDatum = {
  key: string;
  value: number;
  color: string;
};

type Props = {
  data: PieChartDatum[];
  size: number;
  centerTitle?: string;
  centerValue?: string;
};

const INNER_RADIUS_RATIO = 0.62;

export function PieChart({ data, size, centerTitle, centerValue }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  // スライス間の2pxギャップ(隣接色のCVD分離を補う副次符号化)を背景色の縁取りで作る
  const surfaceColor = Colors[colorScheme].background;

  const visible = data.filter((d) => d.value > 0);
  const angles = computePieAngles(visible.map((d) => d.value));

  const center = size / 2;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * INNER_RADIUS_RATIO;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {visible.length === 0 ? (
          <Path
            d={donutSlicePath(center, center, outerRadius, innerRadius, 0, 2 * Math.PI)}
            fill={CategoryColors[colorScheme].uncategorized}
            fillOpacity={0.25}
          />
        ) : (
          visible.map((d, i) => (
            <Path
              key={d.key}
              d={donutSlicePath(
                center,
                center,
                outerRadius,
                innerRadius,
                angles[i].startAngle,
                angles[i].endAngle,
              )}
              fill={d.color}
              stroke={surfaceColor}
              strokeWidth={2}
            />
          ))
        )}
      </Svg>
      {centerTitle || centerValue ? (
        <View style={styles.center} pointerEvents="none">
          {centerTitle ? <ThemedText style={styles.centerTitle}>{centerTitle}</ThemedText> : null}
          {centerValue ? (
            <ThemedText type="defaultSemiBold" style={styles.centerValue}>
              {centerValue}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  centerValue: {
    fontSize: 18,
  },
});
