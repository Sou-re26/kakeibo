import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Transaction } from '@/db/schema';

export type TransactionType = '支出' | '収入' | '振替';

// 取引登録ウィザード(input → detail → category)の下書き。
// 画面間のパラメータ渡しをやめ、ここに一元化する(遷移で入力が消えるバグの根治)。
export type TransactionDraft = {
  /** null=新規登録、数値=既存取引の編集(保存時にupdate) */
  editingId: number | null;
  type: TransactionType;
  /** テンキー入力中の文字列(円の整数) */
  amount: string;
  date: Date;
  categoryKey: string | null;
  subcategoryKey: string | null;
  /** 支出/収入: 対象口座、振替: 出金元 */
  accountId: number | null;
  /** 振替の入金先 */
  toAccountId: number | null;
  store: string;
  /** タグの入力文字列(カンマ区切り)。保存時に正規化する */
  tags: string;
  memo: string;
};

const createEmptyDraft = (): TransactionDraft => ({
  editingId: null,
  type: '支出',
  amount: '0',
  date: new Date(),
  categoryKey: null,
  subcategoryKey: null,
  accountId: null,
  toAccountId: null,
  store: '',
  tags: '',
  memo: '',
});

type TransactionDraftContextValue = {
  draft: TransactionDraft;
  updateDraft: (patch: Partial<TransactionDraft>) => void;
  /** 新規登録を開始する(FABから /input へ遷移する前に呼ぶ) */
  startNew: () => void;
  /** 既存取引の編集を開始する(タイムラインのタップから /input へ遷移する前に呼ぶ) */
  startEdit: (tx: Transaction) => void;
};

const TransactionDraftContext = createContext<TransactionDraftContextValue | null>(null);

export function TransactionDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TransactionDraft>(createEmptyDraft);

  const updateDraft = useCallback((patch: Partial<TransactionDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const startNew = useCallback(() => {
    setDraft(createEmptyDraft());
  }, []);

  const startEdit = useCallback((tx: Transaction) => {
    setDraft({
      editingId: tx.id,
      // DBのtypeは日本語リテラルのまま(既知の課題)。想定外の値は支出扱いにしない方が
      // 安全だが、現状3値以外は存在しないためキャストで受ける
      type: tx.type as TransactionType,
      amount: String(tx.amount),
      date: tx.date,
      categoryKey: tx.categoryKey,
      subcategoryKey: tx.subcategoryKey,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId,
      store: tx.store ?? '',
      tags: tx.tags ?? '',
      memo: tx.memo ?? '',
    });
  }, []);

  const value = useMemo(
    () => ({ draft, updateDraft, startNew, startEdit }),
    [draft, updateDraft, startNew, startEdit],
  );

  return <TransactionDraftContext.Provider value={value}>{children}</TransactionDraftContext.Provider>;
}

export function useTransactionDraft(): TransactionDraftContextValue {
  const ctx = useContext(TransactionDraftContext);
  if (!ctx) {
    throw new Error('useTransactionDraft は TransactionDraftProvider の内側で使うこと');
  }
  return ctx;
}
