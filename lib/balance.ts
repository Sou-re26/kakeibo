export type BalanceTransaction = {
  type: string; // '支出' | '収入' | '振替'
  amount: number;
  accountId: number | null;
  toAccountId: number | null;
};

// 取引1件が指定口座の残高に与える増減(円)。無関係な取引は0。
// 支出: -amount / 収入: +amount / 振替: 出金元 -amount, 入金先 +amount
export function transactionDelta(accountId: number, row: BalanceTransaction): number {
  let delta = 0;
  if (row.type === '支出') {
    if (row.accountId === accountId) delta -= row.amount;
  } else if (row.type === '収入') {
    if (row.accountId === accountId) delta += row.amount;
  } else if (row.type === '振替') {
    if (row.accountId === accountId) delta -= row.amount;
    if (row.toAccountId === accountId) delta += row.amount;
  }
  return delta;
}

// 指定口座に対する取引の増減合計(円)。口座未指定(null)の取引は影響しない。
export function accountDelta(accountId: number, rows: BalanceTransaction[]): number {
  let delta = 0;
  for (const row of rows) {
    delta += transactionDelta(accountId, row);
  }
  return delta;
}

// 複数口座の合計残高への増減(円)。振替は両口座とも対象なら相殺されて0になる
export function totalTransactionDelta(
  accountIds: ReadonlySet<number>,
  row: BalanceTransaction,
): number {
  let delta = 0;
  if (row.type === '支出') {
    if (row.accountId !== null && accountIds.has(row.accountId)) delta -= row.amount;
  } else if (row.type === '収入') {
    if (row.accountId !== null && accountIds.has(row.accountId)) delta += row.amount;
  } else if (row.type === '振替') {
    if (row.accountId !== null && accountIds.has(row.accountId)) delta -= row.amount;
    if (row.toAccountId !== null && accountIds.has(row.toAccountId)) delta += row.amount;
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
