CREATE TABLE `auth_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operator_user_id` integer,
	`operator_username` text DEFAULT '' NOT NULL,
	`target_user_id` integer,
	`target_username` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`before_json` text DEFAULT '{}' NOT NULL,
	`after_json` text DEFAULT '{}' NOT NULL,
	`request_id` text DEFAULT '' NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`operator_user_id`) REFERENCES `report_user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `report_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_auth_audit_log_action` ON `auth_audit_log` (`action`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_auth_audit_log_operator` ON `auth_audit_log` (`operator_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_auth_audit_log_target` ON `auth_audit_log` (`target_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_auth_audit_log_request` ON `auth_audit_log` (`request_id`);
