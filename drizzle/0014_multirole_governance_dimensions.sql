ALTER TABLE `analytics_result_fact` ADD `organization_code` text;
--> statement-breakpoint
ALTER TABLE `analytics_result_fact` ADD `franchisee_name` text;
--> statement-breakpoint
ALTER TABLE `analytics_issue_fact` ADD `organization_code` text;
--> statement-breakpoint
ALTER TABLE `analytics_issue_fact` ADD `franchisee_name` text;
--> statement-breakpoint
ALTER TABLE `analytics_review_fact` ADD `organization_code` text;
--> statement-breakpoint
ALTER TABLE `analytics_review_fact` ADD `franchisee_name` text;
--> statement-breakpoint
ALTER TABLE `analytics_rectification_fact` ADD `organization_code` text;
--> statement-breakpoint
ALTER TABLE `analytics_rectification_fact` ADD `franchisee_name` text;
--> statement-breakpoint
CREATE INDEX `idx_analytics_result_fact_org_code` ON `analytics_result_fact` (`organization_code`, `published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_result_fact_franchisee` ON `analytics_result_fact` (`franchisee_name`, `published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_org_code` ON `analytics_issue_fact` (`organization_code`, `published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_issue_fact_franchisee` ON `analytics_issue_fact` (`franchisee_name`, `published_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_review_fact_org_code` ON `analytics_review_fact` (`organization_code`, `review_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_review_fact_franchisee` ON `analytics_review_fact` (`franchisee_name`, `review_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_rectification_fact_org_code` ON `analytics_rectification_fact` (`organization_code`, `created_date`);
--> statement-breakpoint
CREATE INDEX `idx_analytics_rectification_fact_franchisee` ON `analytics_rectification_fact` (`franchisee_name`, `created_date`);
