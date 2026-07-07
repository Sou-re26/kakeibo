# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## プロジェクト概要

Expo (React Native) 製の家計簿アプリ。expo-router によるファイルベースルーティング、DBは expo-sqlite + Drizzle ORM。現在はプロトタイプ後期(入力→保存→一覧→月次集計・カテゴリ別円グラフ・口座残高の手動管理まで動作。取引の編集・削除、取引と口座の連動は未実装)。

## よく使うコマンド

```bash
npm install              # 依存関係のインストール
npx expo start           # 開発サーバー起動
npm run android          # Android実機/エミュレータで起動
npm run ios              # iOSシミュレータで起動
npm run web              # Webで起動
npm run lint             # ESLint (expo lint) 実行
npm run typecheck        # 型チェック (tsc --noEmit)
npm run check            # lint+型チェック一括(コミット前に実行)
```

- テストは未導入(テストランナー・テストファイルなし)。ロジックを追加する際は、後でテストしやすいようUIから分離した純粋関数として書くこと。
- **依存関係を追加・更新したら `expo start` を再起動すること。** 稼働中のMetroは後から `npm install` されたパッケージを解決できず、Expo Go側が `UnableToResolveError`(HTTP 500)で起動に失敗する。再起動で直らない場合のみ `npx expo start -c`。

## DBスキーマ変更の手順

1. `db/schema.ts` を編集する
2. `npx drizzle-kit generate` を実行し、`drizzle/` 配下にマイグレーションSQLを生成する
3. 生成されたSQLの内容を確認する(SQLiteは `ALTER TABLE` の制約が強く、意図しないテーブル再作成が起きうる)

落とし穴(0001で実際に踏んだもの):
- カラムの追加と削除が同じdiffに含まれると `drizzle-kit generate` がリネーム確認の対話プロンプトを出し、非TTYでは失敗する。**追加と削除は2回のgenerateに分ける。**
- テーブル再作成を伴うSQLでは、コピーの `INSERT ... SELECT` が**旧テーブルに存在しない新カラムを参照する**ことがある(実行時エラーになる)。生成SQLを必ず読み、コミット前なら修正してよい。データ変換(backfill)もこのSELECTに書ける(例: `0001_past_mad_thinker.sql`)。

生成したマイグレーションは `app/_layout.tsx` の `useMigrations(db, migrations)` によりアプリ起動時に自動適用される(手動での `push` は不要・禁止)。マイグレーションSQLの静的importは `babel-plugin-inline-import`(babel.config.js)と `metro.config.js` の `sourceExts` 拡張で実現している。

**一度コミットしたマイグレーションファイルは編集しない。** 変更が必要な場合は新しいマイグレーションを追加する。

## アーキテクチャ

### 起動〜マイグレーション
`app/_layout.tsx` がルートレイアウト。起動時に `useMigrations` でDBマイグレーションを実行し、完了するまで画面をブロックする(`error` ならエラーメッセージ、`!success` ならローディング表示)。

### ルーティング (expo-router, typedRoutes有効)
- `app/(tabs)/` — ボトムタブ4つ。表示順は `_layout.tsx` の記述順で **ホーム(`index`)→ 残高(`balance`)→ 入出金(`history`)→ 分析(`analysis`)**。
  - `index.tsx` — ホーム。今月の収支+支出内訳の円グラフ(タップで分析タブへ)。
  - `balance.tsx` — 残高。総残高+口座一覧。行タップで `/account?id=` へ、「口座を追加」で `/account` へ。
  - `history.tsx` — 入出金。日別グループのタイムライン形式(左に日付(日曜=sunday色/土曜=saturday色)、カテゴリ色のアイコン丸+縦線、右にカード。日ヘッダーに支出合計)。グループ化は `lib/timeline.ts` の純粋関数。
  - `analysis.tsx` — 分析。今月のカテゴリ別内訳(支出/収入切替+円グラフ+一覧)。ホームの円グラフからもここへ遷移する。
