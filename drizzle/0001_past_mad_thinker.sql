PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`category_key` text,
	`subcategory_key` text,
	`category` text,
	`store` text,
	`memo` text,
	`date` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "type", "amount", "category_key", "subcategory_key", "category", "store", "memo", "date") SELECT "id", "type",
	CAST(ROUND("amount") AS INTEGER),
	CASE
		WHEN "category" LIKE '% > 食費 > %' THEN 'food'
		WHEN "category" LIKE '% > 日用雑貨 > %' THEN 'daily'
		WHEN "category" LIKE '% > 交通 > %' THEN 'transport'
		WHEN "category" LIKE '% > エンタメ > %' THEN 'entertainment'
		WHEN "category" LIKE '% > その他 > %' THEN 'other'
		ELSE NULL
	END,
	CASE
		WHEN "category" LIKE '% > 食料品' THEN 'groceries'
		WHEN "category" LIKE '% > カフェ' THEN 'cafe'
		WHEN "category" LIKE '% > 朝ご飯' THEN 'breakfast'
		WHEN "category" LIKE '% > 昼ご飯' THEN 'lunch'
		WHEN "category" LIKE '% > 晩ご飯' THEN 'dinner'
		WHEN "category" LIKE '% > 消耗品' THEN 'consumables'
		WHEN "category" LIKE '% > 子ども関連' THEN 'kids'
		WHEN "category" LIKE '% > ペット関連' THEN 'pet'
		WHEN "category" LIKE '% > タバコ' THEN 'tobacco'
		WHEN "category" LIKE '% > 電車' THEN 'train'
		WHEN "category" LIKE '% > タクシー' THEN 'taxi'
		WHEN "category" LIKE '% > バス' THEN 'bus'
		WHEN "category" LIKE '% > 飛行機' THEN 'airplane'
		WHEN "category" LIKE '% > レジャー' THEN 'leisure'
		WHEN "category" LIKE '% > イベント' THEN 'event'
		WHEN "category" LIKE '% > 映画・動画' THEN 'movie'
		WHEN "category" LIKE '% > 音楽' THEN 'music'
		WHEN "category" LIKE '% > お小遣い' THEN 'allowance'
		WHEN "category" LIKE '% > 使途不明金' THEN 'unknown'
		WHEN "category" LIKE '% > 未分類' THEN 'uncategorized'
		WHEN "category" LIKE '% > その他' THEN 'other'
		ELSE NULL
	END,
	"category", "store", "memo", "date" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;