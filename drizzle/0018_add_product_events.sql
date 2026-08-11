CREATE TABLE `product_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`event_name` text NOT NULL,
	`path` text,
	`content_item_id` integer,
	`category` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_events_created_name_visitor_idx` ON `product_events` (`created_at`,`event_name`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `product_events_visitor_created_idx` ON `product_events` (`visitor_id`,`created_at`);