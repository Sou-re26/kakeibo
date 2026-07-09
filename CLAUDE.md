# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## プロジェクト概要

Expo (React Native) 製の家計簿アプリ。expo-router によるファイルベースルーティング、DBは expo-sqlite + Drizzle ORM。現在はプロトタイプ後期(入力→保存→一覧→月次集計・カテゴリ別円グラフ・口座残高の手動管理・取引の編集・削除・口座別の履歴/残高推移まで動作)。

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
  - `index.tsx` — ホーム。今月の収支+支出内訳の円グラフ(タップで分析タブへ)+「使ったお金」(`components/spending-summary.tsx`。カテゴリ別/期間別×前月比/予算比/収入比。予算比はカテゴリ別=各カテゴリ自身の予算、期間別=カテゴリ予算の合計と比較。集計は `lib/spending.ts` の純粋関数で、前月比のため表示月数+1ヶ月分を読む)。円グラフ直下に定期収支(`recurrings`)までの残り日数リスト(`lib/recurring.ts` の `nextOccurrence`/`daysUntil`)、収支ボックス直下に定期支出の警告カード(しきい値は設定 `alertDaysBefore`、既定3日)。フォーカス時に `lib/apply-recurrings.ts` の `applyDueRecurrings` を await してから読み込む(**期日が来た定期収支はここで通常の取引として自動記帳される**。金額設定済みのみ。サブカテゴリ・口座も反映され、メモ=名前、タグ=`定期`。`appliedThrough` で冪等)。
  - `balance.tsx` — 残高。総残高カード(前月末比+全口座合算のスパークライン。合算は `totalTransactionDelta`+`balanceSeriesBy`)+口座カード一覧(頭文字アイコン・現在残高・今月の増減)。行タップで `/account-detail?id=` へ、**長押しでその口座を出金元にした振替を開始**、「口座を追加」で `/account` へ。右上の目アイコンで金額をマスク(`hideBalances` 設定に永続化。マスク中はスパークラインごと非表示)。
  - `history.tsx` — 入出金。画面内セグメントで「タイムライン」と「カレンダー」を切り替える。タイムラインは日別グループ形式(左に日付(日曜=sunday色/土曜=saturday色)、カテゴリ色のアイコン丸+縦線、右にカード。日ヘッダーに支出合計)。グループ化は `lib/timeline.ts` の純粋関数、描画は `components/transaction-timeline.tsx`(口座詳細・日別シートと共用)。カードタップで取引の編集(下書きへコピーして `/input` へ push)。カレンダーは `components/transaction-calendar.tsx`(月組み立て・種別合計は `lib/calendar.ts`)で、各日に収入(accent色)/支出(文字色)/振替(灰)の総額を3段固定表示(無い種別の段は空けて詰めない)。記録のある日のタップで下からのモーダルシートに当日のタイムラインを表示。定期収支の日には小さなドット(収入=accent/支出=critical。存在しない日は月末へ丸め)を表示。ヘッダー右の虫眼鏡で**検索モーダル**(`components/transaction-search-sheet.tsx`)を開き、種別・期間(プリセット+開始/終了日)・カテゴリ・店名/メモ/タグのキーワード・出金元/入金先口座・金額範囲で絞り込める(判定は `lib/transaction-filter.ts` の純粋関数。タイムライン/カレンダーの両方に適用され、カレンダーの日別合計も絞り込み後の値になる。絞り込み中はセグメント下に条件数・該当件数と「解除」のバーを表示)。
  - `analysis.tsx` — 分析。画面内セグメントで「収支」(円グラフ+一覧。**円グラフのタップで支出⇄収入を切替**)と「予算比」(総額の予算比・収入比のカード+カテゴリ別予算比のバー一覧)を切り替える。ホームの円グラフからもここへ遷移する。
