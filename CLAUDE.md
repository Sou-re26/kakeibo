# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## プロジェクト概要

Expo (React Native) 製の家計簿アプリ。expo-router によるファイルベースルーティング、DBは expo-sqlite + Drizzle ORM。現在はプロトタイプ後期(入力→保存→一覧の最小ループのみ動作。編集・削除・集計は未実装)。

## よく使うコマンド

```bash
npm install              # 依存関係のインストール
npx expo start           # 開発サーバー起動
npm run android          # Android実機/エミュレータで起動
npm run ios              # iOSシミュレータで起動
npm run web              # Webで起動
npm run lint             # ESLint (expo lint) 実行
npx tsc --noEmit         # 型チェック(npmスクリプト未定義)
```

- テストは未導入(テストランナー・テストファイルなし)。ロジックを追加する際は、後でテストしやすいようUIから分離した純粋関数として書くこと。

## DBスキーマ変更の手順

1. `db/schema.ts` を編集する
2. `npx drizzle-kit generate` を実行し、`drizzle/` 配下にマイグレーションSQLを生成する
3. 生成されたSQLの内容を確認する(SQLiteは `ALTER TABLE` の制約が強く、意図しないテーブル再作成が起きうる)

生成したマイグレーションは `app/_layout.tsx` の `useMigrations(db, migrations)` によりアプリ起動時に自動適用される(手動での `push` は不要・禁止)。マイグレーションSQLの静的importは `babel-plugin-inline-import`(babel.config.js)と `metro.config.js` の `sourceExts` 拡張で実現している。

**一度コミットしたマイグレーションファイルは編集しない。** 変更が必要な場合は新しいマイグレーションを追加する。

## アーキテクチャ

### 起動〜マイグレーション
`app/_layout.tsx` がルートレイアウト。起動時に `useMigrations` でDBマイグレーションを実行し、完了するまで画面をブロックする(`error` ならエラーメッセージ、`!success` ならローディング表示)。

### ルーティング (expo-router, typedRoutes有効)
- `app/(tabs)/` — ボトムタブ。`index.tsx`(ホーム/今月の収支)と `history.tsx`(取引履歴一覧)。
- 取引登録ウィザードの**実際の遷移**(コードが正):
  1. `app/input.tsx` — 金額入力+種別(支出/収入/振替)選択 → 「次へ」で `/detail` へ push
  2. `app/detail.tsx` — 日付・店舗・メモ入力、カテゴリ行タップで `/category` へ push、保存(Drizzleでinsertし `(tabs)` へ)
  3. `app/category.tsx` — カテゴリ/サブカテゴリ選択(`constants/categories.ts` の静的データ駆動)後、`router.replace` で `/detail` へ
- 画面間の値の受け渡しは push/replace のパラメータ(`type`/`amount`/`category`)。**項目を増やす場合はパラメータのバケツリレーを拡張せず、ウィザード下書き状態をContext等に集約するリファクタリングを先に行うこと**(「既知の課題」参照)。

### データ層
- `db/client.ts` — `expo-sqlite` を同期オープンし `drizzle()` でラップ。DBファイル名は `kakeibo.db`。
- `db/schema.ts` — テーブルは `transactions` の1つのみ(`type`, `amount`, `category`, `store`, `memo`, `date`)。型は `$inferSelect` / `$inferInsert` から導出する(手書きの型定義を作らない)。
- ウォレット/口座やカテゴリマスタのテーブルは存在しない。

### UI/テーマ
- `ThemedText`/`ThemedView`(`components/`)と `constants/theme.ts` でライト/ダーク配色を管理。`hooks/use-color-scheme` はネイティブ/Web用に分岐実装(`.ts`/`.web.ts`)。
- アイコンは `components/ui/icon-symbol.tsx`(iOSはSF Symbols経由の `.ios.tsx` 実装、Android/WebはMaterialIconsへのマッピング)。**新しいアイコン名を使う場合はAndroid/Web用の `MAPPING` にも追記しないと表示されない。**

## コーディング規約(このプロジェクト固有)

- **色をハードコードしない。** `#fff` 等の生の色コードは `constants/theme.ts` の `Colors` に追加して参照する。既存コードには違反箇所が残っている(ダークモードで表示が壊れる原因)が、触ったファイルから順次直す。
- **セーフエリアは `useSafeAreaInsets` で確保する。** 既存の `paddingTop: 60` は暫定実装。新規画面では固定値を使わない(Androidは `edgeToEdgeEnabled: true`)。
- **金額は円の整数として扱う。** JPYに小数は存在しない。浮動小数点での金額計算・保存を新たに追加しない(現状の `real` カラムは負債。「既知の課題」参照)。
- **プラットフォーム分岐が必要なAPIを直呼びしない。** `DateTimePickerAndroid` のようなAndroid専用APIは iOS 対応の分岐かクロスプラットフォームのラッパー経由にする。
- **DBに表示用文字列を保存しない。** 新規カラムはコード値(例: `'expense'`)で保存し、日本語ラベルは表示層で解決する。既存の `type`(日本語リテラル)と `category`(`"支出 > 食費 > カフェ"` 形式の連結文字列)は負債であり、踏襲しない。
- **画面フォーカス時に更新が必要な一覧は `useFocusEffect` か Drizzle の `useLiveQuery` を使う。**`useEffect(..., [])` はタブ画面ではマウント時しか走らない。
- Expoテンプレート残骸(`app/modal.tsx`, `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `collapsible.tsx` 等)は新規コードから参照しない。掃除は歓迎。

## 既知の課題

変更時はこのリストを最新化すること(直したら消す)。

### バグ(優先度高)
- **カテゴリ選択で入力内容が消える:** detail → category → `router.replace('/detail')` の遷移でdetailが新インスタンスになり、店舗・メモ・日付が失われる。スタックも `input → detail(旧) → detail(新)` と二重化する。修正はウィザード状態のContext化とセット。
- **履歴タブが再フォーカスで更新されない:** `app/(tabs)/history.tsx` の取得が `useEffect(..., [])` のためマウント時のみ。
- **ダークモードで履歴カードが読めない:** カード背景 `#fff` 固定+テーマ色の白文字。
- **金額0円で保存できる:** `app/detail.tsx` のバリデーションが `NaN` チェックのみ。
- **input/category/detail にデフォルトヘッダーが付く:** ルートStackで `options` 未指定のため、各画面の自前ヘッダーと二重になる。

### 未実装
- ホーム画面(`app/(tabs)/index.tsx`)の収支金額はハードコード。`transactions` からの集計ロジック未実装。
- `app/detail.tsx` の日付選択はAndroid専用(`DateTimePickerAndroid` 直呼び)。iOS未対応。
- `app/detail.tsx` の「財布」欄はダミー(口座機能未実装)。
- `app/input.tsx` の「カテゴリ選択」ボタンに `onPress` が未設定。
- 取引の編集・削除機能なし。

### 技術的負債(スキーマ)
- `amount` が `real` 型。データが少ないうちに `integer`(円)へマイグレーションすべき。
- `category` が表示用連結文字列(先頭に `type` を含み二重管理)。コード値(`categoryKey`/`subcategoryKey`)への移行が集計・グラフ機能の前提。
