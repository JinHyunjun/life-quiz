CREATE TABLE `gemini_request_log` (
	`request_id` text PRIMARY KEY NOT NULL,
	`requested_at_ms` integer NOT NULL,
	`purpose` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gemini_request_log_requested_at_idx` ON `gemini_request_log` (`requested_at_ms`);