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
): AnalyticsDailyOverviewSnapshotRecord {
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
): AnalyticsDailySemanticSnapshotRecord {
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

export class SqliteAnalyticsSnapshotRepository implements AnalyticsSnapshotRepository {
  replaceDailyOverviewSnapshots(rows: Array<typeof analyticsDailyOverviewSnapshotTable.$inferInsert>): number {
    return db.transaction((tx) => {
      tx.delete(analyticsDailyOverviewSnapshotTable).run();
      if (rows.length === 0) {
        return 0;
      }
      tx.insert(analyticsDailyOverviewSnapshotTable).values(rows).run();
      return rows.length;
    });
  }

  replaceDailySemanticSnapshots(rows: Array<typeof analyticsDailySemanticSnapshotTable.$inferInsert>): number {
    return db.transaction((tx) => {
      tx.delete(analyticsDailySemanticSnapshotTable).run();
      if (rows.length === 0) {
        return 0;
      }
      tx.insert(analyticsDailySemanticSnapshotTable).values(rows).run();
      return rows.length;
    });
  }

  listDailyOverviewSnapshots(): AnalyticsDailyOverviewSnapshotRecord[] {
    return db
      .select()
      .from(analyticsDailyOverviewSnapshotTable)
      .orderBy(asc(analyticsDailyOverviewSnapshotTable.snapshotDate), asc(analyticsDailyOverviewSnapshotTable.sourceEnterpriseId))
      .all()
      .map(toDailyOverviewSnapshotRecord);
  }

  listDailySemanticSnapshots(): AnalyticsDailySemanticSnapshotRecord[] {
    return db
      .select()
      .from(analyticsDailySemanticSnapshotTable)
      .orderBy(
        asc(analyticsDailySemanticSnapshotTable.snapshotDate),
        asc(analyticsDailySemanticSnapshotTable.sourceEnterpriseId),
        asc(analyticsDailySemanticSnapshotTable.resultSemanticState)
      )
      .all()
      .map(toDailySemanticSnapshotRecord);
  }
}
