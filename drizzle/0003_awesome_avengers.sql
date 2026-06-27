PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_content_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer,
	`title` text NOT NULL,
	`body_md` text NOT NULL,
	`cards` text,
	`category` text NOT NULL,
	`citation_url` text,
	`citation_label` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_content_items`("id", "source_id", "title", "body_md", "cards", "category", "citation_url", "citation_label", "created_at") SELECT "id", "source_id", "title", "body_md", "cards", "category", "citation_url", "citation_label", "created_at" FROM `content_items`;--> statement-breakpoint
DROP TABLE `content_items`;--> statement-breakpoint
ALTER TABLE `__new_content_items` RENAME TO `content_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;