- `app/account.tsx` — 口座の追加/編集フォーム(`id` パラメータ有無で分岐)。削除もここから。ヘッダーはルートStackのデフォルト(`Stack.Screen options={{ title }}` でタイトル設定)。
- 設定 — 専用画面ではなく**サイドドロワー**(`components/settings-drawer.tsx`。Modal+Animatedの左スライドで自前実装、`@react-navigation/drawer` は未導入)。各タブのヘッダー左の☰ボタン(`components/settings-button.tsx`)で開く。中身は**項目別の折りたたみセクション**(ホームの表示/カテゴリ別予算/定期収支/支払日の警告。初期状態は「ホームの表示」のみ展開)。ホーム「使ったお金」の表示方式(カテゴリ別/期間別)・支出の比較対象(前月比/予算比/収入比。収入比は期間別のみ)・**カテゴリ別予算**(支出カテゴリごとの月予算。総額予算は合計から導出=`totalBudget()`)を変更する。設定値は `contexts/settings.tsx`(Context)経由で `settings` テーブル(key-value、予算は `categoryBudget.<key>` 行)に即時永続化。**定期収支(給料日・家賃等)の追加/削除**もここで行う(`recurrings` テーブルを直接CRUD。typeは `'expense'`/`'income'` のコード値。カテゴリは種別に応じた候補から2段階モーダル(大→サブ)で、口座もモーダルで選択=いずれもドロワーModal内の**入れ子Modal**。追加時は `appliedThrough`=今日で登録し当日以前の分は記帳しない)。支払日警告の日数(`alertDaysBefore`)もここで設定する。今後の設定項目もこのドロワーに追加する。**ドロワーの開閉ではタブ画面のフォーカスが失われない**ため、定期収支の変更を反映すべきホーム/履歴は `SettingsButton` の `onClosed` コールバックで再読込する(`drawerGen` を `useFocusEffect` の依存に入れる)。
- `app/account-detail.tsx` — 口座詳細。画面内セグメントで「履歴」(その口座の取引のみのタイムライン)と「推移」(残高の折れ線グラフ+対象区間の増減リスト。区間は1ヶ月/半年/1年/全期間)を切り替える。ヘッダー右の「編集」から `/account?id=` へ。推移の計算は `lib/balance-history.ts`(区間開始前の取引を基準残高へ畳み込み、日ごとの終値を系列にする)。
- 画面内セグメント(履歴のタイムライン/カレンダー、分析の収支/予算比、口座詳細の履歴/推移)は、ボタンタップに加えて**指に追従する左右スワイプ**でも切替できる。実装は `components/paged-tabs.tsx`(`ScrollView` の `pagingEnabled`。react-native-pager-view は未導入)で、`index`/`onIndexChange` でセグメント状態と同期する。各ページの縦FlatListとは軸が違うため共存する。
- 収支追加ボタン(FAB)は `components/add-transaction-fab.tsx` に共通化し、全タブ画面に配置。**タブバーは標準配置(画面に被さらない)なので画面下端=タブバー上端**であり、FABの `bottom` は固定16(タブバー高さを足すと1本分浮いて見える。過去にそれが原因で「位置が高すぎる」となった)。タブ内の一覧は `paddingBottom: tabBarHeight + 88` でFABと重ならないようにする。縦スクロール中は下へスライドアウトし、スワイプ終了(慣性含む)で戻る(`hooks/use-auto-hide-fab.ts` の `scrollHandlers` を各画面の縦ScrollView/FlatListへ渡し、`hidden` をFABへ渡す)。
- 設定ドロワーの開閉ボタン(☰)は `components/settings-button.tsx` に共通化し、**4タブ全てのヘッダー左**(タイトルの左)に配置する。
- 各タブ画面のヘッダー(タイトル・セグメント・☰・残高の目アイコン・履歴の検索アイコン)は**スクロール領域の外**に置き、縦スクロールで画面外に出ないようにする。
- **`<Link asChild>` の子要素の `style` は必ず単一オブジェクトで渡す(配列不可)。** expo-routerのSlotが `@radix-ui/react-slot` 経由で `style` を **オブジェクト展開** でマージするため、子が配列 `style={[a, b]}` だと `{0:a, 1:b}` に化けてスタイルが全消失する(FABの背景・位置が消える不具合の原因だった)。動的な値と合成したい場合は `style={StyleSheet.flatten([a, b])}` で1オブジェクトにする。
- 取引登録/編集ウィザードの**実際の遷移**(コードが正)。3画面ともルートStackのデフォルトヘッダーを `_layout.tsx` で非表示にし、画面内ヘッダー(✕/←+画面名)を使う:
  1. `app/input.tsx` — 金額入力+種別(支出/収入/振替)選択 → 「次へ」で `/detail` へ push
  2. `app/detail.tsx` — 日付・店舗・タグ(カンマ/読点区切りで入力し、保存時にカンマ区切りへ正規化)・メモ入力、金額タップで**電卓シート**(`components/calculator-sheet.tsx`+`lib/calculator.ts` の純粋ロジック。÷は四捨五入で整数円)、カテゴリ行タップで `/category` へ push、口座選択(振替は出金元/入金先の2行)は**画面内モーダル**、保存(新規はinsertして `(tabs)` へ replace、編集はupdateして `router.dismiss(2)` で元の画面へ)。編集時は「この記録を削除」ボタンも表示。
  3. `app/category.tsx` — カテゴリ/サブカテゴリ選択(`constants/categories.ts` の静的データ駆動)後、下書きへ書き込んで `router.back()` で `/detail` へ戻る(replaceにすると detail が新インスタンスになり入力が消える)
