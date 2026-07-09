import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { computeLineGeometry } from '@/lib/line';

export type LineChartDatum = {
  date: Date;
  value: number;
};

type Props = {
  data: LineChartDatum[];
  height?: number;
};

const PLOT_TOP = 16; // 上端グリッドのラベル(線の上に置く)のための余白
const X_LABEL_AREA = 22; // 下端の日付ラベル領域
const PLOT_INSET_X = 6; // 端点マーカー(r=4)が左右で切れないための余白

const formatDate = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

export function LineChart({ data, height = 200 }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [width, setWidth] = useState(0);

  const plotHeight = height - PLOT_TOP - X_LABEL_AREA;
  const geometry = computeLineGeometry(
    data.map((d) => ({ time: d.date.getTime(), value: d.value })),
    Math.max(width - PLOT_INSET_X * 2, 0),
    plotHeight,
  );
  const points = geometry.points.map((p) => ({ x: p.x + PLOT_INSET_X, y: p.y + PLOT_TOP }));
  const last = points[points.length - 1];

  const pathD =
    points.length === 1
      ? `M 0 ${points[0].y} L ${width} ${points[0].y}`
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && points.length > 0 ? (
        <Svg width={width} height={height}>
          {geometry.gridLines.map((g) => (
            <G key={g.value}>
              <Line
                x1={0}
                y1={g.y + PLOT_TOP}
                x2={width}
                y2={g.y + PLOT_TOP}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText x={0} y={g.y + PLOT_TOP - 4} fontSize={10} fill={colors.icon}>
                {`¥${Math.round(g.value).toLocaleString()}`}
              </SvgText>
            </G>
          ))}

          <Path d={pathD} stroke={colors.accent} strokeWidth={2} fill="none" />

          {last ? (
            <Circle
              cx={last.x}
              cy={last.y}
              r={4}
              fill={colors.accent}
              stroke={colors.background}
              strokeWidth={2}
            />
          ) : null}

          <SvgText x={0} y={height - 6} fontSize={10} fill={colors.icon} textAnchor="start">
            {formatDate(data[0].date)}
          </SvgText>
          {data.length > 1 ? (
            <SvgText x={width} y={height - 6} fontSize={10} fill={colors.icon} textAnchor="end">
              {formatDate(data[data.length - 1].date)}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
