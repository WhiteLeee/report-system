CREATE TABLE `report_source_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`source_system` text NOT NULL,
	`payload_version` integer NOT NULL,
	`payload_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	`published_at` text NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_source_snapshot_report_unique` ON `report_source_snapshot` (`report_id`);--> statement-breakpoint
CREATE INDEX `idx_report_source_snapshot_source` ON `report_source_snapshot` (`source_system`,`published_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_report_image` (
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
	`review_state` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_note` text,
	`review_payload_json` text DEFAULT '{}' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_report_image`("id", "report_id", "store_id", "store_name", "object_key", "bucket", "region", "url", "width", "height", "captured_at", "review_state", "reviewed_by", "reviewed_at", "review_note", "review_payload_json", "metadata_json", "display_order", "created_at")
SELECT
  "id",
  "report_id",
  "store_id",
  "store_name",
  "object_key",
  "bucket",
  "region",
  "url",
  "width",
  "height",
  "captured_at",
  CASE WHEN "review_status" = 'reviewed' THEN 'completed' ELSE 'pending' END,
  NULL,
  NULL,
  NULL,
  '{}',
  "metadata_json",
  "display_order",
  "created_at"
FROM `report_image`;--> statement-breakpoint
DROP TABLE `report_image`;--> statement-breakpoint
ALTER TABLE `__new_report_image` RENAME TO `report_image`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_report_image_report` ON `report_image` (`report_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `__new_report_issue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`result_id` integer,
	`store_id` text,
	`store_name` text,
	`title` text NOT NULL,
	`category` text,
	`severity` text,
	`description` text,
	`suggestion` text,
	`image_url` text,
	`image_object_key` text,
	`review_state` text DEFAULT 'pending' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_report_issue`("id", "report_id", "result_id", "store_id", "store_name", "title", "category", "severity", "description", "suggestion", "image_url", "image_object_key", "review_state", "metadata_json", "display_order", "created_at")
SELECT
  "id",
  "report_id",
  NULL,
  "store_id",
  "store_name",
  "title",
  "category",
  "severity",
  "description",
  "suggestion",
  "image_url",
  "image_object_key",
  CASE WHEN "review_status" = 'reviewed' THEN 'completed' ELSE 'pending' END,
  "metadata_json",
  "display_order",
  "created_at"
FROM `report_issue`;--> statement-breakpoint
DROP TABLE `report_issue`;--> statement-breakpoint
ALTER TABLE `__new_report_issue` RENAME TO `report_issue`;--> statement-breakpoint
CREATE INDEX `idx_report_issue_report` ON `report_issue` (`report_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `__new_report_review_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`result_id` integer NOT NULL,
	`store_id` text,
	`store_name` text,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`operator_name` text NOT NULL,
	`note` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_report_review_log`("id", "report_id", "result_id", "store_id", "store_name", "from_status", "to_status", "operator_name", "note", "metadata_json", "created_at")
SELECT
  "id",
  "report_id",
  "image_id",
  "store_id",
  "store_name",
  CASE WHEN "from_status" = 'reviewed' THEN 'completed' ELSE 'pending' END,
  CASE WHEN "to_status" = 'reviewed' THEN 'completed' ELSE 'pending' END,
  "operator_name",
  "note",
  "metadata_json",
  "created_at"
FROM `report_review_log`;--> statement-breakpoint
DROP TABLE `report_review_log`;--> statement-breakpoint
ALTER TABLE `__new_report_review_log` RENAME TO `report_review_log`;--> statement-breakpoint
CREATE INDEX `idx_report_review_log_report` ON `report_review_log` (`report_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_report_review_log_result` ON `report_review_log` (`result_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_report_store` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`store_id` text NOT NULL,
	`store_name` text NOT NULL,
	`organization_name` text,
	`progress_state` text DEFAULT 'pending' NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`total_result_count` integer DEFAULT 0 NOT NULL,
	`completed_result_count` integer DEFAULT 0 NOT NULL,
	`pending_result_count` integer DEFAULT 0 NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`state_snapshot_json` text DEFAULT '{}' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_report_store`("id", "report_id", "store_id", "store_name", "organization_name", "progress_state", "issue_count", "image_count", "total_result_count", "completed_result_count", "pending_result_count", "progress_percent", "metadata_json", "state_snapshot_json", "display_order", "created_at")
SELECT
  "id",
  "report_id",
  "store_id",
  "store_name",
  "organization_name",
  CASE WHEN "review_status" = 'reviewed' THEN 'completed' ELSE 'pending' END,
  "issue_count",
  "image_count",
  "image_count",
  CASE WHEN "review_status" = 'reviewed' THEN "image_count" ELSE 0 END,
  CASE WHEN "review_status" = 'reviewed' THEN 0 ELSE "image_count" END,
  CASE WHEN "review_status" = 'reviewed' THEN 100 ELSE 0 END,
  "metadata_json",
  '{}',
  "display_order",
  "created_at"
FROM `report_store`;--> statement-breakpoint
DROP TABLE `report_store`;--> statement-breakpoint
ALTER TABLE `__new_report_store` RENAME TO `report_store`;--> statement-breakpoint
CREATE UNIQUE INDEX `report_store_unique` ON `report_store` (`report_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `idx_report_store_report` ON `report_store` (`report_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `__new_report` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`publish_id` text NOT NULL,
	`source_system` text NOT NULL,
	`source_enterprise_id` text NOT NULL,
	`enterprise_name` text NOT NULL,
	`report_type` text NOT NULL,
	`report_version` text NOT NULL,
	`progress_state` text DEFAULT 'pending' NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`operator_name` text NOT NULL,
	`store_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`issue_count` integer DEFAULT 0 NOT NULL,
	`completed_store_count` integer DEFAULT 0 NOT NULL,
	`pending_store_count` integer DEFAULT 0 NOT NULL,
	`in_progress_store_count` integer DEFAULT 0 NOT NULL,
	`total_result_count` integer DEFAULT 0 NOT NULL,
	`completed_result_count` integer DEFAULT 0 NOT NULL,
	`pending_result_count` integer DEFAULT 0 NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`summary_metrics_json` text NOT NULL,
	`state_snapshot_json` text DEFAULT '{}' NOT NULL,
	`extensions_json` text DEFAULT '{}' NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_report`("id", "publish_id", "source_system", "source_enterprise_id", "enterprise_name", "report_type", "report_version", "progress_state", "period_start", "period_end", "operator_name", "store_count", "image_count", "issue_count", "completed_store_count", "pending_store_count", "in_progress_store_count", "total_result_count", "completed_result_count", "pending_result_count", "progress_percent", "summary_metrics_json", "state_snapshot_json", "extensions_json", "published_at", "created_at")
SELECT
  "id",
  "publish_id",
  "source_system",
  "source_enterprise_id",
  "enterprise_name",
  "report_type",
  "report_version",
  CASE WHEN "review_status" = 'reviewed' THEN 'completed' ELSE 'pending' END,
  "period_start",
  "period_end",
  "operator_name",
  "store_count",
  "image_count",
  "issue_count",
  CASE WHEN "review_status" = 'reviewed' THEN "store_count" ELSE 0 END,
  CASE WHEN "review_status" = 'reviewed' THEN 0 ELSE "store_count" END,
  0,
  "image_count",
  CASE WHEN "review_status" = 'reviewed' THEN "image_count" ELSE 0 END,
  CASE WHEN "review_status" = 'reviewed' THEN 0 ELSE "image_count" END,
  CASE WHEN "review_status" = 'reviewed' THEN 100 ELSE 0 END,
  "summary_metrics_json",
  '{}',
  '{}',
  "published_at",
  "created_at"
FROM `report`;--> statement-breakpoint
INSERT INTO `report_source_snapshot`("report_id", "source_system", "payload_version", "payload_hash", "payload_json", "published_at", "received_at")
SELECT
  "id",
  "source_system",
  2,
  printf('legacy-%s', "id"),
  "raw_payload_json",
  "published_at",
  CURRENT_TIMESTAMP
FROM `report`;--> statement-breakpoint
DROP TABLE `report`;--> statement-breakpoint
ALTER TABLE `__new_report` RENAME TO `report`;--> statement-breakpoint
CREATE UNIQUE INDEX `report_publish_id_unique` ON `report` (`publish_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `report_version_unique` ON `report` (`source_enterprise_id`,`report_type`,`report_version`);--> statement-breakpoint
CREATE INDEX `idx_report_published_at` ON `report` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_report_enterprise` ON `report` (`source_enterprise_id`,`enterprise_name`);--> statement-breakpoint
CREATE INDEX `idx_report_progress_state` ON `report` (`progress_state`);
