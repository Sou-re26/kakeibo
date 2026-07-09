import { transactionDelta, type BalanceTransaction } from '@/lib/balance';

export type DatedBalanceTransaction = BalanceTransaction & { date: Date };

/** 残高推移の1点(dateはローカル日付の0時、または区間端の時刻) */
export type BalancePoint = {
  date: Date;
  balance: number;
};

export type RangeKey = '1m' | '6m' | '1y' | 'all';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '1m', label: '1ヶ月' },
  { key: '6m', label: '半年' },
  { key: '1y', label: '1年' },
  { key: 'all', label: '全期間' },
];

// 対象区間の開始(ローカル日付の0時)。'all' は null(=最古の取引から)。
export function rangeStart(key: RangeKey, now: Date): Date | null {
  if (key === 'all') return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === '1m') start.setMonth(start.getMonth() - 1);
  else if (key === '6m') start.setMonth(start.getMonth() - 6);
  else start.setFullYear(start.getFullYear() - 1);
  return start;
}

// 残高推移(昇順)の一般形。deltaOf で「1取引あたりの増減」を差し替えられる
// (単一口座は transactionDelta、全口座合算は totalTransactionDelta)。
// 先頭は区間開始時点の残高、以降は取引があった日ごとのその日終了時点の残高、
// 末尾は now 時点。区間開始前の取引は基準残高へ畳み込む。
export function balanceSeriesBy(
  baseBalance: number,
  rows: DatedBalanceTransaction[],
  deltaOf: (tx: DatedBalanceTransaction) => number,
  start: Date | null,
  now: Date,
): BalancePoint[] {
  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstDate = sorted[0]?.date ?? now;
  const startTime = (
    start ?? new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate())
  ).getTime();

  let balance = baseBalance;
  let index = 0;
  while (index < sorted.length && sorted[index].date.getTime() < startTime) {
    balance += deltaOf(sorted[index]);
    index++;
  }

  const points: BalancePoint[] = [{ date: new Date(startTime), balance }];
  let currentDayKey: string | null = null;
  for (; index < sorted.length; index++) {
    const d = sorted[index].date;
    balance += deltaOf(sorted[index]);
    const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dayKey === currentDayKey) {
      points[points.length - 1] = { date: dayDate, balance };
    } else {
      points.push({ date: dayDate, balance });
      currentDayKey = dayKey;
    }
  }

  // 未来日の取引が含まれる場合もあるため、末尾は now と最終取引日の遅い方
  const lastPoint = points[points.length - 1];
  if (lastPoint.date.getTime() < now.getTime()) {
    points.push({ date: now, balance });
  }
  return points;
}

// 口座1つの残高推移。現在残高 = 基準残高 + 全取引差分(lib/balance.ts)と同じモデル
export function balanceSeries(
  account: { id: number; balance: number },
  rows: DatedBalanceTransaction[],
  start: Date | null,
  now: Date,
): BalancePoint[] {
  return balanceSeriesBy(
    account.balance,
    rows,
    (tx) => transactionDelta(account.id, tx),
    start,
    now,
  );
}

export type BalanceChange<T> = {
  tx: T;
  /** この取引による対象口座の増減(円) */
  delta: number;
};

// 対象区間内でこの口座に関係する取引を日付の降順で返す(推移タブの履歴リスト用)
export function balanceChangesDesc<T extends DatedBalanceTransaction>(
  accountId: number,
  rows: T[],
  start: Date | null,
): BalanceChange<T>[] {
  return rows
    .filter(
      (tx) =>
        (tx.accountId === accountId || tx.toAccountId === accountId) &&
        (start === null || tx.date.getTime() >= start.getTime()),
    )
    .map((tx) => ({ tx, delta: transactionDelta(accountId, tx) }))
    .sort((a, b) => b.tx.date.getTime() - a.tx.date.getTime());
}
