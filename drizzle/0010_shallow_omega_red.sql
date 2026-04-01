CREATE TABLE `report_rectification_sync_batch` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_batch_id` text NOT NULL,
	`trigger_source` text DEFAULT 'scheduler' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`scanned_count` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`not_found_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`average_response_time_ms` integer,
	`max_response_time_ms` integer,
	`config_json` text DEFAULT '{}' NOT NULL,
	`summary_json` text DEFAULT '{}' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_rectification_sync_batch_unique` ON `report_rectification_sync_batch` (`sync_batch_id`);--> statement-breakpoint
CREATE INDEX `idx_report_rectification_sync_batch_started` ON `report_rectification_sync_batch` (`started_at`);--> statement-breakpoint
CREATE INDEX `idx_report_rectification_sync_batch_status` ON `report_rectification_sync_batch` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `report_rectification_sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_batch_id` text NOT NULL,
	`order_id` integer NOT NULL,
	`huiyunying_order_id` text,
	`status` text NOT NULL,
	`error_type` text,
	`error_message` text DEFAULT '' NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`response_time_ms` integer,
	`remote_status` text,
	`remote_if_corrected` text,
	`request_payload_json` text DEFAULT '{}' NOT NULL,
	`response_payload_json` text DEFAULT '{}' NOT NULL,
	`synced_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `report_rectification_order`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_report_rectification_sync_log_batch` ON `report_rectification_sync_log` (`sync_batch_id`,`synced_at`);--> statement-breakpoint
CREATE INDEX `idx_report_rectification_sync_log_order` ON `report_rectification_sync_log` (`order_id`,`synced_at`);--> statement-breakpoint
CREATE INDEX `idx_report_rectification_sync_log_status` ON `report_rectification_sync_log` (`status`,`synced_at`);--> statement-breakpoint
ALTER TABLE `report_rectification_order` ADD `rectification_reply_content` text;