- `app/account.tsx` — 口座の追加/編集フォーム(`id` パラメータ有無で分岐)。削除もここから。ヘッダーはルートStackのデフォルト(`Stack.Screen options={{ title }}` でタイトル設定)。
- 収支追加ボタン(FAB)は `components/add-transaction-fab.tsx` に共通化し、全タブ画面に配置。`useBottomTabBarHeight()` でタブバーの高さ分だけ上げて重なりを防ぐ(タブ内の一覧は `paddingBottom: tabBarHeight + 88` でFABと重ならないようにする)。
- **`<Link asChild>` の子要素の `style` は必ず単一オブジェクトで渡す(配列不可)。** expo-routerのSlotが `@radix-ui/react-slot` 経由で `style` を **オブジェクト展開** でマージするため、子が配列 `style={[a, b]}` だと `{0:a, 1:b}` に化けてスタイルが全消失する(FABの背景・位置が消える不具合の原因だった)。動的な値と合成したい場合は `style={StyleSheet.flatten([a, b])}` で1オブジェクトにする。
- 取引登録ウィザードの**実際の遷移**(コードが正):
  1. `app/input.tsx` — 金額入力+種別(支出/収入/振替)選択 → 「次へ」で `/detail` へ push
  2. `app/detail.tsx` — 日付・店舗・メモ入力、カテゴリ行タップで `/category` へ push、口座選択(振替は出金元/入金先の2行)は**画面内モーダル**(パラメータのバケツリレーを増やさないため遷移させない)、保存(Drizzleでinsertし `(tabs)` へ)
  3. `app/category.tsx` — カテゴリ/サブカテゴリ選択(`constants/categories.ts` の静的データ駆動)後、`router.replace` で `/detail` へ
- 画面間の値の受け渡しは push/replace のパラメータ(`type`/`amount`/`categoryKey`/`subcategoryKey`)。**項目を増やす場合はパラメータのバケツリレーを拡張せず、ウィザード下書き状態をContext等に集約するリファクタリングを先に行うこと**(「既知の課題」参照)。

### データ層
- `db/client.ts` — `expo-sqlite` を同期オープンし `drizzle()` でラップ。DBファイル名は `kakeibo.db`。
- `db/schema.ts` — テーブルは2つ。`transactions`(`type`, `amount`(整数円), `categoryKey`, `subcategoryKey`, `accountId`, `toAccountId`, `store`, `memo`, `date`)と `accounts`(`name`, `balance`(整数円、負値=負債も可、default 0))。型は `$inferSelect` / `$inferInsert` から導出する(手書きの型定義を作らない)。
- **口座残高は導出モデル。** `accounts.balance` は「基準残高」で、**現在残高 = 基準残高 + 取引差分**(`lib/balance.ts` の純粋関数で計算。支出-/収入+/振替は出金元-・入金先+)。口座編集画面は現在残高を入力させ、保存時に基準残高へ逆算する。`transactions.accountId`(振替は出金元)/`toAccountId`(振替の入金先)は**FK制約なしのソフト参照**で、null=口座未指定(残高に影響しない)。口座を削除しても取引は残る(参照は表示・集計側で無視)。
- カテゴリマスタのテーブルは存在しない。カテゴリの定義とラベル解決は `constants/categories.ts`(`getCategory` / `getCategoryLabel` / `formatCategoryLabel`)。
- `lib/summary.ts` — 月次集計の純粋関数(`getMonthRange` / `summarizeTransactions` / `summarizeByCategory`)。`振替` は収入・支出に計上しない。ホーム画面が `useFocusEffect` で参照。