- ウィザードの状態は `contexts/transaction-draft.tsx` の `TransactionDraft`(Context)に一元化されており、**画面間でパラメータを渡さない**。新規は FAB の `startNew()`、編集はタイムラインのカードタップ時の `startEdit(tx)` で下書きを初期化してから `/input` へ遷移する。

### データ層
- `db/client.ts` — `expo-sqlite` を同期オープンし `drizzle()` でラップ。DBファイル名は `kakeibo.db`。
- `db/schema.ts` — テーブルは3つ。`transactions`(`type`, `amount`(整数円), `categoryKey`, `subcategoryKey`, `accountId`, `toAccountId`, `store`, `memo`, `tags`(ユーザー任意タグのカンマ区切り、null=なし), `date`)、`accounts`(`name`, `balance`(整数円、負値=負債も可、default 0))、`settings`(key-value。値は文字列で保存し、型付け・既定値は `contexts/settings.tsx` が担う)、`recurrings`(定期支出/収入。`type`(`'expense'`/`'income'` コード値)、`label`、`dayOfMonth`(1〜31、存在しない日は月末扱い)、`amount`(任意。null=自動記帳しない)、`categoryKey`/`subcategoryKey`、`accountId`(ソフト参照)、`appliedThrough`(この日までの発生分は記帳済み))の4つ。型は `$inferSelect` / `$inferInsert` から導出する(手書きの型定義を作らない)。
- **口座残高は導出モデル。** `accounts.balance` は「基準残高」で、**現在残高 = 基準残高 + 取引差分**(`lib/balance.ts` の純粋関数で計算。支出-/収入+/振替は出金元-・入金先+)。口座編集画面は現在残高を入力させ、保存時に基準残高へ逆算する。`transactions.accountId`(振替は出金元)/`toAccountId`(振替の入金先)は**FK制約なしのソフト参照**で、null=口座未指定(残高に影響しない)。口座を削除しても取引は残る(参照は表示・集計側で無視)。
- カテゴリマスタのテーブルは存在しない。カテゴリの定義とラベル解決は `constants/categories.ts`(`getCategory` / `getCategoryLabel` / `formatCategoryLabel`)。
- `lib/summary.ts` — 月次集計の純粋関数(`getMonthRange` / `summarizeTransactions` / `summarizeByCategory`)。`振替` は収入・支出に計上しない。ホーム画面が `useFocusEffect` で参照。

