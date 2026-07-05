# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## プロジェクト概要

Expo (React Native) 製の家計簿アプリ。expo-router によるファイルベースルーティング、DBは expo-sqlite + Drizzle ORM。

## よく使うコマンド

```bash
npm install              # 依存関係のインストール
npx expo start           # 開発サーバー起動
npm run android           # Android実機/エミュレータで起動
npm run ios               # iOSシミュレータで起動
npm run web                # Webで起動
npm run lint               # ESLint (expo lint) 実行
```

- テストは未導入（テストランナー・テストファイルなし）。
- Drizzleのnpmスクリプトは未定義。`db/schema.ts` を変更したら `npx drizzle-kit generate` を実行し、`drizzle/` 配下に新しいマイグレーションSQLを生成すること。生成したマイグレーションは `app/_layout.tsx` の `useMigrations(db, migrations)` によりアプリ起動時に自動適用される（手動での `push` は不要）。

## アーキテクチャ

### 起動〜マイグレーション
`app/_layout.tsx` がルートレイアウト。起動時に `useMigrations` でDBマイグレーションを実行し、完了するまで画面をブロックする（`error` ならエラーメッセージ、`!success` ならローディング表示）。マイグレーション本体は `drizzle/migrations.js` にSQLとして静的インポートされている（`.sql` を直接importできるように `babel-plugin-inline-import`（babel.config.js）と `metro.config.js` の `sourceExts` 拡張で構成されている）。

### ルーティング (expo-router, typedRoutes有効)
- `app/(tabs)/` — ボトムタブ。`index.tsx`(ホーム／今月の収支) と `history.tsx`(取引履歴一覧)。
- 取引登録は3画面をまたぐウィザード形式:
  1. `app/input.tsx` — 金額入力＋種別（支出/収入/振替）選択
  2. `app/category.tsx` — カテゴリ／サブカテゴリ選択（`constants/categories.ts` の静的データ駆動）
  3. `app/detail.tsx` — 日付・店舗・メモ入力、保存（Drizzleでinsertし `(tabs)` に戻る）
  
  画面間の値の受け渡しは expo-router の push/replace のパラメータ（`type`/`amount`/`category`）で行っている。

### データ層
- `db/client.ts` — `expo-sqlite` を同期オープンし `drizzle()` でラップ。
- `db/schema.ts` — テーブルは `transactions` の1つのみ（`type`, `amount`, `category`, `store`, `memo`, `date`）。カテゴリはDB上は正規化されておらず、`constants/categories.ts` の階層データを `"大分類 > 中分類"` のような文字列に連結してテキストカラムに保存している。
- ウォレット／口座やカテゴリマスタのテーブルは存在しない。

### UI/テーマ
- `ThemedText`/`ThemedView`（`components/`）と `constants/theme.ts` でライト/ダーク配色を管理。`hooks/use-color-scheme` はネイティブ/Web用に分岐実装（`.ts`/`.web.ts`）。
- アイコンは `components/ui/icon-symbol.tsx`（iOSはSF Symbols経由の `.ios.tsx` 実装、Android/WebはMaterialIconsへのマッピング）。**新しいアイコン名を使う場合はAndroid/Web用の `MAPPING` にも追記しないと表示されない。**

### 既知のギャップ（実装未完了箇所）
- ホーム画面（`app/(tabs)/index.tsx`）の収支金額はハードコードされた値で、`transactions` からの集計ロジックは未実装。
- `app/detail.tsx` の日付選択は `DateTimePickerAndroid` を直接呼び出しており、iOS向けの分岐が未実装。
- `app/detail.tsx` の「財布」欄はダミー（口座機能未実装）。
- `app/input.tsx` の「カテゴリ選択」ボタンに `onPress` が未設定。
