CREATE TABLE `auth_login_guard` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`last_failed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_login_guard_username_unique` ON `auth_login_guard` (`username`);
--> statement-breakpoint
CREATE INDEX `idx_auth_login_guard_locked_until` ON `auth_login_guard` (`locked_until`,`updated_at`);
