CREATE TABLE "analytics_daily_overview_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" text NOT NULL,
	"source_enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"store_count" integer DEFAULT 0 NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"pending_review_count" integer DEFAULT 0 NOT NULL,
	"completed_review_count" integer DEFAULT 0 NOT NULL,
	"auto_completed_review_count" integer DEFAULT 0 NOT NULL,
	"manual_completed_review_count" integer DEFAULT 0 NOT NULL,
	"rectification_order_count" integer DEFAULT 0 NOT NULL,
	"rectification_completed_count" integer DEFAULT 0 NOT NULL,
	"rectification_pending_count" integer DEFAULT 0 NOT NULL,
	"rectification_overdue_count" integer DEFAULT 0 NOT NULL,
	"rectification_close_rate" integer DEFAULT 0 NOT NULL,
	"analytics_schema_version" integer DEFAULT 1 NOT NULL,
	"built_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_semantic_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" text NOT NULL,
	"source_enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"result_semantic_state" text NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"analytics_schema_version" integer DEFAULT 1 NOT NULL,
	"built_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_issue_fact" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer,
	"issue_id" integer NOT NULL,
	"source_enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"report_type" text DEFAULT '' NOT NULL,
	"report_topic" text DEFAULT '' NOT NULL,
	"plan_id" text DEFAULT '' NOT NULL,
	"plan_name" text DEFAULT '' NOT NULL,
	"report_version" text DEFAULT '' NOT NULL,
	"store_id" text,
	"store_name" text,
	"organization_code" text,
	"organization_name" text,
	"franchisee_name" text,
	"published_date" text NOT NULL,
	"skill_id" text DEFAULT '' NOT NULL,
	"skill_name" text DEFAULT '' NOT NULL,
	"issue_type" text DEFAULT '' NOT NULL,
	"severity" text,
	"title" text DEFAULT '' NOT NULL,
	"analytics_schema_version" integer DEFAULT 1 NOT NULL,
	"source_payload_json" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_job_checkpoint" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"scope_key" text DEFAULT 'global' NOT NULL,
	"checkpoint_json" text DEFAULT '{}' NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_job_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"scope_json" text DEFAULT '{}' NOT NULL,
	"metrics_json" text DEFAULT '{}' NOT NULL,
	"error_message" text DEFAULT '' NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_rectification_fact" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer NOT NULL,
	"source_enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"report_type" text DEFAULT '' NOT NULL,
	"report_topic" text DEFAULT '' NOT NULL,
	"plan_id" text DEFAULT '' NOT NULL,
	"plan_name" text DEFAULT '' NOT NULL,
	"report_version" text DEFAULT '' NOT NULL,
	"store_id" text,
	"store_code" text,
	"store_name" text,
	"organization_code" text,
	"organization_name" text,
	"franchisee_name" text,
	"published_date" text NOT NULL,
	"created_date" text NOT NULL,
	"should_corrected_date" text,
	"completed_date" text,
	"local_status" text DEFAULT '' NOT NULL,
	"remote_if_corrected" text,
	"sync_failed" integer DEFAULT 0 NOT NULL,
	"overdue" integer DEFAULT 0 NOT NULL,
	"analytics_schema_version" integer DEFAULT 1 NOT NULL,
	"source_payload_json" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_result_fact" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer NOT NULL,
	"source_enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"report_type" text DEFAULT '' NOT NULL,
	"report_topic" text DEFAULT '' NOT NULL,
	"plan_id" text DEFAULT '' NOT NULL,
	"plan_name" text DEFAULT '' NOT NULL,
	"report_version" text DEFAULT '' NOT NULL,
	"store_id" text,
	"store_name" text,
	"organization_code" text,
	"organization_name" text,
	"franchisee_name" text,
	"published_date" text NOT NULL,
	"captured_date" text,
	"result_semantic_state" text NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"review_state" text DEFAULT 'pending' NOT NULL,
	"auto_completed" integer DEFAULT 0 NOT NULL,
	"rectification_required" integer DEFAULT 0 NOT NULL,
	"source_snapshot_version" integer DEFAULT 1 NOT NULL,
	"analytics_schema_version" integer DEFAULT 1 NOT NULL,
	"source_payload_json" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_review_fact" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer NOT NULL,
	"review_log_id" integer NOT NULL,
	"source_enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"report_type" text DEFAULT '' NOT NULL,
	"report_topic" text DEFAULT '' NOT NULL,
	"plan_id" text DEFAULT '' NOT NULL,
	"plan_name" text DEFAULT '' NOT NULL,
	"report_version" text DEFAULT '' NOT NULL,
	"store_id" text,
	"store_name" text,
	"organization_code" text,
	"organization_name" text,
	"franchisee_name" text,
	"published_date" text NOT NULL,
	"review_date" text NOT NULL,
	"from_status" text DEFAULT '' NOT NULL,
	"to_status" text DEFAULT '' NOT NULL,
	"operator_name" text DEFAULT '' NOT NULL,
	"review_action" text DEFAULT 'transition' NOT NULL,
	"review_disposition" text DEFAULT '' NOT NULL,
	"review_latency_minutes" integer DEFAULT 0 NOT NULL,
	"note_length" integer DEFAULT 0 NOT NULL,
	"analytics_schema_version" integer DEFAULT 1 NOT NULL,
	"source_payload_json" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"operator_user_id" integer,
	"operator_username" text DEFAULT '' NOT NULL,
	"target_user_id" integer,
	"target_username" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"before_json" text DEFAULT '{}' NOT NULL,
	"after_json" text DEFAULT '{}' NOT NULL,
	"request_id" text DEFAULT '' NOT NULL,
	"ip_address" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_login_guard" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	"last_failed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_data_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_batch_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"source_system" text NOT NULL,
	"enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"data_type" text NOT NULL,
	"snapshot_version" text DEFAULT '' NOT NULL,
	"snapshot_mode" text DEFAULT 'full_replace' NOT NULL,
	"organize_count" integer DEFAULT 0 NOT NULL,
	"store_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"request_payload_json" text DEFAULT '{}' NOT NULL,
	"error_message" text DEFAULT '' NOT NULL,
	"published_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"organize_code" text NOT NULL,
	"organize_name" text NOT NULL,
	"parent_code" text DEFAULT '' NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"raw_json" text DEFAULT '{}' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"snapshot_version" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_image" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"store_id" text,
	"store_name" text,
	"object_key" text,
	"bucket" text,
	"region" text,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"captured_at" text,
	"review_state" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" text,
	"review_note" text,
	"review_action" text DEFAULT '' NOT NULL,
	"review_disposition" text DEFAULT '' NOT NULL,
	"review_payload_json" text DEFAULT '{}' NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_inspection" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer,
	"store_id" text,
	"store_name" text,
	"inspection_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"skill_name" text,
	"status" text,
	"raw_result" text,
	"error_message" text,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_issue" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer,
	"store_id" text,
	"store_name" text,
	"title" text NOT NULL,
	"category" text,
	"severity" text,
	"description" text,
	"suggestion" text,
	"image_url" text,
	"image_object_key" text,
	"review_state" text DEFAULT 'pending' NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_menu" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" integer DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_rectification_order" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer NOT NULL,
	"source_review_log_id" integer,
	"store_id" text,
	"store_code" text,
	"store_name" text,
	"huiyunying_order_id" text,
	"request_description" text DEFAULT '' NOT NULL,
	"selected_issues_json" text DEFAULT '[]' NOT NULL,
	"image_urls_json" text DEFAULT '[]' NOT NULL,
	"request_payload_json" text DEFAULT '{}' NOT NULL,
	"response_payload_json" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"if_corrected" text,
	"should_corrected" text,
	"real_corrected_time" text,
	"rectification_reply_content" text,
	"last_synced_at" text,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_rectification_sync_batch" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_batch_id" text NOT NULL,
	"trigger_source" text DEFAULT 'scheduler' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"scanned_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"not_found_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"average_response_time_ms" integer,
	"max_response_time_ms" integer,
	"config_json" text DEFAULT '{}' NOT NULL,
	"summary_json" text DEFAULT '{}' NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_rectification_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_batch_id" text NOT NULL,
	"order_id" integer NOT NULL,
	"huiyunying_order_id" text,
	"status" text NOT NULL,
	"error_type" text,
	"error_message" text DEFAULT '' NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"response_time_ms" integer,
	"remote_status" text,
	"remote_if_corrected" text,
	"request_payload_json" text DEFAULT '{}' NOT NULL,
	"response_payload_json" text DEFAULT '{}' NOT NULL,
	"synced_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_review_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"result_id" integer NOT NULL,
	"store_id" text,
	"store_name" text,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"operator_name" text NOT NULL,
	"note" text,
	"review_action" text DEFAULT 'transition' NOT NULL,
	"review_disposition" text DEFAULT '' NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_role_menu" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"menu_id" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_role_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_role" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_seen_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_source_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"source_system" text NOT NULL,
	"payload_version" integer NOT NULL,
	"payload_hash" text NOT NULL,
	"payload_json" text NOT NULL,
	"published_at" text NOT NULL,
	"received_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_store" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"store_id" text NOT NULL,
	"store_name" text NOT NULL,
	"organization_name" text,
	"progress_state" text DEFAULT 'pending' NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"total_result_count" integer DEFAULT 0 NOT NULL,
	"completed_result_count" integer DEFAULT 0 NOT NULL,
	"pending_result_count" integer DEFAULT 0 NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"state_snapshot_json" text DEFAULT '{}' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" serial PRIMARY KEY NOT NULL,
	"publish_id" text NOT NULL,
	"source_system" text NOT NULL,
	"source_enterprise_id" text NOT NULL,
	"enterprise_name" text NOT NULL,
	"report_type" text NOT NULL,
	"report_version" text NOT NULL,
	"progress_state" text DEFAULT 'pending' NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"operator_name" text NOT NULL,
	"store_count" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"completed_store_count" integer DEFAULT 0 NOT NULL,
	"pending_store_count" integer DEFAULT 0 NOT NULL,
	"in_progress_store_count" integer DEFAULT 0 NOT NULL,
	"total_result_count" integer DEFAULT 0 NOT NULL,
	"completed_result_count" integer DEFAULT 0 NOT NULL,
	"pending_result_count" integer DEFAULT 0 NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"summary_metrics_json" text NOT NULL,
	"state_snapshot_json" text DEFAULT '{}' NOT NULL,
	"extensions_json" text DEFAULT '{}' NOT NULL,
	"published_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_user_role" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_user_scope" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"scope_type" text NOT NULL,
	"scope_value" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_master_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"enterprise_id" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"store_id" text NOT NULL,
	"store_code" text DEFAULT '' NOT NULL,
	"store_name" text NOT NULL,
	"organize_code" text DEFAULT '' NOT NULL,
	"organize_name" text DEFAULT '' NOT NULL,
	"store_type" text DEFAULT '' NOT NULL,
	"franchisee_name" text DEFAULT '' NOT NULL,
	"supervisor" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"raw_json" text DEFAULT '{}' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"snapshot_version" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"value_json" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_issue_fact" ADD CONSTRAINT "analytics_issue_fact_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_issue_fact" ADD CONSTRAINT "analytics_issue_fact_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_issue_fact" ADD CONSTRAINT "analytics_issue_fact_issue_id_report_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."report_issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rectification_fact" ADD CONSTRAINT "analytics_rectification_fact_order_id_report_rectification_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."report_rectification_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rectification_fact" ADD CONSTRAINT "analytics_rectification_fact_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rectification_fact" ADD CONSTRAINT "analytics_rectification_fact_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_result_fact" ADD CONSTRAINT "analytics_result_fact_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_result_fact" ADD CONSTRAINT "analytics_result_fact_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_review_fact" ADD CONSTRAINT "analytics_review_fact_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_review_fact" ADD CONSTRAINT "analytics_review_fact_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_review_fact" ADD CONSTRAINT "analytics_review_fact_review_log_id_report_review_log_id_fk" FOREIGN KEY ("review_log_id") REFERENCES "public"."report_review_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_operator_user_id_report_user_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "public"."report_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_target_user_id_report_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."report_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_image" ADD CONSTRAINT "report_image_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_inspection" ADD CONSTRAINT "report_inspection_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_inspection" ADD CONSTRAINT "report_inspection_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_issue" ADD CONSTRAINT "report_issue_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_issue" ADD CONSTRAINT "report_issue_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_rectification_order" ADD CONSTRAINT "report_rectification_order_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_rectification_order" ADD CONSTRAINT "report_rectification_order_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_rectification_order" ADD CONSTRAINT "report_rectification_order_source_review_log_id_report_review_log_id_fk" FOREIGN KEY ("source_review_log_id") REFERENCES "public"."report_review_log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_rectification_sync_log" ADD CONSTRAINT "report_rectification_sync_log_order_id_report_rectification_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."report_rectification_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_review_log" ADD CONSTRAINT "report_review_log_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_review_log" ADD CONSTRAINT "report_review_log_result_id_report_image_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."report_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_role_menu" ADD CONSTRAINT "report_role_menu_role_id_report_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."report_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_role_menu" ADD CONSTRAINT "report_role_menu_menu_id_report_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."report_menu"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_role_permission" ADD CONSTRAINT "report_role_permission_role_id_report_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."report_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_role_permission" ADD CONSTRAINT "report_role_permission_permission_id_report_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."report_permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_session" ADD CONSTRAINT "report_session_user_id_report_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."report_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_source_snapshot" ADD CONSTRAINT "report_source_snapshot_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_store" ADD CONSTRAINT "report_store_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_user_role" ADD CONSTRAINT "report_user_role_user_id_report_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."report_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_user_role" ADD CONSTRAINT "report_user_role_role_id_report_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."report_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_user_scope" ADD CONSTRAINT "report_user_scope_user_id_report_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."report_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_overview_snapshot_unique" ON "analytics_daily_overview_snapshot" USING btree ("snapshot_date","source_enterprise_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_daily_overview_enterprise" ON "analytics_daily_overview_snapshot" USING btree ("source_enterprise_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_semantic_snapshot_unique" ON "analytics_daily_semantic_snapshot" USING btree ("snapshot_date","source_enterprise_id","result_semantic_state");--> statement-breakpoint
CREATE INDEX "idx_analytics_daily_semantic_enterprise" ON "analytics_daily_semantic_snapshot" USING btree ("source_enterprise_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_issue_fact_issue_unique" ON "analytics_issue_fact" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_issue_fact_report" ON "analytics_issue_fact" USING btree ("report_id","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_issue_fact_enterprise" ON "analytics_issue_fact" USING btree ("source_enterprise_id","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_issue_fact_store" ON "analytics_issue_fact" USING btree ("store_id","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_issue_fact_issue_type" ON "analytics_issue_fact" USING btree ("issue_type","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_issue_fact_skill" ON "analytics_issue_fact" USING btree ("skill_id","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_issue_fact_severity" ON "analytics_issue_fact" USING btree ("severity","published_date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_job_checkpoint_unique" ON "analytics_job_checkpoint" USING btree ("job_type","scope_key");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_job_run_key_unique" ON "analytics_job_run" USING btree ("job_key");--> statement-breakpoint
CREATE INDEX "idx_analytics_job_run_type" ON "analytics_job_run" USING btree ("job_type","started_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_job_run_status" ON "analytics_job_run" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_rectification_fact_order_unique" ON "analytics_rectification_fact" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_rectification_fact_report" ON "analytics_rectification_fact" USING btree ("report_id","created_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_rectification_fact_enterprise" ON "analytics_rectification_fact" USING btree ("source_enterprise_id","created_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_rectification_fact_store" ON "analytics_rectification_fact" USING btree ("store_id","created_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_rectification_fact_overdue" ON "analytics_rectification_fact" USING btree ("overdue","should_corrected_date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_result_fact_result_unique" ON "analytics_result_fact" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_result_fact_report" ON "analytics_result_fact" USING btree ("report_id","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_result_fact_enterprise" ON "analytics_result_fact" USING btree ("source_enterprise_id","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_result_fact_semantic" ON "analytics_result_fact" USING btree ("result_semantic_state","published_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_result_fact_store" ON "analytics_result_fact" USING btree ("store_id","published_date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_review_fact_review_log_unique" ON "analytics_review_fact" USING btree ("review_log_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_review_fact_report" ON "analytics_review_fact" USING btree ("report_id","review_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_review_fact_enterprise" ON "analytics_review_fact" USING btree ("source_enterprise_id","review_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_review_fact_store" ON "analytics_review_fact" USING btree ("store_id","review_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_review_fact_action" ON "analytics_review_fact" USING btree ("review_action","review_date");--> statement-breakpoint
CREATE INDEX "idx_analytics_review_fact_disposition" ON "analytics_review_fact" USING btree ("review_disposition","review_date");--> statement-breakpoint
CREATE INDEX "idx_auth_audit_log_action" ON "auth_audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_audit_log_operator" ON "auth_audit_log" USING btree ("operator_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_audit_log_target" ON "auth_audit_log" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_audit_log_request" ON "auth_audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_login_guard_username_unique" ON "auth_login_guard" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_auth_login_guard_locked_until" ON "auth_login_guard" USING btree ("locked_until","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "master_data_sync_log_sync_batch_unique" ON "master_data_sync_log" USING btree ("sync_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "master_data_sync_log_idempotency_unique" ON "master_data_sync_log" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_master_data_sync_log_enterprise" ON "master_data_sync_log" USING btree ("enterprise_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_master_data_sync_log_status" ON "master_data_sync_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_master_enterprise_code_unique" ON "organization_master" USING btree ("enterprise_id","organize_code");--> statement-breakpoint
CREATE INDEX "idx_organization_master_enterprise_parent" ON "organization_master" USING btree ("enterprise_id","parent_code","is_active");--> statement-breakpoint
CREATE INDEX "idx_organization_master_enterprise_active" ON "organization_master" USING btree ("enterprise_id","is_active","organize_name");--> statement-breakpoint
CREATE INDEX "idx_report_image_report" ON "report_image" USING btree ("report_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_report_image_review_disposition" ON "report_image" USING btree ("review_disposition","reviewed_at");--> statement-breakpoint
CREATE INDEX "idx_report_inspection_report" ON "report_inspection" USING btree ("report_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_report_inspection_result" ON "report_inspection" USING btree ("result_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_report_issue_report" ON "report_issue" USING btree ("report_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "report_menu_code_unique" ON "report_menu" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_report_menu_visible" ON "report_menu" USING btree ("visible","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "report_permission_code_unique" ON "report_permission" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_order_result" ON "report_rectification_order" USING btree ("result_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_order_report" ON "report_rectification_order" USING btree ("report_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_order_hyy" ON "report_rectification_order" USING btree ("huiyunying_order_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_order_status" ON "report_rectification_order" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_rectification_sync_batch_unique" ON "report_rectification_sync_batch" USING btree ("sync_batch_id");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_sync_batch_started" ON "report_rectification_sync_batch" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_sync_batch_status" ON "report_rectification_sync_batch" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_sync_log_batch" ON "report_rectification_sync_log" USING btree ("sync_batch_id","synced_at");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_sync_log_order" ON "report_rectification_sync_log" USING btree ("order_id","synced_at");--> statement-breakpoint
CREATE INDEX "idx_report_rectification_sync_log_status" ON "report_rectification_sync_log" USING btree ("status","synced_at");--> statement-breakpoint
CREATE INDEX "idx_report_review_log_report" ON "report_review_log" USING btree ("report_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_report_review_log_result" ON "report_review_log" USING btree ("result_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_report_review_log_action" ON "report_review_log" USING btree ("review_action","created_at");--> statement-breakpoint
CREATE INDEX "idx_report_review_log_disposition" ON "report_review_log" USING btree ("review_disposition","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_role_menu_unique" ON "report_role_menu" USING btree ("role_id","menu_id");--> statement-breakpoint
CREATE INDEX "idx_report_role_menu_menu" ON "report_role_menu" USING btree ("menu_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_role_permission_unique" ON "report_role_permission" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "idx_report_role_permission_permission" ON "report_role_permission" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_role_code_unique" ON "report_role" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "report_session_token_hash_unique" ON "report_session" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "idx_report_session_user" ON "report_session" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_source_snapshot_report_unique" ON "report_source_snapshot" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_report_source_snapshot_source" ON "report_source_snapshot" USING btree ("source_system","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_store_unique" ON "report_store" USING btree ("report_id","store_id");--> statement-breakpoint
CREATE INDEX "idx_report_store_report" ON "report_store" USING btree ("report_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "report_publish_id_unique" ON "report" USING btree ("publish_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_version_unique" ON "report" USING btree ("source_enterprise_id","report_type","report_version");--> statement-breakpoint
CREATE INDEX "idx_report_published_at" ON "report" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_report_enterprise" ON "report" USING btree ("source_enterprise_id","enterprise_name");--> statement-breakpoint
CREATE INDEX "idx_report_progress_state" ON "report" USING btree ("progress_state");--> statement-breakpoint
CREATE UNIQUE INDEX "report_user_role_unique" ON "report_user_role" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "idx_report_user_role_role" ON "report_user_role" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_user_scope_unique" ON "report_user_scope" USING btree ("user_id","scope_type","scope_value");--> statement-breakpoint
CREATE INDEX "idx_report_user_scope_user_type" ON "report_user_scope" USING btree ("user_id","scope_type");--> statement-breakpoint
CREATE UNIQUE INDEX "report_user_username_unique" ON "report_user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_report_user_status" ON "report_user" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "store_master_profile_enterprise_store_unique" ON "store_master_profile" USING btree ("enterprise_id","store_id");--> statement-breakpoint
CREATE INDEX "idx_store_master_profile_enterprise_code" ON "store_master_profile" USING btree ("enterprise_id","store_code");--> statement-breakpoint
CREATE INDEX "idx_store_master_profile_enterprise_org" ON "store_master_profile" USING btree ("enterprise_id","organize_code","is_active");--> statement-breakpoint
CREATE INDEX "idx_store_master_profile_enterprise_status" ON "store_master_profile" USING btree ("enterprise_id","status","is_active");--> statement-breakpoint
CREATE INDEX "idx_store_master_profile_enterprise_name" ON "store_master_profile" USING btree ("enterprise_id","store_name");--> statement-breakpoint
CREATE UNIQUE INDEX "system_setting_key_unique" ON "system_setting" USING btree ("setting_key");--> statement-breakpoint
CREATE INDEX "idx_system_setting_category" ON "system_setting" USING btree ("category","setting_key");