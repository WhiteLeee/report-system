CREATE TABLE `report_inspection` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`result_id` integer,
	`store_id` text,
	`store_name` text,
	`inspection_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`skill_name` text,
	`status` text,
	`raw_result` text,
	`error_message` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_report_inspection_report` ON `report_inspection` (`report_id`,`display_order`);
--> statement-breakpoint
CREATE INDEX `idx_report_inspection_result` ON `report_inspection` (`result_id`,`display_order`);
