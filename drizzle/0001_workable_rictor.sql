ALTER TABLE `review_logs` ADD `rating` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_logs` ADD `state` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_logs` ADD `elapsed_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_logs` ADD `scheduled_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_logs` ADD `learning_steps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_logs` ADD `reps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_logs` ADD `lapses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `review_logs_user_quiz_idx` ON `review_logs` (`user_id`,`quiz_item_id`);--> statement-breakpoint
CREATE INDEX `review_logs_user_due_idx` ON `review_logs` (`user_id`,`due`);