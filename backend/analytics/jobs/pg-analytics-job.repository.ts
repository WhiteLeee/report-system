import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/backend/database/client";
import { analyticsJobCheckpointTable, analyticsJobRunTable } from "@/backend/database/schema";
import type {
  AnalyticsJobCheckpointRecord,
  AnalyticsJobRunRecord,
  AnalyticsJobType
} from "@/backend/analytics/jobs/analytics-job.types";
import type { AnalyticsJobRepository } from "@/backend/analytics/jobs/analytics-job.repository";

function safeParseRecord(json: string): any {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toAnalyticsJobRunRecord(row: typeof analyticsJobRunTable.$inferSelect): any {
  return {
    id: row.id,
    job_key: row.jobKey,
    job_type: row.jobType as AnalyticsJobRunRecord["job_type"],
    status: row.status as AnalyticsJobRunRecord["status"],
    scope: safeParseRecord(row.scopeJson),
    metrics: safeParseRecord(row.metricsJson),
    error_message: row.errorMessage,
    started_at: row.startedAt,
    finished_at: row.finishedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toAnalyticsJobCheckpointRecord(
  row: typeof analyticsJobCheckpointTable.$inferSelect
): any {
  return {
    id: row.id,
    job_type: row.jobType as AnalyticsJobType,
    scope_key: row.scopeKey,
    checkpoint: safeParseRecord(row.checkpointJson),
    updated_at: row.updatedAt
  };
}

export class PgAnalyticsJobRepository implements AnalyticsJobRepository {
  async createRun(input: typeof analyticsJobRunTable.$inferInsert): Promise<any> {
    await db.insert(analyticsJobRunTable).values(input);
    const row = (await db
          .select()
          .from(analyticsJobRunTable)
          .where(eq(analyticsJobRunTable.jobKey, String(input.jobKey)))
          .orderBy(desc(analyticsJobRunTable.id)))[0];
    if (!row) {
      throw new Error("Failed to create analytics job run.");
    }
    return toAnalyticsJobRunRecord(row);
  }

  async finishRun(jobKey: string, patch: Partial<typeof analyticsJobRunTable.$inferInsert>): Promise<any> {
    await db.update(analyticsJobRunTable)
            .set({
              ...patch,
              updatedAt: new Date().toISOString()
            })
            .where(eq(analyticsJobRunTable.jobKey, jobKey));
  }

  async listRuns(limit = 20): Promise<any> {
    return (await db
          .select()
          .from(analyticsJobRunTable)
          .orderBy(desc(analyticsJobRunTable.startedAt), desc(analyticsJobRunTable.id))
          .limit(Math.max(1, limit)))
      .map(toAnalyticsJobRunRecord);
  }

  async getRunByKey(jobKey: string): Promise<any> {
    const row = (await db
          .select()
          .from(analyticsJobRunTable)
          .where(eq(analyticsJobRunTable.jobKey, jobKey))
          .orderBy(desc(analyticsJobRunTable.id)))[0];
    return row ? toAnalyticsJobRunRecord(row) : null;
  }

  async getLatestRunByType(jobType: AnalyticsJobType): Promise<any> {
    const row = (await db
          .select()
          .from(analyticsJobRunTable)
          .where(eq(analyticsJobRunTable.jobType, jobType))
          .orderBy(desc(analyticsJobRunTable.startedAt), desc(analyticsJobRunTable.id)))[0];
    return row ? toAnalyticsJobRunRecord(row) : null;
  }

  async listCheckpoints(): Promise<any> {
    return (await db
          .select()
          .from(analyticsJobCheckpointTable)
          .orderBy(asc(analyticsJobCheckpointTable.jobType), desc(analyticsJobCheckpointTable.updatedAt)))
      .map(toAnalyticsJobCheckpointRecord);
  }

  async getCheckpoint(jobType: AnalyticsJobType, scopeKey = "global"): Promise<any> {
    const row = (await db
          .select()
          .from(analyticsJobCheckpointTable)
          .where(and(eq(analyticsJobCheckpointTable.jobType, jobType), eq(analyticsJobCheckpointTable.scopeKey, scopeKey))))[0];
    return row ? toAnalyticsJobCheckpointRecord(row) : null;
  }

  async upsertCheckpoint(jobType: AnalyticsJobType, scopeKey: string, checkpoint: Record<string, unknown>): Promise<any> {
    const existing = (await db
          .select()
          .from(analyticsJobCheckpointTable)
          .where(and(eq(analyticsJobCheckpointTable.jobType, jobType), eq(analyticsJobCheckpointTable.scopeKey, scopeKey))))[0];

    const payload = {
      jobType,
      scopeKey,
      checkpointJson: JSON.stringify(checkpoint),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      await db.update(analyticsJobCheckpointTable)
                .set(payload)
                .where(eq(analyticsJobCheckpointTable.id, existing.id));
      return;
    }

    await db.insert(analyticsJobCheckpointTable).values(payload);
  }
}
