CREATE TABLE `report_image` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`store_id` text,
	`store_name` text,
	`object_key` text,
	`bucket` text,
	`region` text,
	`url` text NOT NULL,
	`width` integer,
	`height` integer,
	`captured_at` text,
	`review_status` text DEFAULT 'pending_review' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_report_image_report` ON `report_image` (`report_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `report_issue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`store_id` text,
	`store_name` text,
	`title` text NOT NULL,
	`category` text,
	`severity` text,
	`description` text,
	`suggestion` text,
	`image_url` text,
	`image_object_key` text,
	`review_status` text DEFAULT 'pending_review' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_report_issue_report` ON `report_issue` (`report_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `report_store` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`store_id` text NOT NULL,
	`store_name` text NOT NULL,
	`organization_name` text,
	`review_status` text DEFAULT 'pending_review' NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_store_unique` ON `report_store` (`report_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `idx_report_store_report` ON `report_store` (`report_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `report` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`publish_id` text NOT NULL,
	`source_system` text NOT NULL,
	`source_enterprise_id` text NOT NULL,
	`enterprise_name` text NOT NULL,
	`report_type` text NOT NULL,
	`report_version` text NOT NULL,
	`review_status` text DEFAULT 'pending_review' NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`operator_name` text NOT NULL,
	`store_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`summary_metrics_json` text NOT NULL,
	`raw_payload_json` text NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_publish_id_unique` ON `report` (`publish_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `report_version_unique` ON `report` (`source_enterprise_id`,`report_type`,`report_version`);--> statement-breakpoint
CREATE INDEX `idx_report_published_at` ON `report` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_report_enterprise` ON `report` (`source_enterprise_id`,`enterprise_name`);--> statement-breakpoint
CREATE INDEX `idx_report_review_status` ON `report` (`review_status`);