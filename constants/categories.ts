export type Subcategory = {
  key: string;
  label: string;
};

export type Category = {
  key: string;
  label: string;
  icon: string;
  subcategories: Subcategory[];
};

export const CATEGORIES: Category[] = [
  {
    key: 'food',
    label: '食費',
    icon: '🍴',
    subcategories: [
      { key: 'groceries', label: '食料品' },
      { key: 'cafe', label: 'カフェ' },
      { key: 'breakfast', label: '朝ご飯' },
      { key: 'lunch', label: '昼ご飯' },
      { key: 'dinner', label: '晩ご飯' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'daily',
    label: '日用雑貨',
    icon: '🧴',
    subcategories: [
      { key: 'consumables', label: '消耗品' },
      { key: 'kids', label: '子ども関連' },
      { key: 'pet', label: 'ペット関連' },
      { key: 'tobacco', label: 'タバコ' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'transport',
    label: '交通',
    icon: '🚃',
    subcategories: [
      { key: 'train', label: '電車' },
      { key: 'taxi', label: 'タクシー' },
      { key: 'bus', label: 'バス' },
      { key: 'airplane', label: '飛行機' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'socializing',
    label: '交際費',
    icon: '🍻',
    subcategories: [
      { key: 'party', label: '飲み会' },
      { key: 'gift', label: 'プレゼント' },
      { key: 'ceremony', label: '冠婚葬祭' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'entertainment',
    label: 'エンタメ',
    icon: '🎵',
    subcategories: [
      { key: 'leisure', label: 'レジャー' },
      { key: 'event', label: 'イベント' },
      { key: 'movie', label: '映画・動画' },
      { key: 'music', label: '音楽' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'education',
    label: '教育・教養',
    icon: '📚',
    subcategories: [
      { key: 'books', label: '書籍' },
      { key: 'lessons', label: '習い事' },
      { key: 'tuition', label: '学費' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'beauty',
    label: '美容・衣服',
    icon: '👗',
    subcategories: [
      { key: 'clothes', label: '衣服' },
      { key: 'salon', label: '美容院・理髪' },
      { key: 'cosmetics', label: '化粧品' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'medical',
    label: '医療・保険',
    icon: '🏥',
    subcategories: [
      { key: 'hospital', label: '病院' },
      { key: 'medicine', label: '薬' },
      { key: 'insurance', label: '保険料' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'communication',
    label: '通信',
    icon: '📱',
    subcategories: [
      { key: 'mobile', label: 'スマホ' },
      { key: 'internet', label: 'インターネット' },
      { key: 'shipping', label: '送料' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'utilities',
    label: '水道・光熱',
    icon: '💡',
    subcategories: [
      { key: 'electricity', label: '電気' },
      { key: 'gas', label: 'ガス' },
      { key: 'water', label: '水道' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'housing',
    label: '住まい',
    icon: '🏠',
    subcategories: [
      { key: 'rent', label: '家賃' },
      { key: 'furniture', label: '家具' },
      { key: 'appliances', label: '家電' },
      { key: 'repair', label: '修繕' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'car',
    label: '車',
    icon: '🚗',
    subcategories: [
      { key: 'gasoline', label: 'ガソリン' },
      { key: 'parking', label: '駐車場' },
      { key: 'maintenance', label: '車検・整備' },
      { key: 'insurance', label: '自動車保険' },
      { key: 'other', label: 'その他' },
    ],
  },
  {
    key: 'other',
    label: 'その他',
    icon: '📦',
    subcategories: [
      { key: 'allowance', label: 'お小遣い' },
      { key: 'unknown', label: '使途不明金' },
      { key: 'uncategorized', label: '未分類' },
    ],
  },
];

export function getCategory(categoryKey: string | null | undefined): Category | undefined {
  if (!categoryKey) return undefined;
  return CATEGORIES.find((cat) => cat.key === categoryKey);
}

export function getCategoryLabel(categoryKey: string | null | undefined): string | null {
  return getCategory(categoryKey)?.label ?? null;
}

// 例: "食費 > カフェ"。キーが未登録ならキー文字列をそのまま返す(データを隠さないため)
export function formatCategoryLabel(
  categoryKey: string | null | undefined,
  subcategoryKey: string | null | undefined,
): string | null {
  if (!categoryKey) return null;
  const category = getCategory(categoryKey);
  const main = category?.label ?? categoryKey;
  if (!subcategoryKey) return main;
  const sub = category?.subcategories.find((s) => s.key === subcategoryKey);
  return `${main} > ${sub?.label ?? subcategoryKey}`;
}
