CREATE TABLE `analytics_result_fact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
	`store_name` text,
	`organization_name` text,
	`published_date` text NOT NULL,
	`captured_date` text,
	`result_semantic_state` text NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`review_state` text DEFAULT 'pending' NOT NULL,
	`auto_completed` integer DEFAULT 0 NOT NULL,
	`rectification_required` integer DEFAULT 0 NOT NULL,
	`source_snapshot_version` integer DEFAULT 1 NOT NULL,
	`analytics_schema_version` integer DEFAULT 1 NOT NULL,
	`source_payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_result_fact_result_unique` ON `analytics_result_fact` (`result_id`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_result_fact_report` ON `analytics_result_fact` (`report_id`,`published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_result_fact_enterprise` ON `analytics_result_fact` (`source_enterprise_id`,`published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_result_fact_semantic` ON `analytics_result_fact` (`result_semantic_state`,`published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_result_fact_store` ON `analytics_result_fact` (`store_id`,`published_date`);
--> statement-breakpoint

CREATE TABLE `analytics_daily_overview_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_date` text NOT NULL,
	`source_enterprise_id` text NOT NULL,
	`enterprise_name` text DEFAULT '' NOT NULL,
	`report_count` integer DEFAULT 0 NOT NULL,
	`store_count` integer DEFAULT 0 NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`pending_review_count` integer DEFAULT 0 NOT NULL,
	`completed_review_count` integer DEFAULT 0 NOT NULL,
	`auto_completed_review_count` integer DEFAULT 0 NOT NULL,
	`manual_completed_review_count` integer DEFAULT 0 NOT NULL,
	`rectification_order_count` integer DEFAULT 0 NOT NULL,
	`rectification_completed_count` integer DEFAULT 0 NOT NULL,
	`rectification_pending_count` integer DEFAULT 0 NOT NULL,
	`rectification_overdue_count` integer DEFAULT 0 NOT NULL,
	`rectification_close_rate` integer DEFAULT 0 NOT NULL,
	`analytics_schema_version` integer DEFAULT 1 NOT NULL,
	`built_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_daily_overview_snapshot_unique` ON `analytics_daily_overview_snapshot` (`snapshot_date`,`source_enterprise_id`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_daily_overview_enterprise` ON `analytics_daily_overview_snapshot` (`source_enterprise_id`,`snapshot_date`);
--> statement-breakpoint

CREATE TABLE `analytics_daily_semantic_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_date` text NOT NULL,
	`source_enterprise_id` text NOT NULL,
	`enterprise_name` text DEFAULT '' NOT NULL,
	`result_semantic_state` text NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`analytics_schema_version` integer DEFAULT 1 NOT NULL,
	`built_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_daily_semantic_snapshot_unique` ON `analytics_daily_semantic_snapshot` (`snapshot_date`,`source_enterprise_id`,`result_semantic_state`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_daily_semantic_enterprise` ON `analytics_daily_semantic_snapshot` (`source_enterprise_id`,`snapshot_date`);
--> statement-breakpoint

CREATE TABLE `analytics_job_run` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_key` text NOT NULL,
	`job_type` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`scope_json` text DEFAULT '{}' NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_job_run_key_unique` ON `analytics_job_run` (`job_key`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_job_run_type` ON `analytics_job_run` (`job_type`,`started_at`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_job_run_status` ON `analytics_job_run` (`status`,`started_at`);
--> statement-breakpoint

CREATE TABLE `analytics_job_checkpoint` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_type` text NOT NULL,
	`scope_key` text DEFAULT 'global' NOT NULL,
	`checkpoint_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_job_checkpoint_unique` ON `analytics_job_checkpoint` (`job_type`,`scope_key`);
