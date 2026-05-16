import type { RequestContext } from "@/backend/auth/request-context";
import type { AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import type {
  AnalyticsDashboard,
  AnalyticsDashboardPageData,
  AnalyticsFilterOptions
} from "@/backend/analytics/contracts/analytics.types";
import type {
  AnalyticsDailyTrendItem,
  AnalyticsFranchiseeCloseRateItem,
  AnalyticsFranchiseeRankingItem,
  AnalyticsHighRiskFranchiseeItem,
  AnalyticsSkillDistributionItem,
  AnalyticsIssueTypeRankingItem,
  AnalyticsOrganizationGovernanceItem,
  AnalyticsOrganizationRankingItem,
  AnalyticsOverviewMetrics,
  AnalyticsOverdueFranchiseeItem,
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

export interface AnalyticsRepository {
  getOverview(filters: AnalyticsFilters, context: RequestContext): any;
  getResultSemanticDistribution(filters: AnalyticsFilters, context: RequestContext): any;
  getDailyTrend(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getIssueTypeRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getSkillDistribution(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getSeverityDistribution(filters: AnalyticsFilters, context: RequestContext): any;
  getOrganizationRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getOrganizationGovernanceRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit?: number
  ): any;
  getFranchiseeRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getFranchiseeCloseRateRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit?: number
  ): any;
  getHighRiskFranchisees(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getRecurringStores(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getRecurringFranchisees(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getStoreRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getReviewEfficiency(filters: AnalyticsFilters, context: RequestContext): any;
  getReviewStatusDistribution(filters: AnalyticsFilters, context: RequestContext): any;
  getRectificationOverdueRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit?: number
  ): any;
  getOverdueFranchisees(filters: AnalyticsFilters, context: RequestContext, limit?: number): any;
  getRectificationOverview(filters: AnalyticsFilters, context: RequestContext): any;
  getDashboard(filters: AnalyticsFilters, context: RequestContext, issueTypeLimit?: number): any;
  getFilterOptions(filters: AnalyticsFilters, context: RequestContext): any;
  getDashboardPageData(filters: AnalyticsFilters, context: RequestContext, issueTypeLimit?: number): any;
}
