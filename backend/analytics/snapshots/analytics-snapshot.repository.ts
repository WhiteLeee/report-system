import type {
  AnalyticsDailyOverviewSnapshotRecord,
  AnalyticsDailySemanticSnapshotRecord
} from "@/backend/analytics/snapshots/analytics-snapshot.types";
import type {
  analyticsDailyOverviewSnapshotTable,
  analyticsDailySemanticSnapshotTable
} from "@/backend/database/schema";

export interface AnalyticsSnapshotRepository {
  replaceDailyOverviewSnapshots(rows: Array<typeof analyticsDailyOverviewSnapshotTable.$inferInsert>): any;
  replaceDailySemanticSnapshots(rows: Array<typeof analyticsDailySemanticSnapshotTable.$inferInsert>): any;
  listDailyOverviewSnapshots(): any;
  listDailySemanticSnapshots(): any;
}
