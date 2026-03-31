CREATE TABLE `report_rectification_order` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`result_id` integer NOT NULL,
	`source_review_log_id` integer,
	`store_id` text,
	`store_code` text,
	`store_name` text,
	`huiyunying_order_id` text,
	`request_description` text DEFAULT '' NOT NULL,
	`selected_issues_json` text DEFAULT '[]' NOT NULL,
	`image_urls_json` text DEFAULT '[]' NOT NULL,
	`request_payload_json` text DEFAULT '{}' NOT NULL,
	`response_payload_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`if_corrected` text,
	`should_corrected` text,
	`real_corrected_time` text,
	`last_synced_at` text,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_review_log_id`) REFERENCES `report_review_log`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_report_rectification_order_result` ON `report_rectification_order` (`result_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_report_rectification_order_report` ON `report_rectification_order` (`report_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_report_rectification_order_hyy` ON `report_rectification_order` (`huiyunying_order_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_report_rectification_order_status` ON `report_rectification_order` (`status`,`updated_at`);
