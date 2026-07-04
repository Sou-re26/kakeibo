CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text,
	`store` text,
	`memo` text,
	`date` integer NOT NULL
);
