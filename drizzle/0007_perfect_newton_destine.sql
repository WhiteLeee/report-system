ALTER TABLE `organization_master`
ADD `raw_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `store_master_profile`
ADD `raw_json` text DEFAULT '{}' NOT NULL;
