ALTER TABLE `analytics_issue_fact` ADD `skill_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `analytics_issue_fact` ADD `skill_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_skill` ON `analytics_issue_fact` (`skill_id`,`published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_severity` ON `analytics_issue_fact` (`severity`,`published_date`);
