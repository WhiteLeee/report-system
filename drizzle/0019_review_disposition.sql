ALTER TABLE `report_image` ADD `review_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `report_image` ADD `review_disposition` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `report_review_log` ADD `review_action` text DEFAULT 'transition' NOT NULL;--> statement-breakpoint
ALTER TABLE `report_review_log` ADD `review_disposition` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `analytics_review_fact` ADD `review_disposition` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_report_image_review_disposition` ON `report_image` (`review_disposition`,`reviewed_at`);--> statement-breakpoint
CREATE INDEX `idx_report_review_log_action` ON `report_review_log` (`review_action`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_report_review_log_disposition` ON `report_review_log` (`review_disposition`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_review_fact_disposition` ON `analytics_review_fact` (`review_disposition`,`review_date`);
