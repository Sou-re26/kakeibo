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
  // ユーザー任意のタグ。正規化済みのカンマ区切り(例: '旅行,立替')。null=タグなし
  tags: text('tags'),
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

// アプリ設定のkey-value。値は文字列で保存し、型付け・既定値の解決は
// contexts/settings.tsx で行う(表示用文字列ではなくコード値を保存する)
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type SettingRow = typeof settings.$inferSelect;

// 定期支出/収入(給料日など)。ホームの残り日数・カレンダーのマーカー表示に加え、
// 期日が来ると lib/apply-recurrings.ts が取引として自動記帳する(金額設定時のみ)。
export const recurrings = sqliteTable('recurrings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // 'expense' | 'income'(コード値。transactions.type と異なり日本語を保存しない)
  label: text('label').notNull(), // 例: '家賃', '給料'
  dayOfMonth: integer('day_of_month').notNull(), // 1〜31。その月に存在しない日は月末扱い
  amount: integer('amount'), // 円。null=金額未設定(自動記帳しない)
  categoryKey: text('category_key'), // constants/categories.ts のキー
  subcategoryKey: text('subcategory_key'),
  accountId: integer('account_id'), // transactions と同じFK制約なしのソフト参照。null=口座未指定
  // この日(ローカル日付)までの発生分は記帳済み。null=列追加前の旧データ(次回実行時に今日へ初期化)
  appliedThrough: integer('applied_through', { mode: 'timestamp' }),
});

export type Recurring = typeof recurrings.$inferSelect;
export type NewRecurring = typeof recurrings.$inferInsert;