export type CalcOp = '+' | '-' | '×' | '÷';

export type CalcKey = string; // '0'〜'9' | '00' | CalcOp | '=' | '⌫' | 'C'

export type CalcState = {
  /** 表示中の値(整数の文字列。負値もありうる) */
  entry: string;
  /** 保留中の左辺 */
  acc: number | null;
  /** 保留中の演算子 */
  op: CalcOp | null;
  /** true なら次の数字入力で entry を置き換える(演算子押下直後など) */
  overwrite: boolean;
};

/** 金額の上限桁(円)。テンキー入力(app/input.tsx)の9桁制限と揃える */
const MAX_DIGITS = 9;

export function initialCalcState(entry: string): CalcState {
  return { entry: /^\d+$/.test(entry) ? entry : '0', acc: null, op: null, overwrite: true };
}

// JPYに小数はないため、除算は四捨五入して整数へ丸める
function compute(left: number, op: CalcOp, right: number): number {
  if (op === '+') return left + right;
  if (op === '-') return left - right;
  if (op === '×') return left * right;
  return right === 0 ? 0 : Math.round(left / right);
}

function isOp(key: CalcKey): key is CalcOp {
  return key === '+' || key === '-' || key === '×' || key === '÷';
}

export function applyCalcKey(state: CalcState, key: CalcKey): CalcState {
  if (key === 'C') {
    return { entry: '0', acc: null, op: null, overwrite: true };
  }

  if (key === '⌫') {
    const next = state.entry.length > 1 ? state.entry.slice(0, -1) : '0';
    // '-5' → '-' のような不正な残りは 0 に戻す
    return { ...state, entry: /^-?\d+$/.test(next) ? next : '0', overwrite: false };
  }

  if (isOp(key)) {
    const value = Number(state.entry);
    // 直前も演算子なら演算子だけ差し替える
    if (state.op !== null && state.overwrite) {
      return { ...state, op: key };
    }
    const acc = state.op !== null && state.acc !== null ? compute(state.acc, state.op, value) : value;
    return { entry: String(acc), acc, op: key, overwrite: true };
  }

  if (key === '=') {
    if (state.op === null || state.acc === null) {
      return { ...state, overwrite: true };
    }
    const result = compute(state.acc, state.op, Number(state.entry));
    return { entry: String(result), acc: null, op: null, overwrite: true };
  }

  // 数字('0'〜'9' | '00')
  if (state.overwrite) {
    return { ...state, entry: key === '00' ? '0' : key, overwrite: false };
  }
  if (state.entry === '0') {
    return { ...state, entry: key === '00' ? '0' : key };
  }
  if (state.entry.replace('-', '').length + key.length > MAX_DIGITS) {
    return state;
  }
  return { ...state, entry: state.entry + key };
}

// 確定時の最終値。保留中の演算があれば清算する。金額として不正(負値・桁超過)なら null
export function finalizeCalc(state: CalcState): number | null {
  const settled = state.op !== null ? applyCalcKey(state, '=') : state;
  const value = Number(settled.entry);
  if (!Number.isSafeInteger(value) || value < 0 || String(value).length > MAX_DIGITS) {
    return null;
  }
  return value;
}
