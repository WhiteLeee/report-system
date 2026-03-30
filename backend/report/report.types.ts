import type { JsonValue } from "@/backend/shared/json";

export type ProgressState = "pending" | "in_progress" | "completed";
export type ResultReviewState = "pending" | "completed";
export type IncomingResultReviewState = ResultReviewState | "pending_review" | "reviewed";
export type ReviewFilterState = ProgressState | "";

export interface ReviewProgressSummary {
  progress_state: ProgressState;
  total_result_count: number;
  completed_result_count: number;
  pending_result_count: number;
  progress_percent: number;
}

export interface ReportMetaPayload {
  topic: string;
  report_versions: string[];
  enterprise_id: string;
  enterprise_name: string;
  start_date: string;
  end_date: string;
  operator: string;
  generated_at: string;
}

export interface ReportSummaryPayload {
  metrics: Record<string, JsonValue>;
  trend?: JsonValue;
  issue_distribution?: JsonValue;
}

export interface ReportStoreFact {
  store_id: string;
  store_code?: string;
  store_name: string;
  organize_name?: string;
  store_type?: string;
  franchisee_name?: string;
  supervisor?: string;
  enterprise_id?: string;
  enterprise_name?: string;
}

export interface ReportCameraFact {
  camera_id: string;
  store_id: string;
  store_code?: string;
  store_name?: string;
  camera_index?: number;
  camera_alias?: string;
  camera_device_code?: string;
}

export interface ReportCaptureFact {
  capture_id: string;
  image_id: string;
  store_id: string;
  store_code?: string;
  store_name?: string;
  camera_id?: string;
  camera_index?: number;
  camera_alias?: string;
  camera_device_code?: string;
  capture_provider?: string;
  channel_code?: string;
  captured_at?: string;
  capture_url?: string;
  preview_url?: string;
  oss_key?: string;
  local_path?: string;
  issue_count?: number;
}

export interface ReportInspectionFact {
  inspection_id: string;
  capture_id: string;
  image_id: string;
  store_id: string;
  store_code?: string;
  store_name?: string;
  skill_id: string;
  skill_name?: string;
  status?: string;
  channel_code?: string;
  capture_provider?: string;
  raw_result?: string;
  error_message?: string;
  total_issues?: number;
}

export interface ReportIssueFact {
  issue_id: string;
  inspection_id: string;
  capture_id: string;
  image_id: string;
  store_id: string;
  store_code?: string;
  store_name?: string;
  skill_id?: string;
  skill_name?: string;
  issue_type?: string;
  description?: string;
  count?: number;
  severity?: string;
  review_status?: IncomingResultReviewState;
  extra_json?: JsonValue;
}

export interface ReportReviewLog {
  id: number;
  report_id: number;
  result_id: number;
  store_id: string | null;
  store_name: string | null;
  from_status: ResultReviewState;
  to_status: ResultReviewState;
  operator_name: string;
  note: string | null;
  metadata: JsonValue;
  created_at: string;
}

export interface ReviewResultUpdateResult {
  report_id: number;
  result_id: number;
  store_id: string | null;
  store_name: string | null;
  from_status: ResultReviewState;
  to_status: ResultReviewState;
  changed: boolean;
  progress_state: ProgressState;
  completed_result_count: number;
  total_result_count: number;
  recent_log: ReportReviewLog | null;
  updated_at: string;
}

export interface ReportFactsPayload {
  stores: ReportStoreFact[];
  cameras: ReportCameraFact[];
  captures: ReportCaptureFact[];
  inspections: ReportInspectionFact[];
  issues: ReportIssueFact[];
}

export interface ReportBodyPayload {
  report_meta: ReportMetaPayload;
  summary: ReportSummaryPayload;
  facts: ReportFactsPayload;
}

export interface ReportPublishPayload {
  source_system: string;
  payload_version: number;
  idempotency_key: string;
  published_at: string;
  publish_dir?: string;
  report: ReportBodyPayload;
}

export interface ReportFilters {
  enterprise?: string;
  publishId?: string;
  reportType?: string;
  reviewStatus?: ReviewFilterState;
  startDate?: string;
  endDate?: string;
}

export interface ReportSummary extends ReviewProgressSummary {
  id: number;
  publish_id: string;
  source_system: string;
  source_enterprise_id: string;
  enterprise_name: string;
  report_type: string;
  report_version: string;
  period_start: string;
  period_end: string;
  operator_name: string;
  store_count: number;
  image_count: number;
  issue_count: number;
  completed_store_count: number;
  pending_store_count: number;
  in_progress_store_count: number;
  summary_metrics: Record<string, JsonValue>;
  published_at: string;
  created_at: string;
}

export interface ReportStore extends ReviewProgressSummary {
  id: number;
  report_id: number;
  store_id: string;
  store_name: string;
  organization_name: string | null;
  issue_count: number;
  image_count: number;
  metadata: JsonValue;
  state_snapshot: JsonValue;
  display_order: number;
  created_at: string;
}

export interface ReportResult {
  id: number;
  report_id: number;
  store_id: string | null;
  store_name: string | null;
  object_key: string | null;
  bucket: string | null;
  region: string | null;
  url: string;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  review_state: ResultReviewState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  review_payload: JsonValue;
  metadata: JsonValue;
  display_order: number;
  created_at: string;
}

export type ReportImage = ReportResult;

export interface ReportIssue {
  id: number;
  report_id: number;
  result_id: number | null;
  store_id: string | null;
  store_name: string | null;
  title: string;
  category: string | null;
  severity: string | null;
  description: string | null;
  suggestion: string | null;
  image_url: string | null;
  image_object_key: string | null;
  review_state: ResultReviewState;
  metadata: JsonValue;
  display_order: number;
  created_at: string;
}

export interface ReportInspection {
  id: number;
  report_id: number;
  result_id: number | null;
  store_id: string | null;
  store_name: string | null;
  inspection_id: string;
  skill_id: string;
  skill_name: string | null;
  status: string | null;
  raw_result: string | null;
  error_message: string | null;
  metadata: JsonValue;
  display_order: number;
  created_at: string;
}

export interface ReportDetail extends ReportSummary {
  stores: ReportStore[];
  results: ReportResult[];
  images: ReportResult[];
  issues: ReportIssue[];
  inspections: ReportInspection[];
  review_logs: ReportReviewLog[];
  raw_payload: ReportPublishPayload;
}

export type PublishAction = "created" | "duplicate_publish_id" | "duplicate_version";

export interface PublishReceipt {
  success: true;
  action: PublishAction;
  reportId: number;
  publishId: string;
  reportVersion: string;
  receivedAt: string;
}

export interface PublishStatusReceipt {
  success: true;
  exists: boolean;
  status: "published" | "missing";
  reportId?: number;
  publishId: string;
  reportVersion?: string;
  receivedAt: string;
}
