CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`pending_count` integer DEFAULT 0 NOT NULL,
	`created_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`deferred_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`min_interval_ms` integer DEFAULT 0 NOT NULL,
	`max_items` integer DEFAULT 0 NOT NULL,
	`created_items` text NOT NULL,
	`skipped_items` text NOT NULL,
	`deferred_items` text NOT NULL,
	`failed_items` text NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ingestion_runs_started_at_idx` ON `ingestion_runs` (`started_at`);--> statement-breakpoint
CREATE INDEX `ingestion_runs_status_started_idx` ON `ingestion_runs` (`status`,`started_at`);