import type {
  AnalyticsJobCheckpointRecord,
  AnalyticsJobRunRecord,
  AnalyticsJobType
} from "@/backend/analytics/jobs/analytics-job.types";
import type { analyticsJobRunTable } from "@/backend/database/schema";

export interface AnalyticsJobRepository {
  createRun(input: typeof analyticsJobRunTable.$inferInsert): AnalyticsJobRunRecord;
  finishRun(jobKey: string, patch: Partial<typeof analyticsJobRunTable.$inferInsert>): void;
  listRuns(limit?: number): AnalyticsJobRunRecord[];
  getRunByKey(jobKey: string): AnalyticsJobRunRecord | null;
  getLatestRunByType(jobType: AnalyticsJobType): AnalyticsJobRunRecord | null;
  listCheckpoints(): AnalyticsJobCheckpointRecord[];
  getCheckpoint(jobType: AnalyticsJobType, scopeKey?: string): AnalyticsJobCheckpointRecord | null;
  upsertCheckpoint(jobType: AnalyticsJobType, scopeKey: string, checkpoint: Record<string, unknown>): void;
}
