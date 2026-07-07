export type DayGroup<T> = {
  /** 'YYYY-M-D' 形式(ローカルタイムゾーン基準) */
  key: string;
  /** その日の0時(ローカル) */
  date: Date;
  items: T[];
  /** その日の支出合計(円) */
  expenseTotal: number;
};

// 入力順は保持したままローカル日付でグループ化し、グループは新しい日付順に並べる
export function groupTransactionsByDay<T extends { date: Date; type: string; amount: number }>(
  rows: T[],
): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();

  for (const row of rows) {
    const d = row.date;
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        items: [],
        expenseTotal: 0,
      };
      groups.set(key, group);
    }
    group.items.push(row);
    if (row.type === '支出') {
      group.expenseTotal += row.amount;
    }
  }

  return [...groups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}
