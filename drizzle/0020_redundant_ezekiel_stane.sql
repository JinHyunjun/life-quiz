CREATE TABLE `support_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`requester_hash` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `support_requests_status_created_idx` ON `support_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_requests_requester_created_idx` ON `support_requests` (`requester_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_requests_email_created_idx` ON `support_requests` (`email`,`created_at`);