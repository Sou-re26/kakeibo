import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { recurrings, transactions } from '@/db/schema';
import { occurrencesBetween } from '@/lib/recurring';

// 期日が来た定期収支を取引として自動記帳し、appliedThrough を今日まで進める(冪等)。
// 金額未設定のルールは記帳せず日付だけ進める。ホームのフォーカス時に await してから
// 一覧を読み込むこと(記帳結果を同じフォーカスで反映するため)。
async function run(now: Date): Promise<void> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rules = await db.select().from(recurrings);

  for (const rule of rules) {
    // 列追加前の旧データ(null)は今日を起点にし、過去分を遡って記帳しない
    if (rule.appliedThrough === null) {
      await db.update(recurrings).set({ appliedThrough: today }).where(eq(recurrings.id, rule.id));
      continue;
    }

    const occurrences = occurrencesBetween(rule.dayOfMonth, rule.appliedThrough, today);
    if (occurrences.length === 0) continue;

    if (rule.amount !== null) {
      for (const date of occurrences) {
        // 通常の取引と同じ構造で記帳する(口座指定があれば残高にも反映される)。
        // 自動記帳の識別はタグ '定期' で行う
        await db.insert(transactions).values({
          // transactions.type は日本語リテラル(既知の負債)。既存データに合わせて変換する
          type: rule.type === 'income' ? '収入' : '支出',
          amount: rule.amount,
          categoryKey: rule.categoryKey,
          subcategoryKey: rule.subcategoryKey,
          accountId: rule.accountId,
          toAccountId: null,
          store: null,
          memo: rule.label,
          tags: '定期',
          date,
        });
      }
    }
    await db.update(recurrings).set({ appliedThrough: today }).where(eq(recurrings.id, rule.id));
  }
}

// 二重実行(フォーカスの連続発火など)で同じ発生分を重複記帳しないための直列化
let inFlight: Promise<void> | null = null;

export function applyDueRecurrings(now: Date): Promise<void> {
  if (!inFlight) {
    inFlight = run(now).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
