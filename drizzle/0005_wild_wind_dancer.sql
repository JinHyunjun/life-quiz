CREATE INDEX `content_items_created_at_idx` ON `content_items` (`created_at`);--> statement-breakpoint
CREATE INDEX `content_items_category_created_idx` ON `content_items` (`category`,`created_at`);