### UI/テーマ
- `ThemedText`/`ThemedView`(`components/`)と `constants/theme.ts` でライト/ダーク配色を管理。`hooks/use-color-scheme` はネイティブ/Web用に分岐実装(`.ts`/`.web.ts`)。
- アイコンは `components/ui/icon-symbol.tsx`(iOSはSF Symbols経由の `.ios.tsx` 実装、Android/WebはMaterialIconsへのマッピング)。**新しいアイコン名を使う場合はAndroid/Web用の `MAPPING` にも追記しないと表示されない。**
- グラフは `react-native-svg` + 自前描画。扇形の計算は `lib/pie.ts`(純粋関数)、描画は `components/pie-chart.tsx`(スライス内にカテゴリ名+割合の小ラベルを表示。弧長・リング幅に収まらないスライスでは非表示。文字色はスライス明度で近黒/近白を自動選択。中央の金額は穴の幅に合わせて自動縮小)。折れ線(残高推移)も同じ構成で、座標計算は `lib/line.ts`、描画は `components/line-chart.tsx`(単一系列・`accent` 色。値はグリッドラベルと下の増減リストで冗長化)。カテゴリ色は `constants/theme.ts` の `CategoryColors`(**データの大小で色を並べ替えず、カテゴリキーに固定で紐づける**)。色系統はユーザー指定(食費=黄緑…車=朱、その他=灰)で、系統内の明度は色覚多様性の分離を最大化する値を採用済み。**ΔE12未達のペアが残るため、色だけで識別させない**(絵文字アイコン・ラベルを必ず併記する)。

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
- **金額0円で保存できる:** `app/detail.tsx` のバリデーションが整数チェックのみ(`input.tsx` 側にも下限ガードなし)。
- **定期収支の自動記帳が非トランザクション → 重複記帳リスク:** `lib/apply-recurrings.ts` は1ルールの複数発生分を `insert` ループで書いた**後に** `appliedThrough` を1回更新する。ループ途中でinsertが失敗/中断すると `appliedThrough` が進まず、次回実行で成功済みの分を再insertして重複する。同一ルールのinsert群+`appliedThrough`更新を `db.transaction` で束ねること。

### 未実装
- `app/detail.tsx` の日付選択はAndroid専用(`DateTimePickerAndroid` 直呼び)。iOS未対応。
- 履歴の検索モーダルの開始日/終了日ピッカーはWeb未対応(タップしても何も起きない。Androidは `DateTimePickerAndroid`、iOSはインラインピッカーで対応済み。Webは期間プリセットのみ使える)。
- 設定ドロワー内のカテゴリ/口座選択はModalの入れ子(Modal内Modal)。Androidでは動くが**iOSの多重Modalは未検証**。
- `app/input.tsx` の「カテゴリ選択」ボタンに `onPress` が未設定。
- 定期収支の自動記帳はホームのフォーカス時のみ実行される(ホームを開かずに他タブだけ見た場合は記帳されない)。
- 定期収支の編集機能なし(削除→再追加で代用)。

### UI負債
- **ダークモードで壊れる色のハードコード:** 規約「色をハードコードしない」の違反がウィザード3画面に集中。`app/input.tsx` は**ほぼ全面**(キーパッド枠 `#eee`、種別ボタン背景 `#eee`/文字 `#888`、削除ボタン `#444` 等)、`app/detail.tsx`(行区切り `#ddd`、`currencyLabel #888`、保存ボタン `#4CAF50`)、`app/category.tsx`(行区切り `#ddd`、サブラベル `#888`)、`app/account.tsx:206`(`deleteText: '#E5484D'` は `Colors.critical` があるのに直書き)。触ったファイルから `constants/theme.ts` 参照へ直す。
- **セーフエリア未対応(`paddingTop: 60` 固定):** `app/input.tsx` / `app/detail.tsx` / `app/category.tsx` のウィザード3画面が固定値のまま。`useSafeAreaInsets` へ移行する。

### 掃除
- テンプレート残骸 `app/modal.tsx` が `app/_layout.tsx` の `<Stack.Screen name="modal" …>`(40行目付近)でまだ登録されている。ルート自体は未使用なので、ファイルと該当行をまとめて削除できる。

### 技術的負債(スキーマ)
- `type` が日本語リテラル(`'支出'`/`'収入'`/`'振替'`)のままDBに保存されている。コード値(`'expense'` 等)への移行が残っている。**依存範囲はリスト初出時より広く**、`lib/summary.ts`・`app/(tabs)/analysis.tsx` に加え、`lib/balance.ts`・`lib/apply-recurrings.ts`・`lib/calendar.ts`・`lib/transaction-filter.ts`・`components/transaction-timeline.tsx` も `'支出'`/`'収入'`/`'振替'` リテラルに依存する(移行時は一括で対応が必要)。
