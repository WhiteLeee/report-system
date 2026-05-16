import { asc } from "drizzle-orm";

import { db } from "@/backend/database/client";
import {
  analyticsDailyOverviewSnapshotTable,
  analyticsDailySemanticSnapshotTable
} from "@/backend/database/schema";
import type {
  AnalyticsDailyOverviewSnapshotRecord,
  AnalyticsDailySemanticSnapshotRecord
} from "@/backend/analytics/snapshots/analytics-snapshot.types";
import type { AnalyticsSnapshotRepository } from "@/backend/analytics/snapshots/analytics-snapshot.repository";

function toDailyOverviewSnapshotRecord(
  row: typeof analyticsDailyOverviewSnapshotTable.$inferSelect
): any {
  return {
    id: row.id,
    snapshot_date: row.snapshotDate,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    report_count: row.reportCount,
    store_count: row.storeCount,
    result_count: row.resultCount,
    issue_count: row.issueCount,
    pending_review_count: row.pendingReviewCount,
    completed_review_count: row.completedReviewCount,
    auto_completed_review_count: row.autoCompletedReviewCount,
    manual_completed_review_count: row.manualCompletedReviewCount,
    rectification_order_count: row.rectificationOrderCount,
    rectification_completed_count: row.rectificationCompletedCount,
    rectification_pending_count: row.rectificationPendingCount,
    rectification_overdue_count: row.rectificationOverdueCount,
    rectification_close_rate: row.rectificationCloseRate,
    analytics_schema_version: row.analyticsSchemaVersion,
    built_at: row.builtAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toDailySemanticSnapshotRecord(
  row: typeof analyticsDailySemanticSnapshotTable.$inferSelect
): any {
  return {
    id: row.id,
    snapshot_date: row.snapshotDate,
    source_enterprise_id: row.sourceEnterpriseId,
    enterprise_name: row.enterpriseName,
    result_semantic_state: row.resultSemanticState,
    result_count: row.resultCount,
    issue_count: row.issueCount,
    analytics_schema_version: row.analyticsSchemaVersion,
    built_at: row.builtAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

export class PgAnalyticsSnapshotRepository implements AnalyticsSnapshotRepository {
  replaceDailyOverviewSnapshots(rows: Array<typeof analyticsDailyOverviewSnapshotTable.$inferInsert>): any {
    return db.transaction(async (tx): Promise<any> => {
      await tx.delete(analyticsDailyOverviewSnapshotTable);
      if (rows.length === 0) {
        return 0;
      }
      await tx.insert(analyticsDailyOverviewSnapshotTable).values(rows);
      return rows.length;
    });
  }

  replaceDailySemanticSnapshots(rows: Array<typeof analyticsDailySemanticSnapshotTable.$inferInsert>): any {
    return db.transaction(async (tx): Promise<any> => {
      await tx.delete(analyticsDailySemanticSnapshotTable);
      if (rows.length === 0) {
        return 0;
      }
      await tx.insert(analyticsDailySemanticSnapshotTable).values(rows);
      return rows.length;
    });
  }

  async listDailyOverviewSnapshots(): Promise<any> {
    return (await db
          .select()
          .from(analyticsDailyOverviewSnapshotTable)
          .orderBy(asc(analyticsDailyOverviewSnapshotTable.snapshotDate), asc(analyticsDailyOverviewSnapshotTable.sourceEnterpriseId)))
      .map(toDailyOverviewSnapshotRecord);
  }

  async listDailySemanticSnapshots(): Promise<any> {
    return (await db
          .select()
          .from(analyticsDailySemanticSnapshotTable)
          .orderBy(
            asc(analyticsDailySemanticSnapshotTable.snapshotDate),
            asc(analyticsDailySemanticSnapshotTable.sourceEnterpriseId),
            asc(analyticsDailySemanticSnapshotTable.resultSemanticState)
          ))
      .map(toDailySemanticSnapshotRecord);
  }
}
