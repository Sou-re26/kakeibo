import { summarizeByCategory } from '@/lib/summary';

type SpendingRow = {
  type: string;
  amount: number;
  categoryKey: string | null;
  date: Date;
};

// now を含む過去 count ヶ月分の月初(昇順)。集計クエリの開始日は先頭要素を使う
export function lastMonthStarts(now: Date, count: number): Date[] {
  const starts: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    starts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return starts;
}

function isSameMonth(date: Date, monthStart: Date): boolean {
  return (
    date.getFullYear() === monthStart.getFullYear() && date.getMonth() === monthStart.getMonth()
  );
}

export type CategorySpending = {
  categoryKey: string | null;
  total: number;
  /** 前月の同カテゴリの支出(円) */
  prevTotal: number;
};

// 今月のカテゴリ別支出(降順)+前月の同カテゴリ支出。今月に支出のないカテゴリは含めない
export function summarizeCategorySpending(rows: SpendingRow[], now: Date): CategorySpending[] {
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const current = summarizeByCategory(
    rows.filter((row) => isSameMonth(row.date, thisMonthStart)),
    '支出',
  );
  const prev = new Map(
    summarizeByCategory(
      rows.filter((row) => isSameMonth(row.date, prevMonthStart)),
      '支出',
    ).map((item) => [item.categoryKey, item.total]),
  );

  return current.map((item) => ({
    categoryKey: item.categoryKey,
    total: item.total,
    prevTotal: prev.get(item.categoryKey) ?? 0,
  }));
}

export type MonthSpending = {
  /** 月初(ローカル) */
  monthStart: Date;
  expense: number;
  income: number;
  /** 前月の支出(円)。rows は count+1 ヶ月分渡すこと(最古月の前月比のため) */
  prevExpense: number;
};

// 月ごとの支出・収入(新しい月が先頭)。振替は計上しない。
// 前月比の計算のため内部では count+1 ヶ月分を集計し、先頭(最古)を落として返す。
export function summarizeMonthlySpending(
  rows: SpendingRow[],
  now: Date,
  count: number,
): MonthSpending[] {
  const starts = lastMonthStarts(now, count + 1);
  const totals = starts.map((monthStart) => {
    let expense = 0;
    let income = 0;
    for (const row of rows) {
      if (!isSameMonth(row.date, monthStart)) continue;
      if (row.type === '支出') expense += row.amount;
      else if (row.type === '収入') income += row.amount;
    }
    return { monthStart, expense, income };
  });

  return totals
    .slice(1)
    .map((item, index) => ({
      ...item,
      prevExpense: totals[index].expense,
    }))
    .reverse();
}
