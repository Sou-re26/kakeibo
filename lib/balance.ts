export type BalanceTransaction = {
  type: string; // '支出' | '収入' | '振替'
  amount: number;
  accountId: number | null;
  toAccountId: number | null;
};

// 指定口座に対する取引の増減合計(円)。口座未指定(null)の取引は影響しない。
// 支出: -amount / 収入: +amount / 振替: 出金元 -amount, 入金先 +amount
export function accountDelta(accountId: number, rows: BalanceTransaction[]): number {
  let delta = 0;
  for (const row of rows) {
    if (row.type === '支出') {
      if (row.accountId === accountId) delta -= row.amount;
    } else if (row.type === '収入') {
      if (row.accountId === accountId) delta += row.amount;
    } else if (row.type === '振替') {
      if (row.accountId === accountId) delta -= row.amount;
      if (row.toAccountId === accountId) delta += row.amount;
    }
  }
  return delta;
}

// 現在残高 = 基準残高(accounts.balance) + 取引差分
export function currentBalance(
  account: { id: number; balance: number },
  rows: BalanceTransaction[],
): number {
  return account.balance + accountDelta(account.id, rows);
}
