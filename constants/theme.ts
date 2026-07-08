/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

import { INCOME_CATEGORIES } from '@/constants/categories';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    border: '#ccc',
    accent: '#007AFF', // FAB等の強調色
    onAccent: '#fff', // accent上のテキスト/アイコン
    card: '#f4f4f5', // 一覧カードの背景
    income: '#006300', // 収入金額のテキスト(datavizのsuccess text)
    sunday: '#d03b3b',
    saturday: '#256abf',
    scrim: 'rgba(0,0,0,0.4)', // モーダル背景
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    border: '#333',
    accent: '#0A84FF',
    onAccent: '#fff',
    card: '#1f2123',
    income: '#0ca30c',
    sunday: '#e66767',
    saturday: '#3987e5',
    scrim: 'rgba(0,0,0,0.6)',
  },
};

// カテゴリ別グラフ・タイムラインの色。キーは constants/categories.ts のカテゴリキーに対応し、
// 'uncategorized' はカテゴリ未選択の取引用。順位でなくカテゴリに固定で紐づける
// (データの大小で色を並べ替えない)。
// 色系統はユーザー指定(食費=黄緑、日用雑貨=水色、交通=紫、交際費=赤、エンタメ=オレンジ、
// 教育・教養=茶、美容・衣服=緑、医療・保険=暗い黄、通信=紺寄り青、水道・光熱=明るい黄、
// 住まい=ピンク、車=朱、その他=灰)。系統内で明度を自動探索して色覚多様性の分離を最大化済み
// (最悪ペア: light ΔE6.7 / dark ΔE10.1。ΔE12未達のペアは絵文字アイコン+ラベルの
// 副次符号化で補う前提。色を変更する場合はdataviz validatorで再検証すること)。
//
// 収入カテゴリは色分けせず黒系一色で統一する(識別はラベルで行う方針)。キーは
// constants/categories.ts の INCOME_CATEGORIES から取り込み、二重管理を避ける。
const incomeColors = (color: string): Record<string, string> =>
  Object.fromEntries(INCOME_CATEGORIES.map((cat) => [cat.key, color]));

export const CategoryColors: Record<
  keyof typeof Colors,
  Record<string, string>
> = {
  light: {
    food: '#8BC34A',
    daily: '#0097A7',
    transport: '#7E57C2',
    socializing: '#F44336',
    entertainment: '#EF6C00',
    education: '#A05B1F',
    beauty: '#388E3C',
    medical: '#8F7000',
    communication: '#2C51A8',
    utilities: '#D9AA00',
    housing: '#EC407A',
    car: '#A93000',
    other: '#7B7975',
    uncategorized: '#A3A19A',
    ...incomeColors('#212121'), // 黒系(白背景上でも視認できる近黒)
  },
  dark: {
    food: '#9CCC65',
    daily: '#26C6DA',
    transport: '#9575CD',
    socializing: '#E64545',
    entertainment: '#FB8C00',
    education: '#96591A',
    beauty: '#58B85C',
    medical: '#A98600',
    communication: '#4A5FD0',
    utilities: '#F0CB00',
    housing: '#F275A8',
    car: '#FF7043',
    other: '#98968F',
    uncategorized: '#75736D',
    ...incomeColors('#424242'), // 黒系(暗背景 #151718 上でも分離する濃灰)
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