### UI/テーマ
- `ThemedText`/`ThemedView`(`components/`)と `constants/theme.ts` でライト/ダーク配色を管理。`hooks/use-color-scheme` はネイティブ/Web用に分岐実装(`.ts`/`.web.ts`)。
- アイコンは `components/ui/icon-symbol.tsx`(iOSはSF Symbols経由の `.ios.tsx` 実装、Android/WebはMaterialIconsへのマッピング)。**新しいアイコン名を使う場合はAndroid/Web用の `MAPPING` にも追記しないと表示されない。**
- グラフは `react-native-svg` + 自前描画。扇形の計算は `lib/pie.ts`(純粋関数)、描画は `components/pie-chart.tsx`。カテゴリ色は `constants/theme.ts` の `CategoryColors`(**データの大小で色を並べ替えず、カテゴリキーに固定で紐づける**)。色系統はユーザー指定(食費=黄緑…車=朱、その他=灰)で、系統内の明度は色覚多様性の分離を最大化する値を採用済み。**ΔE12未達のペアが残るため、色だけで識別させない**(絵文字アイコン・ラベルを必ず併記する)。

## コーディング規約(このプロジェクト固有)

- **色をハードコードしない。** `#fff` 等の生の色コードは `constants/theme.ts` の `Colors` に追加して参照する。既存コードには違反箇所が残っている(ダークモードで表示が壊れる原因)が、触ったファイルから順次直す。
- **セーフエリアは `useSafeAreaInsets` で確保する。** 既存の `paddingTop: 60` は暫定実装。新規画面では固定値を使わない(Androidは `edgeToEdgeEnabled: true`)。
- **金額は円の整数として扱う。** JPYに小数は存在しない。浮動小数点での金額計算・保存を追加しない(`amount` カラムは `integer`)。
- **プラットフォーム分岐が必要なAPIを直呼びしない。** `DateTimePickerAndroid` のようなAndroid専用APIは iOS 対応の分岐かクロスプラットフォームのラッパー経由にする。
- **DBに表示用文字列を保存しない。** 新規カラムはコード値(例: `'expense'`)で保存し、日本語ラベルは表示層で解決する。既存の `type`(日本語リテラル)は負債であり、踏襲しない(「既知の課題」参照)。
- **画面フォーカス時に更新が必要な一覧は `useFocusEffect` か Drizzle の `useLiveQuery` を使う。**`useEffect(..., [])` はタブ画面ではマウント時しか走らない。
- Expoテンプレート残骸(`app/modal.tsx`, `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `collapsible.tsx` 等)は新規コードから参照しない。掃除は歓迎。

## 既知の課題

変更時はこのリストを最新化すること(直したら消す)。

### バグ(優先度高)
- **カテゴリ選択で入力内容が消える:** detail → category → `router.replace('/detail')` の遷移でdetailが新インスタンスになり、店舗・メモ・日付が失われる。スタックも `input → detail(旧) → detail(新)` と二重化する。修正はウィザード状態のContext化とセット。
- **金額0円で保存できる:** `app/detail.tsx` のバリデーションが `NaN` チェックのみ。
- **input/category/detail にデフォルトヘッダーが付く:** ルートStackで `options` 未指定のため、各画面の自前ヘッダーと二重になる。

### 未実装
- **収入・振替のカテゴリが支出用と共通(次のタスク):** `constants/categories.ts` は支出向けカテゴリのみで、`app/category.tsx` は種別に関わらず同じ一覧を表示する。収入用カテゴリ(給与・賞与・副収入等)の分離が必要。カテゴリマスタに種別の概念を持たせる設計変更を伴う。
- `app/detail.tsx` の日付選択はAndroid専用(`DateTimePickerAndroid` 直呼び)。iOS未対応。
- `app/input.tsx` の「カテゴリ選択」ボタンに `onPress` が未設定。
- 取引の編集・削除機能なし。

### 技術的負債(スキーマ)
- `type` が日本語リテラル(`'支出'`/`'収入'`/`'振替'`)のままDBに保存されている。コード値(`'expense'` 等)への移行が残っている(集計ロジック `lib/summary.ts` と `app/(tabs)/analysis.tsx` も `'支出'`/`'収入'` リテラルに依存)。
