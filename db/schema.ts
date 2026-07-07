import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // '支出' | '収入' | '振替'
  amount: integer('amount').notNull(), // 円の整数(JPYに小数はない)
  categoryKey: text('category_key'), // constants/categories.ts のキー
  subcategoryKey: text('subcategory_key'),
  // 口座へのソフト参照(FK制約なし。口座削除時は参照が残るが表示・集計側で無視する)
  accountId: integer('account_id'), // 支出/収入: 対象口座、振替: 出金元。null=口座未指定(残高に影響しない)
  toAccountId: integer('to_account_id'), // 振替の入金先のみ使用
  store: text('store'),
  memo: text('memo'),
  date: integer('date', { mode: 'timestamp' }).notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// 口座。balance は「基準残高」で、現在残高 = balance + 取引差分(lib/balance.ts)。
// 口座編集画面では現在残高を入力させ、保存時に基準残高へ逆算する。
export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  balance: integer('balance').notNull().default(0), // 円の整数(負値=負債も許容)
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;