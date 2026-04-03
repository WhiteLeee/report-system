import { ANALYTICS_SCHEMA_VERSION } from "@/backend/analytics/contracts/analytics-version";
import type { AnalyticsFactRepository } from "@/backend/analytics/facts/analytics-fact.repository";
import type { AnalyticsSnapshotRepository } from "@/backend/analytics/snapshots/analytics-snapshot.repository";
import { normalizeRemoteIfCorrected } from "@/backend/rectification/rectification-sync";

export class AnalyticsSnapshotService {
  constructor(
    private readonly factRepository: AnalyticsFactRepository,
    private readonly snapshotRepository: AnalyticsSnapshotRepository
  ) {}

  rebuildDailySnapshots(): {
    overview_row_count: number;
    semantic_row_count: number;
  } {
    const facts = this.factRepository.listResultFacts();
    const rectificationFacts = this.factRepository.listRectificationFacts();
    const rectificationRowsByDateAndEnterprise = new Map<string, typeof rectificationFacts>();

    rectificationFacts.forEach((row) => {
      const key = `${row.published_date}|${row.source_enterprise_id}`;
      const bucket = rectificationRowsByDateAndEnterprise.get(key) || [];
      bucket.push(row);
      rectificationRowsByDateAndEnterprise.set(key, bucket);
    });

    const overviewMap = new Map<
      string,
      {
        snapshotDate: string;
        sourceEnterpriseId: string;
        enterpriseName: string;
        reportIds: Set<number>;
        storeIds: Set<string>;
        resultCount: number;
        issueCount: number;
        pendingReviewCount: number;
        completedReviewCount: number;
        autoCompletedReviewCount: number;
      }
    >();
    const semanticMap = new Map<
      string,
      {
        snapshotDate: string;
        sourceEnterpriseId: string;
        enterpriseName: string;
        resultSemanticState: string;
        resultCount: number;
        issueCount: number;
      }
    >();

    facts.forEach((fact) => {
      const overviewKey = `${fact.published_date}|${fact.source_enterprise_id}`;
      const overviewBucket =
        overviewMap.get(overviewKey) || {
          snapshotDate: fact.published_date,
          sourceEnterpriseId: fact.source_enterprise_id,
          enterpriseName: fact.enterprise_name,
          reportIds: new Set<number>(),
          storeIds: new Set<string>(),
          resultCount: 0,
          issueCount: 0,
          pendingReviewCount: 0,
          completedReviewCount: 0,
          autoCompletedReviewCount: 0
        };
      overviewBucket.reportIds.add(fact.report_id);
      if (fact.store_id) {
        overviewBucket.storeIds.add(fact.store_id);
      }
      overviewBucket.resultCount += 1;
      overviewBucket.issueCount += fact.issue_count;
      if (fact.review_state === "completed") {
        overviewBucket.completedReviewCount += 1;
        if (fact.auto_completed) {
          overviewBucket.autoCompletedReviewCount += 1;
        }
      } else {
        overviewBucket.pendingReviewCount += 1;
      }
      overviewMap.set(overviewKey, overviewBucket);

      const semanticKey = `${fact.published_date}|${fact.source_enterprise_id}|${fact.result_semantic_state}`;
      const semanticBucket =
        semanticMap.get(semanticKey) || {
          snapshotDate: fact.published_date,
          sourceEnterpriseId: fact.source_enterprise_id,
          enterpriseName: fact.enterprise_name,
          resultSemanticState: fact.result_semantic_state,
          resultCount: 0,
          issueCount: 0
        };
      semanticBucket.resultCount += 1;
      semanticBucket.issueCount += fact.issue_count;
      semanticMap.set(semanticKey, semanticBucket);
    });

    const builtAt = new Date().toISOString();
    const overviewRows = Array.from(overviewMap.values()).map((item) => {
      const rectificationRowsForKey =
        rectificationRowsByDateAndEnterprise.get(`${item.snapshotDate}|${item.sourceEnterpriseId}`) || [];
      const rectificationCompletedCount = rectificationRowsForKey.filter(
        (row) => normalizeRemoteIfCorrected(row.remote_if_corrected) === "1"
      ).length;
      const rectificationPendingCount = Math.max(0, rectificationRowsForKey.length - rectificationCompletedCount);
      const rectificationOverdueCount = rectificationRowsForKey.filter((row) => {
        if (normalizeRemoteIfCorrected(row.remote_if_corrected) === "1") {
          return false;
        }
        const shouldCorrected = String(row.should_corrected_date || "").trim();
        return Boolean(shouldCorrected) && shouldCorrected < item.snapshotDate;
      }).length;
      return {
        snapshotDate: item.snapshotDate,
        sourceEnterpriseId: item.sourceEnterpriseId,
        enterpriseName: item.enterpriseName,
        reportCount: item.reportIds.size,
        storeCount: item.storeIds.size,
        resultCount: item.resultCount,
        issueCount: item.issueCount,
        pendingReviewCount: item.pendingReviewCount,
        completedReviewCount: item.completedReviewCount,
        autoCompletedReviewCount: item.autoCompletedReviewCount,
        manualCompletedReviewCount: Math.max(0, item.completedReviewCount - item.autoCompletedReviewCount),
        rectificationOrderCount: rectificationRowsForKey.length,
        rectificationCompletedCount,
        rectificationPendingCount,
        rectificationOverdueCount,
        rectificationCloseRate:
          rectificationRowsForKey.length > 0
            ? Math.round((rectificationCompletedCount / rectificationRowsForKey.length) * 100)
            : 0,
        analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
        builtAt,
        updatedAt: builtAt
      };
    });

    const semanticRows = Array.from(semanticMap.values()).map((item) => ({
      snapshotDate: item.snapshotDate,
      sourceEnterpriseId: item.sourceEnterpriseId,
      enterpriseName: item.enterpriseName,
      resultSemanticState: item.resultSemanticState,
      resultCount: item.resultCount,
      issueCount: item.issueCount,
      analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
      builtAt,
      updatedAt: builtAt
    }));

    return {
      overview_row_count: this.snapshotRepository.replaceDailyOverviewSnapshots(overviewRows),
      semantic_row_count: this.snapshotRepository.replaceDailySemanticSnapshots(semanticRows)
    };
  }
}
