import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // '支出' | '収入' | '振替'
  amount: real('amount').notNull(),
  category: text('category'),
  store: text('store'),
  memo: text('memo'),
  date: integer('date', { mode: 'timestamp' }).notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;