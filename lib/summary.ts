import type { Transaction } from '@/db/schema';

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
};

export function getMonthRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export type CategoryTotal = {
  categoryKey: string | null; // null = カテゴリ未選択の取引
  total: number;
};

export function summarizeByCategory(
  rows: Pick<Transaction, 'type' | 'amount' | 'categoryKey'>[],
  type: '支出' | '収入',
): CategoryTotal[] {
  const totals = new Map<string | null, number>();

  for (const row of rows) {
    if (row.type !== type) continue;
    const key = row.categoryKey ?? null;
    totals.set(key, (totals.get(key) ?? 0) + row.amount);
  }

  return [...totals.entries()]
    .map(([categoryKey, total]) => ({ categoryKey, total }))
    .sort((a, b) => b.total - a.total);
}

// 「振替」は資産間の移動なので収入・支出のどちらにも計上しない
export function summarizeTransactions(
  rows: Pick<Transaction, 'type' | 'amount'>[],
): MonthlySummary {
  let income = 0;
  let expense = 0;

  for (const row of rows) {
    if (row.type === '収入') {
      income += row.amount;
    } else if (row.type === '支出') {
      expense += row.amount;
    }
  }

  return { income, expense, balance: income - expense };
}
