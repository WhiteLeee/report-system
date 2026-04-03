export type AnalyticsJobType = "result_fact_rebuild" | "daily_snapshot_rebuild";
export type AnalyticsJobStatus = "running" | "completed" | "failed";

export interface AnalyticsJobCheckpointRecord {
  id: number;
  job_type: AnalyticsJobType;
  scope_key: string;
  checkpoint: Record<string, unknown>;
  updated_at: string;
}

export interface AnalyticsJobRunRecord {
  id: number;
  job_key: string;
  job_type: AnalyticsJobType;
  status: AnalyticsJobStatus;
  scope: Record<string, unknown>;
  metrics: Record<string, unknown>;
  error_message: string;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AnalyticsPipelineHealthStatus = "healthy" | "stale" | "failed" | "disabled" | "idle";

export interface AnalyticsPipelineHealthItem {
  job_type: AnalyticsJobType;
  status: AnalyticsPipelineHealthStatus;
  interval_ms: number;
  latest_run: AnalyticsJobRunRecord | null;
  checkpoint: AnalyticsJobCheckpointRecord | null;
  last_finished_at: string | null;
  stale_after_ms: number | null;
  message: string;
}
