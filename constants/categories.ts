export type Category = {
  key: string;
  label: string;
  icon: string;
  subcategories: string[];
};

export const CATEGORIES: Category[] = [
  { key: 'food', label: '食費', icon: '🍴', subcategories: ['食料品', 'カフェ', '朝ご飯', '昼ご飯', '晩ご飯', 'その他'] },
  { key: 'daily', label: '日用雑貨', icon: '🧴', subcategories: ['消耗品', '子ども関連', 'ペット関連', 'タバコ', 'その他'] },
  { key: 'transport', label: '交通', icon: '🚃', subcategories: ['電車', 'タクシー', 'バス', '飛行機', 'その他'] },
  { key: 'entertainment', label: 'エンタメ', icon: '🎵', subcategories: ['レジャー', 'イベント', '映画・動画', '音楽', 'その他'] },
  { key: 'other', label: 'その他', icon: '📦', subcategories: ['お小遣い', '使途不明金', '未分類'] },
];