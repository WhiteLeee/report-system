CREATE TABLE `report_menu` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_menu_code_unique` ON `report_menu` (`code`);
--> statement-breakpoint
CREATE INDEX `idx_report_menu_visible` ON `report_menu` (`visible`,`sort_order`);
--> statement-breakpoint

CREATE TABLE `report_role_menu` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer NOT NULL,
	`menu_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `report_role`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_id`) REFERENCES `report_menu`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_role_menu_unique` ON `report_role_menu` (`role_id`,`menu_id`);
--> statement-breakpoint
CREATE INDEX `idx_report_role_menu_menu` ON `report_role_menu` (`menu_id`);
