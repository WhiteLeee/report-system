CREATE TABLE `report_review_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`image_id` integer NOT NULL,
	`store_id` text,
	`store_name` text,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`operator_name` text NOT NULL,
	`note` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_report_review_log_report` ON `report_review_log` (`report_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_report_review_log_image` ON `report_review_log` (`image_id`,`created_at`,`id`);