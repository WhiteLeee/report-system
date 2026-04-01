import type { JsonValue } from "@/backend/shared/json";
import type { ReviewSelectedIssue } from "@/backend/report/report.types";

export type RectificationOrderStatus = "created" | "sync_failed" | "pending_review" | "corrected";
export type RectificationSyncBatchStatus = "running" | "completed" | "completed_with_errors";
export type RectificationSyncLogStatus = "success" | "failed" | "not_found" | "skipped";

export interface RectificationOrderRecord {
  id: number;
  report_id: number;
  result_id: number;
  source_enterprise_id: string | null;
  enterprise_name: string | null;
  report_type: string | null;
  report_version: string | null;
  published_at: string | null;
  source_review_log_id: number | null;
  store_id: string | null;
  store_code: string | null;
  store_name: string | null;
  huiyunying_order_id: string | null;
  request_description: string;
  selected_issues: ReviewSelectedIssue[];
  image_urls: string[];
  request_payload: JsonValue;
  response_payload: JsonValue;
  status: RectificationOrderStatus;
  if_corrected: string | null;
  should_corrected: string | null;
  real_corrected_time: string | null;
  rectification_reply_content: string | null;
  last_synced_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RectificationOrderFilters {
  keyword?: string;
  status?: string;
  ifCorrected?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateRectificationOrderInput {
  report_id: number;
  result_id: number;
  source_review_log_id?: number | null;
  store_id?: string | null;
  store_code?: string | null;
  store_name?: string | null;
  huiyunying_order_id?: string | null;
  request_description: string;
  selected_issues: ReviewSelectedIssue[];
  image_urls: string[];
  request_payload: JsonValue;
  response_payload: JsonValue;
  status: RectificationOrderStatus;
  if_corrected?: string | null;
  should_corrected?: string | null;
  real_corrected_time?: string | null;
  rectification_reply_content?: string | null;
  last_synced_at?: string | null;
  created_by: string;
}

export interface RectificationSyncBatchRecord {
  id: number;
  sync_batch_id: string;
  trigger_source: string;
  status: RectificationSyncBatchStatus;
  scanned_count: number;
  success_count: number;
  failed_count: number;
  not_found_count: number;
  skipped_count: number;
  average_response_time_ms: number | null;
  max_response_time_ms: number | null;
  config: JsonValue;
  summary: JsonValue;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRectificationSyncBatchInput {
  sync_batch_id: string;
  trigger_source: string;
  status: RectificationSyncBatchStatus;
  scanned_count: number;
  config: JsonValue;
  summary?: JsonValue;
  started_at: string;
}

export interface CreateRectificationSyncLogInput {
  sync_batch_id: string;
  order_id: number;
  huiyunying_order_id?: string | null;
  status: RectificationSyncLogStatus;
  error_type?: string | null;
  error_message?: string;
  attempt_count: number;
  response_time_ms?: number | null;
  remote_status?: string | null;
  remote_if_corrected?: string | null;
  request_payload: JsonValue;
  response_payload: JsonValue;
  synced_at: string;
}

export interface RectificationSyncDailyStat {
  sync_date: string;
  batch_count: number;
  scanned_count: number;
  success_count: number;
  failed_count: number;
  not_found_count: number;
  skipped_count: number;
  average_response_time_ms: number | null;
  max_response_time_ms: number | null;
}

export interface RectificationSyncDashboard {
  recent_batches: RectificationSyncBatchRecord[];
  daily_stats: RectificationSyncDailyStat[];
}
