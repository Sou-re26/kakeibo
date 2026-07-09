import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { CATEGORIES } from '@/constants/categories';
import { db } from '@/db/client';
import { settings as settingsTable } from '@/db/schema';

/** ホーム「使ったお金」の表示方式 */
export type HomeBreakdown = 'category' | 'period';
/** ホーム「使ったお金」の比較対象。'income'(収入比)は期間別のみ有効 */
export type HomeComparison = 'prevMonth' | 'budget' | 'income';

export type AppSettings = {
  homeBreakdown: HomeBreakdown;
  homeComparison: HomeComparison;
  /** 支出カテゴリkey→月予算(円)。未設定のカテゴリはキーごと含まれない */
  categoryBudgets: Record<string, number>;
  /** 残高画面の金額をマスク表示する(目アイコンで切替) */
  hideBalances: boolean;
  /** 定期支出の支払日警告を出す日数(何日前から)。0=当日のみ */
  alertDaysBefore: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  homeBreakdown: 'category',
  homeComparison: 'prevMonth',
  categoryBudgets: {},
  hideBalances: false,
  alertDaysBefore: 3,
};

/** カテゴリ予算のDBキー。'categoryBudget.food' のようにカテゴリkeyを連結する */
const BUDGET_KEY_PREFIX = 'categoryBudget.';

// 予算の総額(円)。1件も設定がなければ null(=予算未設定)
export function totalBudget(budgets: Record<string, number>): number | null {
  const values = Object.values(budgets);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

// DBのkey-value(文字列)と AppSettings の相互変換。不正値は既定値へ落とす
function parseSettings(rows: { key: string; value: string }[]): AppSettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const parsed: AppSettings = { ...DEFAULT_SETTINGS, categoryBudgets: {} };

  const breakdown = map.get('homeBreakdown');
  if (breakdown === 'category' || breakdown === 'period') {
    parsed.homeBreakdown = breakdown;
  }

  const comparison = map.get('homeComparison');
  if (comparison === 'prevMonth' || comparison === 'budget' || comparison === 'income') {
    parsed.homeComparison = comparison;
  }

  for (const [key, value] of map) {
    if (key.startsWith(BUDGET_KEY_PREFIX) && /^\d+$/.test(value)) {
      parsed.categoryBudgets[key.slice(BUDGET_KEY_PREFIX.length)] = Number(value);
    }
  }

  parsed.hideBalances = map.get('hideBalances') === '1';

  const alertDays = map.get('alertDaysBefore');
  if (alertDays !== undefined && /^\d+$/.test(alertDays)) {
    parsed.alertDaysBefore = Number(alertDays);
  }

  // 収入比はカテゴリ別と組み合わせられない
  if (parsed.homeBreakdown === 'category' && parsed.homeComparison === 'income') {
    parsed.homeComparison = 'prevMonth';
  }

  return parsed;
}

function serializeSettings(value: AppSettings): { key: string; value: string }[] {
  return [
    { key: 'homeBreakdown', value: value.homeBreakdown },
    { key: 'homeComparison', value: value.homeComparison },
    { key: 'hideBalances', value: value.hideBalances ? '1' : '0' },
    { key: 'alertDaysBefore', value: String(value.alertDaysBefore) },
    // 未設定カテゴリも空文字で書き、予算の解除を上書き保存できるようにする
    ...CATEGORIES.map((cat) => ({
      key: `${BUDGET_KEY_PREFIX}${cat.key}`,
      value: value.categoryBudgets[cat.key] === undefined ? '' : String(value.categoryBudgets[cat.key]),
    })),
  ];
}

// 全設定を冪等にupsertする(StrictModeで二重実行されても無害)
function persistSettings(value: AppSettings) {
  Promise.all(
    serializeSettings(value).map((row) =>
      db
        .insert(settingsTable)
        .values(row)
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: row.value } }),
    ),
  ).catch((error) => console.error(error));
}

type SettingsContextValue = {
  settings: AppSettings;
  isLoaded: boolean;
  /** state更新とDBへの永続化を同時に行う */
  updateSettings: (patch: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const rows = await db.select().from(settingsTable);
        if (isActive) {
          setSettings(parseSettings(rows));
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isActive) {
          setIsLoaded(true);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      // 収入比はカテゴリ別と組み合わせられないため、切替時は前月比へ戻す
      if (next.homeBreakdown === 'category' && next.homeComparison === 'income') {
        next.homeComparison = 'prevMonth';
      }
      persistSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, isLoaded, updateSettings }),
    [settings, isLoaded, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings は SettingsProvider の内側で使うこと');
  }
  return ctx;
}
