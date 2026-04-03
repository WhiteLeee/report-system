export interface AnalyticsDailyOverviewSnapshotRecord {
  id: number;
  snapshot_date: string;
  source_enterprise_id: string;
  enterprise_name: string;
  report_count: number;
  store_count: number;
  result_count: number;
  issue_count: number;
  pending_review_count: number;
  completed_review_count: number;
  auto_completed_review_count: number;
  manual_completed_review_count: number;
  rectification_order_count: number;
  rectification_completed_count: number;
  rectification_pending_count: number;
  rectification_overdue_count: number;
  rectification_close_rate: number;
  analytics_schema_version: number;
  built_at: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsDailySemanticSnapshotRecord {
  id: number;
  snapshot_date: string;
  source_enterprise_id: string;
  enterprise_name: string;
  result_semantic_state: string;
  result_count: number;
  issue_count: number;
  analytics_schema_version: number;
  built_at: string;
  created_at: string;
  updated_at: string;
}
