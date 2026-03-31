CREATE TABLE `system_setting` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `setting_key` text NOT NULL,
  `category` text DEFAULT 'general' NOT NULL,
  `value_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_setting_key_unique` ON `system_setting` (`setting_key`);
--> statement-breakpoint
CREATE INDEX `idx_system_setting_category` ON `system_setting` (`category`,`setting_key`);
