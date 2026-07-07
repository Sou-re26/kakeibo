export type PieSliceGeometry = {
  /** 12時位置を0とした時計回りのラジアン */
  startAngle: number;
  endAngle: number;
  /** 全体に占める割合 (0〜1) */
  ratio: number;
};

// 値が0以下の項目は角度0のスライスになる(呼び出し側で除外を推奨)
export function computePieAngles(values: number[]): PieSliceGeometry[] {
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0);
  if (total <= 0) {
    return values.map(() => ({ startAngle: 0, endAngle: 0, ratio: 0 }));
  }

  let cursor = 0;
  return values.map((value) => {
    const ratio = Math.max(value, 0) / total;
    const startAngle = cursor;
    cursor += ratio * 2 * Math.PI;
    return { startAngle, endAngle: cursor, ratio };
  });
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  // SVG座標系で12時位置起点・時計回りにするための変換
  const x = cx + radius * Math.sin(angle);
  const y = cy - radius * Math.cos(angle);
  return { x, y };
}

export function donutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  // SVGの円弧は開始点=終了点(完全な円)だと描画されないため、わずかに切り詰める
  const fullCircle = 2 * Math.PI;
  const sweep = Math.min(endAngle - startAngle, fullCircle - 0.0001);
  if (sweep <= 0) return '';

  const end = startAngle + sweep;
  const largeArc = sweep > Math.PI ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, end);
  const innerStart = polarToCartesian(cx, cy, innerRadius, end);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}
