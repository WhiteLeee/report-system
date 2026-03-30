CREATE TABLE `organization_master` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enterprise_id` text NOT NULL,
	`enterprise_name` text DEFAULT '' NOT NULL,
	`organize_code` text NOT NULL,
	`organize_name` text NOT NULL,
	`parent_code` text DEFAULT '' NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`snapshot_version` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_master_enterprise_code_unique` ON `organization_master` (`enterprise_id`,`organize_code`);
--> statement-breakpoint
CREATE INDEX `idx_organization_master_enterprise_parent` ON `organization_master` (`enterprise_id`,`parent_code`,`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_organization_master_enterprise_active` ON `organization_master` (`enterprise_id`,`is_active`,`organize_name`);
--> statement-breakpoint

CREATE TABLE `store_master_profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enterprise_id` text NOT NULL,
	`enterprise_name` text DEFAULT '' NOT NULL,
	`store_id` text NOT NULL,
	`store_code` text DEFAULT '' NOT NULL,
	`store_name` text NOT NULL,
	`organize_code` text DEFAULT '' NOT NULL,
	`organize_name` text DEFAULT '' NOT NULL,
	`store_type` text DEFAULT '' NOT NULL,
	`franchisee_name` text DEFAULT '' NOT NULL,
	`supervisor` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`snapshot_version` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_master_profile_enterprise_store_unique` ON `store_master_profile` (`enterprise_id`,`store_id`);
--> statement-breakpoint
CREATE INDEX `idx_store_master_profile_enterprise_code` ON `store_master_profile` (`enterprise_id`,`store_code`);
--> statement-breakpoint
CREATE INDEX `idx_store_master_profile_enterprise_org` ON `store_master_profile` (`enterprise_id`,`organize_code`,`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_store_master_profile_enterprise_status` ON `store_master_profile` (`enterprise_id`,`status`,`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_store_master_profile_enterprise_name` ON `store_master_profile` (`enterprise_id`,`store_name`);
--> statement-breakpoint

CREATE TABLE `master_data_sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_batch_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`source_system` text NOT NULL,
	`enterprise_id` text NOT NULL,
	`enterprise_name` text DEFAULT '' NOT NULL,
	`data_type` text NOT NULL,
	`snapshot_version` text DEFAULT '' NOT NULL,
	`snapshot_mode` text DEFAULT 'full_replace' NOT NULL,
	`organize_count` integer DEFAULT 0 NOT NULL,
	`store_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`request_payload_json` text DEFAULT '{}' NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `master_data_sync_log_sync_batch_unique` ON `master_data_sync_log` (`sync_batch_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `master_data_sync_log_idempotency_unique` ON `master_data_sync_log` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_master_data_sync_log_enterprise` ON `master_data_sync_log` (`enterprise_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_master_data_sync_log_status` ON `master_data_sync_log` (`status`,`created_at`);
