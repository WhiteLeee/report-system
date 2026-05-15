import type {
  AnalyticsJobCheckpointRecord,
  AnalyticsJobRunRecord,
  AnalyticsJobType
} from "@/backend/analytics/jobs/analytics-job.types";
import type { analyticsJobRunTable } from "@/backend/database/schema";

export interface AnalyticsJobRepository {
  createRun(input: typeof analyticsJobRunTable.$inferInsert): any;
  finishRun(jobKey: string, patch: Partial<typeof analyticsJobRunTable.$inferInsert>): any;
  listRuns(limit?: number): any;
  getRunByKey(jobKey: string): any;
  getLatestRunByType(jobType: AnalyticsJobType): any;
  listCheckpoints(): any;
  getCheckpoint(jobType: AnalyticsJobType, scopeKey?: string): any;
  upsertCheckpoint(jobType: AnalyticsJobType, scopeKey: string, checkpoint: Record<string, unknown>): any;
}
