CREATE TABLE `content_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_item_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_feedback_user_content_kind_unique` ON `content_feedback` (`user_id`,`content_item_id`,`kind`);--> statement-breakpoint
CREATE INDEX `content_feedback_status_created_idx` ON `content_feedback` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `content_feedback_content_kind_idx` ON `content_feedback` (`content_item_id`,`kind`);--> statement-breakpoint
CREATE TABLE `daily_session_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`kst_date` text NOT NULL,
	`quiz_item_id` integer NOT NULL,
	`position` integer NOT NULL,
	`item_type` text NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quiz_item_id`) REFERENCES `quiz_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_session_items_user_date_position_unique` ON `daily_session_items` (`user_id`,`kst_date`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_session_items_user_date_quiz_unique` ON `daily_session_items` (`user_id`,`kst_date`,`quiz_item_id`);--> statement-breakpoint
CREATE INDEX `daily_session_items_user_date_idx` ON `daily_session_items` (`user_id`,`kst_date`);
