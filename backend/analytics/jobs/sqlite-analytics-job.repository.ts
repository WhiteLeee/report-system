import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/backend/database/client";
import { analyticsJobCheckpointTable, analyticsJobRunTable } from "@/backend/database/schema";
import type {
  AnalyticsJobCheckpointRecord,
  AnalyticsJobRunRecord,
  AnalyticsJobType
} from "@/backend/analytics/jobs/analytics-job.types";
import type { AnalyticsJobRepository } from "@/backend/analytics/jobs/analytics-job.repository";

function safeParseRecord(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toAnalyticsJobRunRecord(row: typeof analyticsJobRunTable.$inferSelect): AnalyticsJobRunRecord {
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
): AnalyticsJobCheckpointRecord {
  return {
    id: row.id,
    job_type: row.jobType as AnalyticsJobType,
    scope_key: row.scopeKey,
    checkpoint: safeParseRecord(row.checkpointJson),
    updated_at: row.updatedAt
  };
}

export class SqliteAnalyticsJobRepository implements AnalyticsJobRepository {
  createRun(input: typeof analyticsJobRunTable.$inferInsert): AnalyticsJobRunRecord {
    db.insert(analyticsJobRunTable).values(input).run();
    const row = db
      .select()
      .from(analyticsJobRunTable)
      .where(eq(analyticsJobRunTable.jobKey, String(input.jobKey)))
      .orderBy(desc(analyticsJobRunTable.id))
      .get();
    if (!row) {
      throw new Error("Failed to create analytics job run.");
    }
    return toAnalyticsJobRunRecord(row);
  }

  finishRun(jobKey: string, patch: Partial<typeof analyticsJobRunTable.$inferInsert>): void {
    db.update(analyticsJobRunTable)
      .set({
        ...patch,
        updatedAt: new Date().toISOString()
      })
      .where(eq(analyticsJobRunTable.jobKey, jobKey))
      .run();
  }

  listRuns(limit = 20): AnalyticsJobRunRecord[] {
    return db
      .select()
      .from(analyticsJobRunTable)
      .orderBy(desc(analyticsJobRunTable.startedAt), desc(analyticsJobRunTable.id))
      .limit(Math.max(1, limit))
      .all()
      .map(toAnalyticsJobRunRecord);
  }

  getRunByKey(jobKey: string): AnalyticsJobRunRecord | null {
    const row = db
      .select()
      .from(analyticsJobRunTable)
      .where(eq(analyticsJobRunTable.jobKey, jobKey))
      .orderBy(desc(analyticsJobRunTable.id))
      .get();
    return row ? toAnalyticsJobRunRecord(row) : null;
  }

  getLatestRunByType(jobType: AnalyticsJobType): AnalyticsJobRunRecord | null {
    const row = db
      .select()
      .from(analyticsJobRunTable)
      .where(eq(analyticsJobRunTable.jobType, jobType))
      .orderBy(desc(analyticsJobRunTable.startedAt), desc(analyticsJobRunTable.id))
      .get();
    return row ? toAnalyticsJobRunRecord(row) : null;
  }

  listCheckpoints(): AnalyticsJobCheckpointRecord[] {
    return db
      .select()
      .from(analyticsJobCheckpointTable)
      .orderBy(asc(analyticsJobCheckpointTable.jobType), desc(analyticsJobCheckpointTable.updatedAt))
      .all()
      .map(toAnalyticsJobCheckpointRecord);
  }

  getCheckpoint(jobType: AnalyticsJobType, scopeKey = "global"): AnalyticsJobCheckpointRecord | null {
    const row = db
      .select()
      .from(analyticsJobCheckpointTable)
      .where(and(eq(analyticsJobCheckpointTable.jobType, jobType), eq(analyticsJobCheckpointTable.scopeKey, scopeKey)))
      .get();
    return row ? toAnalyticsJobCheckpointRecord(row) : null;
  }

  upsertCheckpoint(jobType: AnalyticsJobType, scopeKey: string, checkpoint: Record<string, unknown>): void {
    const existing = db
      .select()
      .from(analyticsJobCheckpointTable)
      .where(and(eq(analyticsJobCheckpointTable.jobType, jobType), eq(analyticsJobCheckpointTable.scopeKey, scopeKey)))
      .get();

    const payload = {
      jobType,
      scopeKey,
      checkpointJson: JSON.stringify(checkpoint),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      db.update(analyticsJobCheckpointTable)
        .set(payload)
        .where(eq(analyticsJobCheckpointTable.id, existing.id))
        .run();
      return;
    }

    db.insert(analyticsJobCheckpointTable).values(payload).run();
  }
}
