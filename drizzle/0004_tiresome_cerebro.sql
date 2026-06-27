CREATE TABLE `chat_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`identity_hash` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_usage_window_idx` ON `chat_usage` (`window_started_at`);