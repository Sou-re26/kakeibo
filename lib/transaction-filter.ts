export type FilterableTransaction = {
  type: string;
  amount: number;
  categoryKey: string | null;
  accountId: number | null;
  toAccountId: number | null;
  store: string | null;
  memo: string | null;
  tags: string | null;
  date: Date;
};

export type TransactionFilter = {
  /** 空=全種別。値は transactions.type と同じ日本語リテラル('支出'/'収入'/'振替') */
  types: string[];
  /** この日の0時(ローカル)以降。null=下限なし */
  startDate: Date | null;
  /** この日を含む(翌日0時未満)。null=上限なし */
  endDate: Date | null;
  /** 空=全カテゴリ。'uncategorized'=カテゴリ未選択(categoryKey null)の取引 */
  categoryKeys: string[];
  /** 店名・メモ・タグの部分一致(大文字小文字を区別しない)。空=条件なし */
  keyword: string;
  /** 出金元口座(支出/収入は対象口座、振替は出金元)。null=条件なし */
  accountId: number | null;
  /** 入金先口座(振替のみ持つ)。null=条件なし */
  toAccountId: number | null;
  /** 金額の下限(円、この値を含む)。null=下限なし */
  minAmount: number | null;
  /** 金額の上限(円、この値を含む)。null=上限なし */
  maxAmount: number | null;
};

export const EMPTY_FILTER: TransactionFilter = {
  types: [],
  startDate: null,
  endDate: null,
  categoryKeys: [],
  keyword: '',
  accountId: null,
  toAccountId: null,
  minAmount: null,
  maxAmount: null,
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfNextDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

// 有効な条件の数(期間・金額範囲はそれぞれまとめて1条件と数える)
export function countActiveConditions(filter: TransactionFilter): number {
  let count = 0;
  if (filter.types.length > 0) count += 1;
  if (filter.startDate !== null || filter.endDate !== null) count += 1;
  if (filter.categoryKeys.length > 0) count += 1;
  if (filter.keyword.trim() !== '') count += 1;
  if (filter.accountId !== null) count += 1;
  if (filter.toAccountId !== null) count += 1;
  if (filter.minAmount !== null || filter.maxAmount !== null) count += 1;
  return count;
}

export function isEmptyFilter(filter: TransactionFilter): boolean {
  return countActiveConditions(filter) === 0;
}

export function filterTransactions<T extends FilterableTransaction>(
  rows: T[],
  filter: TransactionFilter,
): T[] {
  const keyword = filter.keyword.trim().toLowerCase();
  const start = filter.startDate !== null ? startOfDay(filter.startDate) : null;
  const end = filter.endDate !== null ? startOfNextDay(filter.endDate) : null;

  return rows.filter((tx) => {
    if (filter.types.length > 0 && !filter.types.includes(tx.type)) return false;
    if (start !== null && tx.date < start) return false;
    if (end !== null && tx.date >= end) return false;
    if (
      filter.categoryKeys.length > 0 &&
      !filter.categoryKeys.includes(tx.categoryKey ?? 'uncategorized')
    ) {
      return false;
    }
    if (keyword !== '') {
      const haystack = [tx.store, tx.memo, tx.tags]
        .filter((v): v is string => v !== null)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (filter.accountId !== null && tx.accountId !== filter.accountId) return false;
    if (filter.toAccountId !== null && tx.toAccountId !== filter.toAccountId) return false;
    if (filter.minAmount !== null && tx.amount < filter.minAmount) return false;
    if (filter.maxAmount !== null && tx.amount > filter.maxAmount) return false;
    return true;
  });
}
