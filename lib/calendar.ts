export type TypeTotals = {
  income: number;
  expense: number;
  transfer: number;
};

// その日の取引の種別ごとの総額(円)
export function dayTypeTotals(items: { type: string; amount: number }[]): TypeTotals {
  const totals: TypeTotals = { income: 0, expense: 0, transfer: 0 };
  for (const item of items) {
    if (item.type === '収入') totals.income += item.amount;
    else if (item.type === '支出') totals.expense += item.amount;
    else if (item.type === '振替') totals.transfer += item.amount;
  }
  return totals;
}

// 月のカレンダー(日曜始まり・週ごとの7要素)。月外のセルは null。
// month は Date と同じ0始まり。
export function buildCalendarWeeks(year: number, month: number): (Date | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();

  const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
