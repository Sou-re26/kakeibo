export type LinePoint = { x: number; y: number };

export type GridLine = {
  /** 実データ上の値(ラベル表示用) */
  value: number;
  y: number;
};

export type LineGeometry = {
  points: LinePoint[];
  /** 下から min / mid / max。全点同値なら1本 */
  gridLines: GridLine[];
};

// 時系列の値をSVG座標へ変換する(y軸はSVG座標系に合わせて上下反転)。
// 値域は上下8%広げて線が端に張り付かないようにし、全点同値でも潰れないよう
// 最低±1円のパディングを入れる。全点同時刻のときは中央に置く。
export function computeLineGeometry(
  data: { time: number; value: number }[],
  width: number,
  height: number,
): LineGeometry {
  if (data.length === 0 || width <= 0 || height <= 0) {
    return { points: [], gridLines: [] };
  }

  const values = data.map((d) => d.value);
  const times = data.map((d) => d.time);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);

  const pad = vMax === vMin ? Math.max(Math.abs(vMax) * 0.08, 1) : (vMax - vMin) * 0.08;
  const dMin = vMin - pad;
  const dMax = vMax + pad;

  const yFor = (v: number) => (1 - (v - dMin) / (dMax - dMin)) * height;
  const xFor = (t: number) =>
    tMax === tMin ? width / 2 : ((t - tMin) / (tMax - tMin)) * width;

  const gridValues = vMax === vMin ? [vMin] : [vMin, (vMin + vMax) / 2, vMax];

  return {
    points: data.map((d) => ({ x: xFor(d.time), y: yFor(d.value) })),
    gridLines: gridValues.map((v) => ({ value: v, y: yFor(v) })),
  };
}
