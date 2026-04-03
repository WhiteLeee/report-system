import { and, eq, gte, inArray, lte } from "drizzle-orm";

import type { RequestContext } from "@/backend/auth/request-context";
import { db } from "@/backend/database/client";
import {
  analyticsDailyOverviewSnapshotTable,
  analyticsDailySemanticSnapshotTable,
  analyticsIssueFactTable,
  analyticsRectificationFactTable,
  analyticsResultFactTable,
  analyticsReviewFactTable,
  reportTable
} from "@/backend/database/schema";
import type { AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import type { AnalyticsDashboard } from "@/backend/analytics/contracts/analytics.types";
import type {
  AnalyticsDailyTrendItem,
  AnalyticsFranchiseeCloseRateItem,
  AnalyticsFranchiseeRankingItem,
  AnalyticsHighRiskFranchiseeItem,
  AnalyticsSkillDistributionItem,
  AnalyticsIssueTypeRankingItem,
  AnalyticsOverdueFranchiseeItem,
  AnalyticsOrganizationGovernanceItem,
  AnalyticsOrganizationRankingItem,
  AnalyticsOverviewMetrics,
  AnalyticsRecurringFranchiseeItem,
  AnalyticsRecurringStoreItem,
  AnalyticsRectificationOverdueRankingItem,
  AnalyticsRectificationOverviewMetrics,
  AnalyticsReviewEfficiencyMetrics,
  AnalyticsReviewStatusDistributionItem,
  AnalyticsSeverityDistributionItem,
  AnalyticsSemanticDistributionItem,
  AnalyticsStoreRankingItem
} from "@/backend/analytics/contracts/analytics.metrics";
import type { AnalyticsRepository } from "@/backend/analytics/queries/analytics.repository";
import { getReportResultSemanticSummaryLabel, type ReportResultSemanticState } from "@/backend/report/result-semantics";
import { normalizeRemoteIfCorrected } from "@/backend/rectification/rectification-sync";
import { canAccessEnterprise, intersectScopedIds, resolveScopedStoreIds, resolveStoreIdsFromScope } from "@/backend/shared/request-scope";

type AnalyticsReportRow = typeof reportTable.$inferSelect;
type AnalyticsResultFactRow = typeof analyticsResultFactTable.$inferSelect;
type AnalyticsIssueFactRow = typeof analyticsIssueFactTable.$inferSelect;
type AnalyticsReviewFactRow = typeof analyticsReviewFactTable.$inferSelect;
type AnalyticsRectificationFactRow = typeof analyticsRectificationFactTable.$inferSelect;
type AnalyticsDailyOverviewSnapshotRow = typeof analyticsDailyOverviewSnapshotTable.$inferSelect;
type AnalyticsDailySemanticSnapshotRow = typeof analyticsDailySemanticSnapshotTable.$inferSelect;

type LoadedAnalyticsDataset = {
  reportRows: AnalyticsReportRow[];
  resultFactRows: AnalyticsResultFactRow[];
  issueFactRows: AnalyticsIssueFactRow[];
  reviewFactRows: AnalyticsReviewFactRow[];
  rectificationFactRows: AnalyticsRectificationFactRow[];
};

type LoadedSnapshotDataset = {
  overviewRows: AnalyticsDailyOverviewSnapshotRow[];
  semanticRows: AnalyticsDailySemanticSnapshotRow[];
};

function safeParseRecord(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateBoundaryStart(value: string): string {
  return `${value} 00:00:00`;
}

function normalizeDateBoundaryEnd(value: string): string {
  return `${value} 23:59:59`;
}

function normalizeSeverityLabel(severity: string): { key: string; label: string; priority: number } {
  const normalized = String(severity || "").trim().toLowerCase();
  switch (normalized) {
    case "critical":
      return { key: "critical", label: "严重", priority: 0 };
    case "high":
      return { key: "high", label: "高", priority: 1 };
    case "medium":
      return { key: "medium", label: "中", priority: 2 };
    case "low":
      return { key: "low", label: "低", priority: 3 };
    default:
      return { key: normalized || "unspecified", label: normalized ? normalized : "未标注", priority: 4 };
  }
}

function computeDurationDays(start: string | null | undefined, end: string | null | undefined): number {
  const startTs = Date.parse(String(start || ""));
  const endTs = Date.parse(String(end || ""));
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs < startTs) {
    return 0;
  }
  return (endTs - startTs) / 86400000;
}

function canUseDailySnapshots(filters: AnalyticsFilters): boolean {
  return !filters.organizationId && !filters.franchiseeName && !filters.storeId && !filters.reportType && !filters.topic && !filters.planId;
}

function buildSemanticDistribution(
  resultRows: AnalyticsResultFactRow[]
): AnalyticsSemanticDistributionItem[] {
  const stats = new Map<ReportResultSemanticState, { count: number; issueCount: number }>();
  resultRows.forEach((row) => {
    const state = row.resultSemanticState as ReportResultSemanticState;
    const bucket = stats.get(state) || { count: 0, issueCount: 0 };
    bucket.count += 1;
    bucket.issueCount += row.issueCount;
    stats.set(state, bucket);
  });

  const orderedStates: ReportResultSemanticState[] = ["issue_found", "pass", "inconclusive", "inspection_failed"];
  return orderedStates.map((state) => ({
    state,
    label: getReportResultSemanticSummaryLabel(state),
    count: stats.get(state)?.count || 0,
    issue_count: stats.get(state)?.issueCount || 0
  }));
}

function buildSemanticDistributionFromSnapshots(
  snapshotRows: AnalyticsDailySemanticSnapshotRow[]
): AnalyticsSemanticDistributionItem[] {
  const stats = new Map<ReportResultSemanticState, { count: number; issueCount: number }>();
  snapshotRows.forEach((row) => {
    const state = row.resultSemanticState as ReportResultSemanticState;
    const bucket = stats.get(state) || { count: 0, issueCount: 0 };
    bucket.count += row.resultCount;
    bucket.issueCount += row.issueCount;
    stats.set(state, bucket);
  });

  const orderedStates: ReportResultSemanticState[] = ["issue_found", "pass", "inconclusive", "inspection_failed"];
  return orderedStates.map((state) => ({
    state,
    label: getReportResultSemanticSummaryLabel(state),
    count: stats.get(state)?.count || 0,
    issue_count: stats.get(state)?.issueCount || 0
  }));
}

function buildOverview(
  reportRows: AnalyticsReportRow[],
  resultRows: AnalyticsResultFactRow[],
  issueRows: AnalyticsIssueFactRow[],
  rectificationRows: AnalyticsRectificationFactRow[]
): AnalyticsOverviewMetrics {
  const completedReviewCount = resultRows.filter((row) => row.reviewState === "completed").length;
  const autoCompletedReviewCount = resultRows.filter((row) => row.reviewState === "completed" && row.autoCompleted === 1).length;
  const rectificationCompletedCount = rectificationRows.filter(
    (row) => normalizeRemoteIfCorrected(row.remoteIfCorrected) === "1"
  ).length;
  const rectificationPendingCount = rectificationRows.length - rectificationCompletedCount;
  const rectificationOverdueCount = rectificationRows.filter((row) => row.overdue === 1).length;

  return {
    report_count: reportRows.length,
    store_count: new Set(resultRows.map((row) => row.storeId).filter(Boolean)).size,
    result_count: resultRows.length,
    issue_count: issueRows.length,
    pending_review_count: resultRows.filter((row) => row.reviewState !== "completed").length,
    completed_review_count: completedReviewCount,
    auto_completed_review_count: autoCompletedReviewCount,
    manual_completed_review_count: Math.max(0, completedReviewCount - autoCompletedReviewCount),
    rectification_order_count: rectificationRows.length,
    rectification_completed_count: rectificationCompletedCount,
    rectification_pending_count: rectificationPendingCount,
    rectification_overdue_count: rectificationOverdueCount,
    rectification_close_rate:
      rectificationRows.length > 0 ? Math.round((rectificationCompletedCount / rectificationRows.length) * 100) : 0
  };
}

function buildOverviewFromSnapshots(rows: AnalyticsDailyOverviewSnapshotRow[]): AnalyticsOverviewMetrics {
  const totals = rows.reduce(
    (acc, row) => {
      acc.report_count += row.reportCount;
      acc.store_count += row.storeCount;
      acc.result_count += row.resultCount;
      acc.issue_count += row.issueCount;
      acc.pending_review_count += row.pendingReviewCount;
      acc.completed_review_count += row.completedReviewCount;
      acc.auto_completed_review_count += row.autoCompletedReviewCount;
      acc.manual_completed_review_count += row.manualCompletedReviewCount;
      acc.rectification_order_count += row.rectificationOrderCount;
      acc.rectification_completed_count += row.rectificationCompletedCount;
      acc.rectification_pending_count += row.rectificationPendingCount;
      acc.rectification_overdue_count += row.rectificationOverdueCount;
      return acc;
    },
    {
      report_count: 0,
      store_count: 0,
      result_count: 0,
      issue_count: 0,
      pending_review_count: 0,
      completed_review_count: 0,
      auto_completed_review_count: 0,
      manual_completed_review_count: 0,
      rectification_order_count: 0,
      rectification_completed_count: 0,
      rectification_pending_count: 0,
      rectification_overdue_count: 0
    }
  );

  return {
    ...totals,
    rectification_close_rate:
      totals.rectification_order_count > 0
        ? Math.round((totals.rectification_completed_count / totals.rectification_order_count) * 100)
        : 0
  };
}

function buildRectificationOverview(rectificationRows: AnalyticsRectificationFactRow[]): AnalyticsRectificationOverviewMetrics {
  const completedCount = rectificationRows.filter((row) => normalizeRemoteIfCorrected(row.remoteIfCorrected) === "1").length;
  const syncFailedCount = rectificationRows.filter((row) => row.syncFailed === 1).length;
  const overdueCount = rectificationRows.filter((row) => row.overdue === 1).length;
  const completedDurations = rectificationRows
    .filter((row) => normalizeRemoteIfCorrected(row.remoteIfCorrected) === "1")
    .map((row) => computeDurationDays(row.createdDate, row.completedDate))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageRectificationDurationDays =
    completedDurations.length > 0
      ? Math.round((completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length) * 10) / 10
      : 0;

  return {
    order_count: rectificationRows.length,
    completed_count: completedCount,
    pending_count: Math.max(0, rectificationRows.length - completedCount),
    overdue_count: overdueCount,
    sync_failed_count: syncFailedCount,
    close_rate: rectificationRows.length > 0 ? Math.round((completedCount / rectificationRows.length) * 100) : 0,
    average_rectification_duration_days: averageRectificationDurationDays
  };
}

function buildReviewEfficiency(reviewRows: AnalyticsReviewFactRow[]): AnalyticsReviewEfficiencyMetrics {
  const manualCompletedRows = reviewRows.filter((row) => row.reviewAction === "complete");
  const reopenedRows = reviewRows.filter((row) => row.reviewAction === "reopen");
  const operatorCount = new Set(
    reviewRows.map((row) => String(row.operatorName || "").trim()).filter(Boolean)
  ).size;
  const avgLatencyMinutes =
    manualCompletedRows.length > 0
      ? manualCompletedRows.reduce((sum, row) => sum + row.reviewLatencyMinutes, 0) / manualCompletedRows.length
      : 0;

  return {
    review_action_count: reviewRows.length,
    manual_completed_count: manualCompletedRows.length,
    reopened_count: reopenedRows.length,
    operator_count: operatorCount,
    average_review_latency_hours: Math.round((avgLatencyMinutes / 60) * 10) / 10
  };
}

function buildReviewStatusDistribution(resultRows: AnalyticsResultFactRow[]): AnalyticsReviewStatusDistributionItem[] {
  const pendingCount = resultRows.filter((row) => row.reviewState !== "completed").length;
  const autoCompletedCount = resultRows.filter((row) => row.reviewState === "completed" && row.autoCompleted === 1).length;
  const manualCompletedCount = resultRows.filter((row) => row.reviewState === "completed" && row.autoCompleted !== 1).length;

  return [
    { review_state: "pending", label: "待人工复核", count: pendingCount },
    { review_state: "manual_completed", label: "人工已复核", count: manualCompletedCount },
    { review_state: "auto_completed", label: "自动已复核", count: autoCompletedCount }
  ];
}

function buildIssueTypeRanking(issueRows: AnalyticsIssueFactRow[], limit: number): AnalyticsIssueTypeRankingItem[] {
  const stats = new Map<string, { count: number; storeIds: Set<string>; resultIds: Set<number> }>();
  issueRows.forEach((row) => {
    const key = String(row.issueType || row.title || "未分类问题").trim() || "未分类问题";
    const bucket = stats.get(key) || { count: 0, storeIds: new Set<string>(), resultIds: new Set<number>() };
    bucket.count += 1;
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    if (row.resultId) {
      bucket.resultIds.add(row.resultId);
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.entries())
    .map(([issueType, value]) => ({
      issue_type: issueType,
      count: value.count,
      store_count: value.storeIds.size,
      result_count: value.resultIds.size
    }))
    .sort((left, right) => right.count - left.count || right.store_count - left.store_count || left.issue_type.localeCompare(right.issue_type))
    .slice(0, Math.max(1, limit));
}

function buildSkillDistribution(issueRows: AnalyticsIssueFactRow[], limit: number): AnalyticsSkillDistributionItem[] {
  const stats = new Map<string, { skillId: string; skillName: string; count: number; storeIds: Set<string>; resultIds: Set<number> }>();

  issueRows.forEach((row) => {
    const skillId = String(row.skillId || "").trim();
    const skillName = String(row.skillName || "").trim() || skillId || "未标注技能";
    const key = skillId || skillName;
    const bucket = stats.get(key) || {
      skillId: skillId || "unknown",
      skillName,
      count: 0,
      storeIds: new Set<string>(),
      resultIds: new Set<number>()
    };
    bucket.count += 1;
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    if (row.resultId) {
      bucket.resultIds.add(row.resultId);
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.values())
    .map((item) => ({
      skill_id: item.skillId,
      skill_name: item.skillName,
      count: item.count,
      store_count: item.storeIds.size,
      result_count: item.resultIds.size
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.store_count - left.store_count ||
        left.skill_name.localeCompare(right.skill_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildSeverityDistribution(issueRows: AnalyticsIssueFactRow[]): AnalyticsSeverityDistributionItem[] {
  const stats = new Map<string, { key: string; label: string; priority: number; count: number; storeIds: Set<string>; resultIds: Set<number> }>();

  issueRows.forEach((row) => {
    const severity = normalizeSeverityLabel(String(row.severity || ""));
    const bucket = stats.get(severity.key) || {
      key: severity.key,
      label: severity.label,
      priority: severity.priority,
      count: 0,
      storeIds: new Set<string>(),
      resultIds: new Set<number>()
    };
    bucket.count += 1;
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    if (row.resultId) {
      bucket.resultIds.add(row.resultId);
    }
    stats.set(severity.key, bucket);
  });

  return Array.from(stats.values())
    .map((item) => ({
      severity: item.key,
      label: item.label,
      count: item.count,
      store_count: item.storeIds.size,
      result_count: item.resultIds.size
    }))
    .sort((left, right) => {
      const leftPriority = normalizeSeverityLabel(left.severity).priority;
      const rightPriority = normalizeSeverityLabel(right.severity).priority;
      return leftPriority - rightPriority || right.count - left.count || left.label.localeCompare(right.label);
    });
}

function buildDailyTrendFromFacts(
  reportRows: AnalyticsReportRow[],
  resultRows: AnalyticsResultFactRow[],
  rectificationRows: AnalyticsRectificationFactRow[],
  limit: number
): AnalyticsDailyTrendItem[] {
  const reportIdsByDate = new Map<string, Set<number>>();
  const storeIdsByDate = new Map<string, Set<string>>();
  const rectificationRowsByDate = new Map<string, AnalyticsRectificationFactRow[]>();
  const resultMapById = new Map(resultRows.map((row) => [row.resultId, row] as const));
  const reportDateById = new Map(reportRows.map((row) => [row.id, String(row.publishedAt || "").slice(0, 10)] as const));
  const trend = new Map<string, AnalyticsDailyTrendItem>();

  resultRows.forEach((row) => {
    const snapshotDate = row.publishedDate;
    const bucket =
      trend.get(snapshotDate) || {
        snapshot_date: snapshotDate,
        report_count: 0,
        store_count: 0,
        result_count: 0,
        issue_count: 0,
        pending_review_count: 0,
        rectification_order_count: 0,
        rectification_completed_count: 0,
        rectification_close_rate: 0
      };
    bucket.result_count += 1;
    bucket.issue_count += row.issueCount;
    if (row.reviewState !== "completed") {
      bucket.pending_review_count += 1;
    }
    trend.set(snapshotDate, bucket);

    if (!reportIdsByDate.has(snapshotDate)) {
      reportIdsByDate.set(snapshotDate, new Set<number>());
    }
    reportIdsByDate.get(snapshotDate)?.add(row.reportId);

    if (row.storeId) {
      if (!storeIdsByDate.has(snapshotDate)) {
        storeIdsByDate.set(snapshotDate, new Set<string>());
      }
      storeIdsByDate.get(snapshotDate)?.add(row.storeId);
    }
  });

  rectificationRows.forEach((row) => {
    const resultRow = resultMapById.get(row.resultId);
    const snapshotDate = resultRow?.publishedDate || row.publishedDate || reportDateById.get(row.reportId) || "";
    if (!snapshotDate) {
      return;
    }
    const bucket =
      trend.get(snapshotDate) || {
        snapshot_date: snapshotDate,
        report_count: 0,
        store_count: 0,
        result_count: 0,
        issue_count: 0,
        pending_review_count: 0,
        rectification_order_count: 0,
        rectification_completed_count: 0,
        rectification_close_rate: 0
      };
    bucket.rectification_order_count += 1;
    if (normalizeRemoteIfCorrected(row.remoteIfCorrected) === "1") {
      bucket.rectification_completed_count += 1;
    }
    trend.set(snapshotDate, bucket);

    const rectificationBucket = rectificationRowsByDate.get(snapshotDate) || [];
    rectificationBucket.push(row);
    rectificationRowsByDate.set(snapshotDate, rectificationBucket);
  });

  return Array.from(trend.values())
    .map((row) => ({
      ...row,
      report_count: reportIdsByDate.get(row.snapshot_date)?.size || 0,
      store_count: storeIdsByDate.get(row.snapshot_date)?.size || 0,
      rectification_close_rate:
        row.rectification_order_count > 0
          ? Math.round((row.rectification_completed_count / row.rectification_order_count) * 100)
          : 0
    }))
    .sort((left, right) => left.snapshot_date.localeCompare(right.snapshot_date))
    .slice(-Math.max(1, limit));
}

function buildDailyTrendFromSnapshots(
  rows: AnalyticsDailyOverviewSnapshotRow[],
  limit: number
): AnalyticsDailyTrendItem[] {
  const grouped = new Map<string, AnalyticsDailyTrendItem>();
  rows.forEach((row) => {
    const bucket =
      grouped.get(row.snapshotDate) || {
        snapshot_date: row.snapshotDate,
        report_count: 0,
        store_count: 0,
        result_count: 0,
        issue_count: 0,
        pending_review_count: 0,
        rectification_order_count: 0,
        rectification_completed_count: 0,
        rectification_close_rate: 0
      };
    bucket.report_count += row.reportCount;
    bucket.store_count += row.storeCount;
    bucket.result_count += row.resultCount;
    bucket.issue_count += row.issueCount;
    bucket.pending_review_count += row.pendingReviewCount;
    bucket.rectification_order_count += row.rectificationOrderCount;
    bucket.rectification_completed_count += row.rectificationCompletedCount;
    grouped.set(row.snapshotDate, bucket);
  });

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      rectification_close_rate:
        row.rectification_order_count > 0
          ? Math.round((row.rectification_completed_count / row.rectification_order_count) * 100)
          : 0
    }))
    .sort((left, right) => left.snapshot_date.localeCompare(right.snapshot_date))
    .slice(-Math.max(1, limit));
}

function buildOrganizationRanking(
  resultRows: AnalyticsResultFactRow[],
  issueRows: AnalyticsIssueFactRow[],
  limit: number
): AnalyticsOrganizationRankingItem[] {
  const stats = new Map<
    string,
    {
      organizationCode: string;
      storeIds: Set<string>;
      resultCount: number;
      issueCount: number;
      issueResultIds: Set<number>;
      pendingReviewCount: number;
      rectificationRequiredCount: number;
    }
  >();

  resultRows.forEach((row) => {
    const key = String(row.organizationCode || "__unknown__").trim() || "__unknown__";
    const organizationName = String(row.organizationName || "未归属组织").trim() || "未归属组织";
    const bucket =
      stats.get(key) || {
        organizationCode: key === "__unknown__" ? "" : key,
        storeIds: new Set<string>(),
        resultCount: 0,
        issueCount: 0,
        issueResultIds: new Set<number>(),
        pendingReviewCount: 0,
        rectificationRequiredCount: 0
      };
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    bucket.resultCount += 1;
    if (row.reviewState !== "completed") {
      bucket.pendingReviewCount += 1;
    }
    if (row.rectificationRequired === 1) {
      bucket.rectificationRequiredCount += 1;
    }
    void organizationName;
    stats.set(key, bucket);
  });

  issueRows.forEach((row) => {
    const key = String(row.organizationCode || "__unknown__").trim() || "__unknown__";
    const bucket =
      stats.get(key) || {
        organizationCode: key === "__unknown__" ? "" : key,
        storeIds: new Set<string>(),
        resultCount: 0,
        issueCount: 0,
        issueResultIds: new Set<number>(),
        pendingReviewCount: 0,
        rectificationRequiredCount: 0
      };
    bucket.issueCount += 1;
    if (row.resultId) {
      bucket.issueResultIds.add(row.resultId);
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.entries())
    .map(([key, value]) => ({
      organization_code: value.organizationCode,
      organization_name: key === "__unknown__" ? "未归属组织" : resultRows.find((row) => row.organizationCode === value.organizationCode)?.organizationName || issueRows.find((row) => row.organizationCode === value.organizationCode)?.organizationName || "未归属组织",
      store_count: value.storeIds.size,
      result_count: value.resultCount,
      issue_count: value.issueCount,
      issue_result_count: value.issueResultIds.size,
      pending_review_count: value.pendingReviewCount,
      rectification_required_count: value.rectificationRequiredCount
    }))
    .sort(
      (left, right) =>
        right.issue_count - left.issue_count ||
        right.pending_review_count - left.pending_review_count ||
        left.organization_name.localeCompare(right.organization_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildFranchiseeRanking(
  resultRows: AnalyticsResultFactRow[],
  issueRows: AnalyticsIssueFactRow[],
  limit: number
): AnalyticsFranchiseeRankingItem[] {
  const stats = new Map<
    string,
    {
      storeIds: Set<string>;
      resultCount: number;
      issueCount: number;
      issueResultIds: Set<number>;
      pendingReviewCount: number;
      rectificationRequiredCount: number;
    }
  >();

  resultRows.forEach((row) => {
    const key = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        storeIds: new Set<string>(),
        resultCount: 0,
        issueCount: 0,
        issueResultIds: new Set<number>(),
        pendingReviewCount: 0,
        rectificationRequiredCount: 0
      };
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    bucket.resultCount += 1;
    if (row.reviewState !== "completed") {
      bucket.pendingReviewCount += 1;
    }
    if (row.rectificationRequired === 1) {
      bucket.rectificationRequiredCount += 1;
    }
    stats.set(key, bucket);
  });

  issueRows.forEach((row) => {
    const key = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        storeIds: new Set<string>(),
        resultCount: 0,
        issueCount: 0,
        issueResultIds: new Set<number>(),
        pendingReviewCount: 0,
        rectificationRequiredCount: 0
      };
    bucket.issueCount += 1;
    if (row.resultId) {
      bucket.issueResultIds.add(row.resultId);
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.entries())
    .map(([franchiseeName, value]) => ({
      franchisee_name: franchiseeName,
      store_count: value.storeIds.size,
      result_count: value.resultCount,
      issue_count: value.issueCount,
      issue_result_count: value.issueResultIds.size,
      pending_review_count: value.pendingReviewCount,
      rectification_required_count: value.rectificationRequiredCount
    }))
    .sort(
      (left, right) =>
        right.issue_count - left.issue_count ||
        right.pending_review_count - left.pending_review_count ||
        left.franchisee_name.localeCompare(right.franchisee_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildFranchiseeCloseRateRanking(
  resultRows: AnalyticsResultFactRow[],
  rectificationRows: AnalyticsRectificationFactRow[],
  limit: number
): AnalyticsFranchiseeCloseRateItem[] {
  const stats = new Map<
    string,
    {
      storeIds: Set<string>;
      orderCount: number;
      completedCount: number;
      overdueCount: number;
    }
  >();

  const franchiseeByResultId = new Map(resultRows.map((row) => [row.resultId, String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商"] as const));
  const storeByResultId = new Map(resultRows.map((row) => [row.resultId, row.storeId] as const));

  rectificationRows.forEach((row) => {
    const key = String(row.franchiseeName || franchiseeByResultId.get(row.resultId) || "未归属加盟商").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        storeIds: new Set<string>(),
        orderCount: 0,
        completedCount: 0,
        overdueCount: 0
      };
    bucket.orderCount += 1;
    const storeId = row.storeId || storeByResultId.get(row.resultId) || null;
    if (storeId) {
      bucket.storeIds.add(storeId);
    }
    if (normalizeRemoteIfCorrected(row.remoteIfCorrected) === "1") {
      bucket.completedCount += 1;
    }
    if (row.overdue === 1) {
      bucket.overdueCount += 1;
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.entries())
    .map(([franchiseeName, value]) => ({
      franchisee_name: franchiseeName,
      store_count: value.storeIds.size,
      order_count: value.orderCount,
      completed_count: value.completedCount,
      overdue_count: value.overdueCount,
      close_rate: value.orderCount > 0 ? Math.round((value.completedCount / value.orderCount) * 100) : 0
    }))
    .sort(
      (left, right) =>
        left.close_rate - right.close_rate ||
        right.overdue_count - left.overdue_count ||
        right.order_count - left.order_count ||
        left.franchisee_name.localeCompare(right.franchisee_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildOrganizationGovernanceRanking(
  resultRows: AnalyticsResultFactRow[],
  rectificationRows: AnalyticsRectificationFactRow[],
  limit: number
): AnalyticsOrganizationGovernanceItem[] {
  const stats = new Map<
    string,
    {
      organizationCode: string;
      organizationName: string;
      storeIds: Set<string>;
      franchiseeNames: Set<string>;
      pendingReviewCount: number;
      overdueCount: number;
      franchiseeRisk: Map<string, { pendingReviewCount: number; overdueCount: number }>;
    }
  >();

  resultRows.forEach((row) => {
    const organizationCode = String(row.organizationCode || "").trim();
    const organizationName = String(row.organizationName || "未归属组织").trim() || "未归属组织";
    const key = organizationCode || `__unknown__:${organizationName}`;
    const bucket =
      stats.get(key) || {
        organizationCode,
        organizationName,
        storeIds: new Set<string>(),
        franchiseeNames: new Set<string>(),
        pendingReviewCount: 0,
        overdueCount: 0,
        franchiseeRisk: new Map<string, { pendingReviewCount: number; overdueCount: number }>()
      };
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    const franchiseeName = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    bucket.franchiseeNames.add(franchiseeName);
    if (row.reviewState !== "completed") {
      bucket.pendingReviewCount += 1;
      const risk = bucket.franchiseeRisk.get(franchiseeName) || { pendingReviewCount: 0, overdueCount: 0 };
      risk.pendingReviewCount += 1;
      bucket.franchiseeRisk.set(franchiseeName, risk);
    }
    stats.set(key, bucket);
  });

  rectificationRows.forEach((row) => {
    const organizationCode = String(row.organizationCode || "").trim();
    const organizationName = String(row.organizationName || "未归属组织").trim() || "未归属组织";
    const key = organizationCode || `__unknown__:${organizationName}`;
    const bucket =
      stats.get(key) || {
        organizationCode,
        organizationName,
        storeIds: new Set<string>(),
        franchiseeNames: new Set<string>(),
        pendingReviewCount: 0,
        overdueCount: 0,
        franchiseeRisk: new Map<string, { pendingReviewCount: number; overdueCount: number }>()
      };
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    const franchiseeName = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    bucket.franchiseeNames.add(franchiseeName);
    if (row.overdue === 1) {
      bucket.overdueCount += 1;
      const risk = bucket.franchiseeRisk.get(franchiseeName) || { pendingReviewCount: 0, overdueCount: 0 };
      risk.overdueCount += 1;
      bucket.franchiseeRisk.set(franchiseeName, risk);
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.values())
    .map((item) => {
      const highRiskFranchiseeCount = Array.from(item.franchiseeRisk.values()).filter(
        (risk) => risk.pendingReviewCount > 0 || risk.overdueCount > 0
      ).length;
      return {
        organization_code: item.organizationCode,
        organization_name: item.organizationName,
        store_count: item.storeIds.size,
        franchisee_count: item.franchiseeNames.size,
        pending_review_count: item.pendingReviewCount,
        overdue_count: item.overdueCount,
        high_risk_franchisee_count: highRiskFranchiseeCount,
        governance_score: item.pendingReviewCount * 2 + item.overdueCount * 3 + highRiskFranchiseeCount * 2
      };
    })
    .filter((item) => item.governance_score > 0)
    .sort(
      (left, right) =>
        right.governance_score - left.governance_score ||
        right.overdue_count - left.overdue_count ||
        right.pending_review_count - left.pending_review_count ||
        left.organization_name.localeCompare(right.organization_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildHighRiskFranchisees(
  resultRows: AnalyticsResultFactRow[],
  issueRows: AnalyticsIssueFactRow[],
  rectificationRows: AnalyticsRectificationFactRow[],
  limit: number
): AnalyticsHighRiskFranchiseeItem[] {
  const stats = new Map<
    string,
    {
      storeIds: Set<string>;
      issueCount: number;
      pendingReviewCount: number;
      overdueCount: number;
    }
  >();

  resultRows.forEach((row) => {
    const key = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        storeIds: new Set<string>(),
        issueCount: 0,
        pendingReviewCount: 0,
        overdueCount: 0
      };
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    if (row.reviewState !== "completed") {
      bucket.pendingReviewCount += 1;
    }
    stats.set(key, bucket);
  });

  issueRows.forEach((row) => {
    const key = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        storeIds: new Set<string>(),
        issueCount: 0,
        pendingReviewCount: 0,
        overdueCount: 0
      };
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    bucket.issueCount += 1;
    stats.set(key, bucket);
  });

  rectificationRows.forEach((row) => {
    const key = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        storeIds: new Set<string>(),
        issueCount: 0,
        pendingReviewCount: 0,
        overdueCount: 0
      };
    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    if (row.overdue === 1) {
      bucket.overdueCount += 1;
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.entries())
    .map(([franchiseeName, value]) => ({
      franchisee_name: franchiseeName,
      store_count: value.storeIds.size,
      issue_count: value.issueCount,
      pending_review_count: value.pendingReviewCount,
      overdue_count: value.overdueCount,
      risk_score: value.issueCount + value.pendingReviewCount * 2 + value.overdueCount * 3
    }))
    .filter((row) => row.risk_score > 0)
    .sort(
      (left, right) =>
        right.risk_score - left.risk_score ||
        right.overdue_count - left.overdue_count ||
        right.pending_review_count - left.pending_review_count ||
        left.franchisee_name.localeCompare(right.franchisee_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildRecurringStores(
  resultRows: AnalyticsResultFactRow[],
  limit: number
): AnalyticsRecurringStoreItem[] {
  const stats = new Map<
    string,
    {
      storeId: string;
      storeName: string;
      franchiseeName: string;
      organizationName: string;
      abnormalResultCount: number;
      abnormalDays: Set<string>;
      issueCount: number;
      pendingReviewCount: number;
    }
  >();

  resultRows.forEach((row) => {
    if (row.resultSemanticState === "pass") {
      return;
    }
    const key = String(row.storeId || "").trim();
    if (!key) {
      return;
    }
    const bucket =
      stats.get(key) || {
        storeId: key,
        storeName: String(row.storeName || "未命名门店").trim() || "未命名门店",
        franchiseeName: String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商",
        organizationName: String(row.organizationName || "未归属组织").trim() || "未归属组织",
        abnormalResultCount: 0,
        abnormalDays: new Set<string>(),
        issueCount: 0,
        pendingReviewCount: 0
      };
    bucket.abnormalResultCount += 1;
    if (row.publishedDate) {
      bucket.abnormalDays.add(row.publishedDate);
    }
    bucket.issueCount += row.issueCount;
    if (row.reviewState !== "completed") {
      bucket.pendingReviewCount += 1;
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.values())
    .map((item) => ({
      store_id: item.storeId,
      store_name: item.storeName,
      franchisee_name: item.franchiseeName,
      organization_name: item.organizationName,
      abnormal_result_count: item.abnormalResultCount,
      abnormal_day_count: item.abnormalDays.size,
      issue_count: item.issueCount,
      pending_review_count: item.pendingReviewCount
    }))
    .filter((item) => item.abnormal_day_count >= 2 || item.abnormal_result_count >= 2)
    .sort(
      (left, right) =>
        right.abnormal_day_count - left.abnormal_day_count ||
        right.abnormal_result_count - left.abnormal_result_count ||
        right.issue_count - left.issue_count ||
        left.store_name.localeCompare(right.store_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildRecurringFranchisees(
  resultRows: AnalyticsResultFactRow[],
  rectificationRows: AnalyticsRectificationFactRow[],
  limit: number
): AnalyticsRecurringFranchiseeItem[] {
  const recurringStores = buildRecurringStores(resultRows, Number.MAX_SAFE_INTEGER);
  const overdueByFranchisee = new Map<string, number>();

  rectificationRows.forEach((row) => {
    if (row.overdue !== 1) {
      return;
    }
    const key = String(row.franchiseeName || "未归属加盟商").trim() || "未归属加盟商";
    overdueByFranchisee.set(key, (overdueByFranchisee.get(key) || 0) + 1);
  });

  const stats = new Map<
    string,
    {
      storeIds: Set<string>;
      recurringStoreIds: Set<string>;
      abnormalResultCount: number;
      abnormalDayCount: number;
    }
  >();

  recurringStores.forEach((item) => {
    const key = String(item.franchisee_name || "未归属加盟商").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        storeIds: new Set<string>(),
        recurringStoreIds: new Set<string>(),
        abnormalResultCount: 0,
        abnormalDayCount: 0
      };
    bucket.storeIds.add(item.store_id);
    bucket.recurringStoreIds.add(item.store_id);
    bucket.abnormalResultCount += item.abnormal_result_count;
    bucket.abnormalDayCount += item.abnormal_day_count;
    stats.set(key, bucket);
  });

  return Array.from(stats.entries())
    .map(([franchiseeName, value]) => {
      const overdueCount = overdueByFranchisee.get(franchiseeName) || 0;
      return {
        franchisee_name: franchiseeName,
        store_count: value.storeIds.size,
        recurring_store_count: value.recurringStoreIds.size,
        abnormal_result_count: value.abnormalResultCount,
        abnormal_day_count: value.abnormalDayCount,
        overdue_count: overdueCount,
        risk_score: value.recurringStoreIds.size * 3 + value.abnormalDayCount * 2 + overdueCount * 3
      };
    })
    .filter((item) => item.recurring_store_count > 0)
    .sort(
      (left, right) =>
        right.risk_score - left.risk_score ||
        right.recurring_store_count - left.recurring_store_count ||
        right.overdue_count - left.overdue_count ||
        left.franchisee_name.localeCompare(right.franchisee_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildStoreRanking(
  resultRows: AnalyticsResultFactRow[],
  issueRows: AnalyticsIssueFactRow[],
  limit: number
): AnalyticsStoreRankingItem[] {
  const stats = new Map<
    string,
    {
      storeId: string;
      storeName: string;
      franchiseeName: string;
      organizationName: string;
      resultCount: number;
      issueCount: number;
      issueResultIds: Set<number>;
      pendingReviewCount: number;
      rectificationRequiredCount: number;
    }
  >();

  resultRows.forEach((row) => {
    const key = String(row.storeId || "").trim();
    if (!key) {
      return;
    }
    const bucket =
      stats.get(key) || {
        storeId: key,
        storeName: String(row.storeName || key),
        franchiseeName: String(row.franchiseeName || "未归属加盟商"),
        organizationName: String(row.organizationName || "未归属组织"),
        resultCount: 0,
        issueCount: 0,
        issueResultIds: new Set<number>(),
        pendingReviewCount: 0,
        rectificationRequiredCount: 0
      };
    bucket.resultCount += 1;
    if (row.reviewState !== "completed") {
      bucket.pendingReviewCount += 1;
    }
    if (row.rectificationRequired === 1) {
      bucket.rectificationRequiredCount += 1;
    }
    stats.set(key, bucket);
  });

  issueRows.forEach((row) => {
    const key = String(row.storeId || "").trim();
    if (!key) {
      return;
    }
    const bucket =
      stats.get(key) || {
        storeId: key,
        storeName: String(row.storeName || key),
        franchiseeName: String(row.franchiseeName || "未归属加盟商"),
        organizationName: String(row.organizationName || "未归属组织"),
        resultCount: 0,
        issueCount: 0,
        issueResultIds: new Set<number>(),
        pendingReviewCount: 0,
        rectificationRequiredCount: 0
      };
    bucket.issueCount += 1;
    if (row.resultId) {
      bucket.issueResultIds.add(row.resultId);
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.values())
    .map((value) => ({
      store_id: value.storeId,
      store_name: value.storeName,
      franchisee_name: value.franchiseeName,
      organization_name: value.organizationName,
      result_count: value.resultCount,
      issue_count: value.issueCount,
      issue_result_count: value.issueResultIds.size,
      pending_review_count: value.pendingReviewCount,
      rectification_required_count: value.rectificationRequiredCount
    }))
    .sort(
      (left, right) =>
        right.issue_count - left.issue_count ||
        right.pending_review_count - left.pending_review_count ||
        left.store_name.localeCompare(right.store_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildRectificationOverdueRanking(
  rectificationRows: AnalyticsRectificationFactRow[],
  limit: number
): AnalyticsRectificationOverdueRankingItem[] {
  const stats = new Map<
    string,
    {
      storeId: string;
      storeName: string;
      organizationName: string;
      overdueCount: number;
      pendingCount: number;
      nearestDueDate: string | null;
    }
  >();

  rectificationRows.forEach((row) => {
    const key = String(row.storeId || "").trim();
    if (!key) {
      return;
    }
    const bucket =
      stats.get(key) || {
        storeId: key,
        storeName: String(row.storeName || key),
        organizationName: String(row.organizationName || "未归属组织"),
        overdueCount: 0,
        pendingCount: 0,
        nearestDueDate: null
      };
    if (normalizeRemoteIfCorrected(row.remoteIfCorrected) !== "1") {
      bucket.pendingCount += 1;
    }
    if (row.overdue === 1) {
      bucket.overdueCount += 1;
      const dueDate = String(row.shouldCorrectedDate || "").trim();
      if (dueDate && (!bucket.nearestDueDate || dueDate < bucket.nearestDueDate)) {
        bucket.nearestDueDate = dueDate;
      }
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.values())
    .filter((row) => row.overdueCount > 0)
    .map((row) => ({
      store_id: row.storeId,
      store_name: row.storeName,
      organization_name: row.organizationName,
      overdue_count: row.overdueCount,
      pending_count: row.pendingCount,
      nearest_due_date: row.nearestDueDate
    }))
    .sort(
      (left, right) =>
        right.overdue_count - left.overdue_count ||
        right.pending_count - left.pending_count ||
        left.store_name.localeCompare(right.store_name)
    )
    .slice(0, Math.max(1, limit));
}

function buildOverdueFranchisees(
  rectificationRows: AnalyticsRectificationFactRow[],
  limit: number
): AnalyticsOverdueFranchiseeItem[] {
  const stats = new Map<
    string,
    {
      franchiseeName: string;
      storeIds: Set<string>;
      overdueCount: number;
      pendingCount: number;
      nearestDueDate: string | null;
    }
  >();

  rectificationRows.forEach((row) => {
    const key = String(row.franchiseeName || "").trim() || "未归属加盟商";
    const bucket =
      stats.get(key) || {
        franchiseeName: key,
        storeIds: new Set<string>(),
        overdueCount: 0,
        pendingCount: 0,
        nearestDueDate: null
      };

    if (row.storeId) {
      bucket.storeIds.add(row.storeId);
    }
    if (normalizeRemoteIfCorrected(row.remoteIfCorrected) !== "1") {
      bucket.pendingCount += 1;
    }
    if (row.overdue === 1) {
      bucket.overdueCount += 1;
      const dueDate = String(row.shouldCorrectedDate || "").trim();
      if (dueDate && (!bucket.nearestDueDate || dueDate < bucket.nearestDueDate)) {
        bucket.nearestDueDate = dueDate;
      }
    }
    stats.set(key, bucket);
  });

  return Array.from(stats.values())
    .filter((item) => item.overdueCount > 0)
    .map((item) => ({
      franchisee_name: item.franchiseeName,
      store_count: item.storeIds.size,
      overdue_count: item.overdueCount,
      pending_count: item.pendingCount,
      nearest_due_date: item.nearestDueDate
    }))
    .sort(
      (left, right) =>
        right.overdue_count - left.overdue_count ||
        right.pending_count - left.pending_count ||
        left.franchisee_name.localeCompare(right.franchisee_name)
    )
    .slice(0, Math.max(1, limit));
}

export class SqliteAnalyticsRepository implements AnalyticsRepository {
  private loadSnapshotDataset(filters: AnalyticsFilters, context: RequestContext): LoadedSnapshotDataset {
    if (!canUseDailySnapshots(filters)) {
      return {
        overviewRows: [],
        semanticRows: []
      };
    }

    const overviewRows = db
      .select()
      .from(analyticsDailyOverviewSnapshotTable)
      .where(
        and(
          filters.startDate ? gte(analyticsDailyOverviewSnapshotTable.snapshotDate, filters.startDate) : undefined,
          filters.endDate ? lte(analyticsDailyOverviewSnapshotTable.snapshotDate, filters.endDate) : undefined,
          filters.enterpriseId ? eq(analyticsDailyOverviewSnapshotTable.sourceEnterpriseId, filters.enterpriseId) : undefined
        )
      )
      .all()
      .filter((row) => canAccessEnterprise(context, row.sourceEnterpriseId));

    const semanticRows = db
      .select()
      .from(analyticsDailySemanticSnapshotTable)
      .where(
        and(
          filters.startDate ? gte(analyticsDailySemanticSnapshotTable.snapshotDate, filters.startDate) : undefined,
          filters.endDate ? lte(analyticsDailySemanticSnapshotTable.snapshotDate, filters.endDate) : undefined,
          filters.enterpriseId ? eq(analyticsDailySemanticSnapshotTable.sourceEnterpriseId, filters.enterpriseId) : undefined
        )
      )
      .all()
      .filter((row) => canAccessEnterprise(context, row.sourceEnterpriseId));

    return {
      overviewRows,
      semanticRows
    };
  }

  private loadDataset(filters: AnalyticsFilters, context: RequestContext): LoadedAnalyticsDataset {
    const reportWhere = [];
    if (filters.enterpriseId) {
      if (!canAccessEnterprise(context, filters.enterpriseId)) {
        return {
          reportRows: [],
          resultFactRows: [],
          issueFactRows: [],
          reviewFactRows: [],
          rectificationFactRows: []
        };
      }
      reportWhere.push(eq(reportTable.sourceEnterpriseId, filters.enterpriseId));
    }
    if (filters.reportType) {
      reportWhere.push(eq(reportTable.reportType, filters.reportType));
    }
    if (filters.startDate) {
      reportWhere.push(gte(reportTable.publishedAt, normalizeDateBoundaryStart(filters.startDate)));
    }
    if (filters.endDate) {
      reportWhere.push(lte(reportTable.publishedAt, normalizeDateBoundaryEnd(filters.endDate)));
    }

    const rawReportRows = db
      .select()
      .from(reportTable)
      .where(reportWhere.length > 0 ? and(...reportWhere) : undefined)
      .all()
      .filter((row) => canAccessEnterprise(context, row.sourceEnterpriseId));

    const reportRows = rawReportRows.filter((row) => {
      const extensions = safeParseRecord(row.extensionsJson);
      if (filters.topic && readString(extensions, "report_topic") !== filters.topic) {
        return false;
      }
      if (filters.planId && readString(extensions, "plan_id") !== filters.planId) {
        return false;
      }
      return true;
    });

    if (reportRows.length === 0) {
      return {
        reportRows: [],
        resultFactRows: [],
        issueFactRows: [],
        reviewFactRows: [],
        rectificationFactRows: []
      };
    }

    const reportIds = reportRows.map((row) => row.id);
    const userScopedStoreIds = resolveScopedStoreIds(context, filters.enterpriseId);
    const requestedScopedStoreIds = resolveStoreIdsFromScope(
      {
        enterpriseScopeIds: filters.enterpriseId ? [filters.enterpriseId] : [],
        organizationScopeIds: filters.organizationId ? [filters.organizationId] : [],
        storeScopeIds: filters.storeId ? [filters.storeId] : []
      },
      filters.enterpriseId
    );
    const effectiveStoreIds = intersectScopedIds(userScopedStoreIds, requestedScopedStoreIds);

    const resultFactRows = db
      .select()
      .from(analyticsResultFactTable)
      .where(inArray(analyticsResultFactTable.reportId, reportIds))
      .all()
      .filter((row) => (!effectiveStoreIds || (row.storeId ? effectiveStoreIds.includes(row.storeId) : false)))
      .filter((row) => !filters.franchiseeName || row.franchiseeName === filters.franchiseeName)
      .filter((row) => !filters.organizationId || row.organizationCode === filters.organizationId);

    const visibleReportIds = resultFactRows.length > 0 ? Array.from(new Set(resultFactRows.map((row) => row.reportId))) : [];
    if (visibleReportIds.length === 0) {
      return {
        reportRows: [],
        resultFactRows: [],
        issueFactRows: [],
        reviewFactRows: [],
        rectificationFactRows: []
      };
    }

    const issueFactRows = db
      .select()
      .from(analyticsIssueFactTable)
      .where(inArray(analyticsIssueFactTable.reportId, visibleReportIds))
      .all()
      .filter((row) => (!effectiveStoreIds || (row.storeId ? effectiveStoreIds.includes(row.storeId) : false)))
      .filter((row) => !filters.franchiseeName || row.franchiseeName === filters.franchiseeName)
      .filter((row) => !filters.organizationId || row.organizationCode === filters.organizationId);

    const reviewFactRows = db
      .select()
      .from(analyticsReviewFactTable)
      .where(inArray(analyticsReviewFactTable.reportId, visibleReportIds))
      .all()
      .filter((row) => (!effectiveStoreIds || (row.storeId ? effectiveStoreIds.includes(row.storeId) : false)))
      .filter((row) => !filters.franchiseeName || row.franchiseeName === filters.franchiseeName)
      .filter((row) => !filters.organizationId || row.organizationCode === filters.organizationId);

    const resultIds = resultFactRows.map((row) => row.resultId);
    const rectificationFactRows = resultIds.length
      ? db
          .select()
          .from(analyticsRectificationFactTable)
          .where(inArray(analyticsRectificationFactTable.resultId, resultIds))
          .all()
          .filter((row) => !filters.franchiseeName || row.franchiseeName === filters.franchiseeName)
          .filter((row) => !filters.organizationId || row.organizationCode === filters.organizationId)
      : [];

    return {
      reportRows: reportRows.filter((row) => visibleReportIds.includes(row.id)),
      resultFactRows,
      issueFactRows,
      reviewFactRows,
      rectificationFactRows
    };
  }

  getOverview(filters: AnalyticsFilters, context: RequestContext): AnalyticsOverviewMetrics {
    const dataset = this.loadDataset(filters, context);
    return buildOverview(dataset.reportRows, dataset.resultFactRows, dataset.issueFactRows, dataset.rectificationFactRows);
  }

  getResultSemanticDistribution(filters: AnalyticsFilters, context: RequestContext): AnalyticsSemanticDistributionItem[] {
    const snapshotDataset = this.loadSnapshotDataset(filters, context);
    if (snapshotDataset.semanticRows.length > 0) {
      return buildSemanticDistributionFromSnapshots(snapshotDataset.semanticRows);
    }
    const dataset = this.loadDataset(filters, context);
    return buildSemanticDistribution(dataset.resultFactRows);
  }

  getDailyTrend(filters: AnalyticsFilters, context: RequestContext, limit = 14): AnalyticsDailyTrendItem[] {
    const snapshotDataset = this.loadSnapshotDataset(filters, context);
    if (snapshotDataset.overviewRows.length > 0) {
      return buildDailyTrendFromSnapshots(snapshotDataset.overviewRows, limit);
    }
    const dataset = this.loadDataset(filters, context);
    return buildDailyTrendFromFacts(dataset.reportRows, dataset.resultFactRows, dataset.rectificationFactRows, limit);
  }

  getIssueTypeRanking(filters: AnalyticsFilters, context: RequestContext, limit = 10): AnalyticsIssueTypeRankingItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildIssueTypeRanking(dataset.issueFactRows, limit);
  }

  getSkillDistribution(filters: AnalyticsFilters, context: RequestContext, limit = 10): AnalyticsSkillDistributionItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildSkillDistribution(dataset.issueFactRows, limit);
  }

  getSeverityDistribution(filters: AnalyticsFilters, context: RequestContext): AnalyticsSeverityDistributionItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildSeverityDistribution(dataset.issueFactRows);
  }

  getOrganizationRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsOrganizationRankingItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildOrganizationRanking(dataset.resultFactRows, dataset.issueFactRows, limit);
  }

  getOrganizationGovernanceRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsOrganizationGovernanceItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildOrganizationGovernanceRanking(dataset.resultFactRows, dataset.rectificationFactRows, limit);
  }

  getFranchiseeRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsFranchiseeRankingItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildFranchiseeRanking(dataset.resultFactRows, dataset.issueFactRows, limit);
  }

  getFranchiseeCloseRateRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsFranchiseeCloseRateItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildFranchiseeCloseRateRanking(dataset.resultFactRows, dataset.rectificationFactRows, limit);
  }

  getHighRiskFranchisees(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsHighRiskFranchiseeItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildHighRiskFranchisees(dataset.resultFactRows, dataset.issueFactRows, dataset.rectificationFactRows, limit);
  }

  getRecurringStores(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsRecurringStoreItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildRecurringStores(dataset.resultFactRows, limit);
  }

  getRecurringFranchisees(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsRecurringFranchiseeItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildRecurringFranchisees(dataset.resultFactRows, dataset.rectificationFactRows, limit);
  }

  getStoreRanking(filters: AnalyticsFilters, context: RequestContext, limit = 10): AnalyticsStoreRankingItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildStoreRanking(dataset.resultFactRows, dataset.issueFactRows, limit);
  }

  getReviewEfficiency(filters: AnalyticsFilters, context: RequestContext): AnalyticsReviewEfficiencyMetrics {
    const dataset = this.loadDataset(filters, context);
    return buildReviewEfficiency(dataset.reviewFactRows);
  }

  getReviewStatusDistribution(filters: AnalyticsFilters, context: RequestContext): AnalyticsReviewStatusDistributionItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildReviewStatusDistribution(dataset.resultFactRows);
  }

  getRectificationOverdueRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsRectificationOverdueRankingItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildRectificationOverdueRanking(dataset.rectificationFactRows, limit);
  }

  getOverdueFranchisees(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit = 10
  ): AnalyticsOverdueFranchiseeItem[] {
    const dataset = this.loadDataset(filters, context);
    return buildOverdueFranchisees(dataset.rectificationFactRows, limit);
  }

  getRectificationOverview(filters: AnalyticsFilters, context: RequestContext): AnalyticsRectificationOverviewMetrics {
    const dataset = this.loadDataset(filters, context);
    return buildRectificationOverview(dataset.rectificationFactRows);
  }

  getDashboard(filters: AnalyticsFilters, context: RequestContext, issueTypeLimit = 10): AnalyticsDashboard {
    const snapshotDataset = this.loadSnapshotDataset(filters, context);
    const dataset = this.loadDataset(filters, context);
    return {
      overview: buildOverview(dataset.reportRows, dataset.resultFactRows, dataset.issueFactRows, dataset.rectificationFactRows),
      semantic_distribution:
        snapshotDataset.semanticRows.length > 0
          ? buildSemanticDistributionFromSnapshots(snapshotDataset.semanticRows)
          : buildSemanticDistribution(dataset.resultFactRows),
      daily_trend:
        snapshotDataset.overviewRows.length > 0
          ? buildDailyTrendFromSnapshots(snapshotDataset.overviewRows, 14)
          : buildDailyTrendFromFacts(dataset.reportRows, dataset.resultFactRows, dataset.rectificationFactRows, 14),
      issue_type_ranking: buildIssueTypeRanking(dataset.issueFactRows, issueTypeLimit),
      skill_distribution: buildSkillDistribution(dataset.issueFactRows, issueTypeLimit),
      severity_distribution: buildSeverityDistribution(dataset.issueFactRows),
      organization_ranking: buildOrganizationRanking(dataset.resultFactRows, dataset.issueFactRows, 10),
      organization_governance_ranking: buildOrganizationGovernanceRanking(
        dataset.resultFactRows,
        dataset.rectificationFactRows,
        10
      ),
      franchisee_ranking: buildFranchiseeRanking(dataset.resultFactRows, dataset.issueFactRows, 10),
      franchisee_close_rate_ranking: buildFranchiseeCloseRateRanking(
        dataset.resultFactRows,
        dataset.rectificationFactRows,
        10
      ),
      high_risk_franchisees: buildHighRiskFranchisees(
        dataset.resultFactRows,
        dataset.issueFactRows,
        dataset.rectificationFactRows,
        10
      ),
      recurring_stores: buildRecurringStores(dataset.resultFactRows, 10),
      recurring_franchisees: buildRecurringFranchisees(dataset.resultFactRows, dataset.rectificationFactRows, 10),
      store_ranking: buildStoreRanking(dataset.resultFactRows, dataset.issueFactRows, 10),
      review_efficiency: buildReviewEfficiency(dataset.reviewFactRows),
      review_status_distribution: buildReviewStatusDistribution(dataset.resultFactRows),
      rectification_overdue_ranking: buildRectificationOverdueRanking(dataset.rectificationFactRows, 10),
      overdue_franchisees: buildOverdueFranchisees(dataset.rectificationFactRows, 10),
      rectification_overview: buildRectificationOverview(dataset.rectificationFactRows)
    };
  }
}
