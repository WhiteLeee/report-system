CREATE TABLE `report_user_scope` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`scope_type` text NOT NULL,
	`scope_value` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `report_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_user_scope_unique` ON `report_user_scope` (`user_id`,`scope_type`,`scope_value`);--> statement-breakpoint
CREATE INDEX `idx_report_user_scope_user_type` ON `report_user_scope` (`user_id`,`scope_type`);