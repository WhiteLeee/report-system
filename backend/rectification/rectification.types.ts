import type { JsonValue } from "@/backend/shared/json";
import type { ReviewSelectedIssue } from "@/backend/report/report.types";

export type RectificationOrderStatus = "created" | "sync_failed" | "pending_review" | "corrected";

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
  last_synced_at?: string | null;
  created_by: string;
}
