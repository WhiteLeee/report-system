CREATE TABLE `analytics_review_fact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`result_id` integer NOT NULL,
	`review_log_id` integer NOT NULL,
	`source_enterprise_id` text NOT NULL,
	`enterprise_name` text DEFAULT '' NOT NULL,
	`report_type` text DEFAULT '' NOT NULL,
	`report_topic` text DEFAULT '' NOT NULL,
	`plan_id` text DEFAULT '' NOT NULL,
	`plan_name` text DEFAULT '' NOT NULL,
	`report_version` text DEFAULT '' NOT NULL,
	`store_id` text,
	`store_name` text,
	`organization_name` text,
	`published_date` text NOT NULL,
	`review_date` text NOT NULL,
	`from_status` text DEFAULT '' NOT NULL,
	`to_status` text DEFAULT '' NOT NULL,
	`operator_name` text DEFAULT '' NOT NULL,
	`review_action` text DEFAULT 'transition' NOT NULL,
	`review_latency_minutes` integer DEFAULT 0 NOT NULL,
	`note_length` integer DEFAULT 0 NOT NULL,
	`analytics_schema_version` integer DEFAULT 1 NOT NULL,
	`source_payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`review_log_id`) REFERENCES `report_review_log`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_review_fact_review_log_unique` ON `analytics_review_fact` (`review_log_id`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_review_fact_report` ON `analytics_review_fact` (`report_id`,`review_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_review_fact_enterprise` ON `analytics_review_fact` (`source_enterprise_id`,`review_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_review_fact_store` ON `analytics_review_fact` (`store_id`,`review_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_review_fact_action` ON `analytics_review_fact` (`review_action`,`review_date`);
--> statement-breakpoint
CREATE TABLE `analytics_rectification_fact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`report_id` integer NOT NULL,
	`result_id` integer NOT NULL,
	`source_enterprise_id` text NOT NULL,
	`enterprise_name` text DEFAULT '' NOT NULL,
	`report_type` text DEFAULT '' NOT NULL,
	`report_topic` text DEFAULT '' NOT NULL,
	`plan_id` text DEFAULT '' NOT NULL,
	`plan_name` text DEFAULT '' NOT NULL,
	`report_version` text DEFAULT '' NOT NULL,
	`store_id` text,
	`store_code` text,
	`store_name` text,
	`organization_name` text,
	`published_date` text NOT NULL,
	`created_date` text NOT NULL,
	`should_corrected_date` text,
	`completed_date` text,
	`local_status` text DEFAULT '' NOT NULL,
	`remote_if_corrected` text,
	`sync_failed` integer DEFAULT 0 NOT NULL,
	`overdue` integer DEFAULT 0 NOT NULL,
	`analytics_schema_version` integer DEFAULT 1 NOT NULL,
	`source_payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `report_rectification_order`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_rectification_fact_order_unique` ON `analytics_rectification_fact` (`order_id`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_rectification_fact_report` ON `analytics_rectification_fact` (`report_id`,`created_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_rectification_fact_enterprise` ON `analytics_rectification_fact` (`source_enterprise_id`,`created_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_rectification_fact_store` ON `analytics_rectification_fact` (`store_id`,`created_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_rectification_fact_overdue` ON `analytics_rectification_fact` (`overdue`,`should_corrected_date`);
