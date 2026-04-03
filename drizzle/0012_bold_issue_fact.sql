CREATE TABLE `analytics_issue_fact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`result_id` integer,
	`issue_id` integer NOT NULL,
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
	`issue_type` text DEFAULT '' NOT NULL,
	`severity` text,
	`title` text DEFAULT '' NOT NULL,
	`analytics_schema_version` integer DEFAULT 1 NOT NULL,
	`source_payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `report`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`result_id`) REFERENCES `report_image`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issue_id`) REFERENCES `report_issue`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_issue_fact_issue_unique` ON `analytics_issue_fact` (`issue_id`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_report` ON `analytics_issue_fact` (`report_id`,`published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_enterprise` ON `analytics_issue_fact` (`source_enterprise_id`,`published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_store` ON `analytics_issue_fact` (`store_id`,`published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_issue_type` ON `analytics_issue_fact` (`issue_type`,`published_date`);
