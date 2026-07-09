CREATE TABLE `recurrings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`day_of_month` integer NOT NULL,
	`amount` integer
);
