import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { computePieAngles, donutSlicePath } from '@/lib/pie';

export type PieChartDatum = {
  key: string;
  value: number;
  color: string;
  /** スライス内に小さく表示するラベル(スペースが足りないスライスでは省略される) */
  label?: string;
};

type Props = {
  data: PieChartDatum[];
  size: number;
  centerTitle?: string;
  centerValue?: string;
};

const INNER_RADIUS_RATIO = 0.62;
const LABEL_FONT = 9;
const RATIO_FONT = 8;

// スライス色の明度でラベル文字色(近黒/近白)を選ぶ。テーマのtextトークンを流用する
function labelColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.6 ? Colors.light.text : Colors.dark.text;
}

// 全角中心のラベル幅の概算(px)。ASCIIは半角扱い
function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    width += ch.charCodeAt(0) <= 0x7f ? fontSize * 0.6 : fontSize;
  }
  return width;
}

export function PieChart({ data, size, centerTitle, centerValue }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  // スライス間の2pxギャップ(隣接色のCVD分離を補う副次符号化)を背景色の縁取りで作る
  const surfaceColor = Colors[colorScheme].background;

  const visible = data.filter((d) => d.value > 0);
  const angles = computePieAngles(visible.map((d) => d.value));

  const center = size / 2;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * INNER_RADIUS_RATIO;
  const labelRadius = (outerRadius + innerRadius) / 2;
  const ringWidth = outerRadius - innerRadius;

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

        {/* スライス内のカテゴリ名+割合。弧の長さ・リング幅に収まるものだけ表示する */}
        {visible.map((d, i) => {
          if (!d.label) return null;
          const { startAngle, endAngle, ratio } = angles[i];
          const ratioText = `${Math.round(ratio * 100)}%`;
          const maxWidth = Math.max(
            estimateTextWidth(d.label, LABEL_FONT),
            estimateTextWidth(ratioText, RATIO_FONT),
          );
          const arcLength = (endAngle - startAngle) * labelRadius;
          if (ringWidth < LABEL_FONT + RATIO_FONT + 6 || arcLength < maxWidth + 6) {
            return null;
          }
          const midAngle = (startAngle + endAngle) / 2;
          const x = center + labelRadius * Math.sin(midAngle);
          const y = center - labelRadius * Math.cos(midAngle);
          const color = labelColorFor(d.color);
          return (
            <G key={`label-${d.key}`}>
              <SvgText x={x} y={y - 2} fontSize={LABEL_FONT} fill={color} textAnchor="middle">
                {d.label}
              </SvgText>
              <SvgText
                x={x}
                y={y + RATIO_FONT + 1}
                fontSize={RATIO_FONT}
                fill={color}
                textAnchor="middle"
              >
                {ratioText}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      {centerTitle || centerValue ? (
        <View style={styles.center} pointerEvents="none">
          {/* 中央の穴に収める(長い金額はフォントを自動縮小して重なりを防ぐ) */}
          <View style={{ width: innerRadius * 2 - 12, alignItems: 'center' }}>
            {centerTitle ? (
              <ThemedText style={styles.centerTitle} numberOfLines={1}>
                {centerTitle}
              </ThemedText>
            ) : null}
            {centerValue ? (
              <ThemedText
                type="defaultSemiBold"
                style={styles.centerValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {centerValue}
              </ThemedText>
            ) : null}
          </View>
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
