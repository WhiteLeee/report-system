import type { RequestContext } from "@/backend/auth/request-context";
import type { AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import type { AnalyticsDashboard } from "@/backend/analytics/contracts/analytics.types";
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
  getOverview(filters: AnalyticsFilters, context: RequestContext): AnalyticsOverviewMetrics;
  getResultSemanticDistribution(filters: AnalyticsFilters, context: RequestContext): AnalyticsSemanticDistributionItem[];
  getDailyTrend(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsDailyTrendItem[];
  getIssueTypeRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsIssueTypeRankingItem[];
  getSkillDistribution(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsSkillDistributionItem[];
  getSeverityDistribution(filters: AnalyticsFilters, context: RequestContext): AnalyticsSeverityDistributionItem[];
  getOrganizationRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsOrganizationRankingItem[];
  getOrganizationGovernanceRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit?: number
  ): AnalyticsOrganizationGovernanceItem[];
  getFranchiseeRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsFranchiseeRankingItem[];
  getFranchiseeCloseRateRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit?: number
  ): AnalyticsFranchiseeCloseRateItem[];
  getHighRiskFranchisees(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsHighRiskFranchiseeItem[];
  getRecurringStores(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsRecurringStoreItem[];
  getRecurringFranchisees(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsRecurringFranchiseeItem[];
  getStoreRanking(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsStoreRankingItem[];
  getReviewEfficiency(filters: AnalyticsFilters, context: RequestContext): AnalyticsReviewEfficiencyMetrics;
  getReviewStatusDistribution(filters: AnalyticsFilters, context: RequestContext): AnalyticsReviewStatusDistributionItem[];
  getRectificationOverdueRanking(
    filters: AnalyticsFilters,
    context: RequestContext,
    limit?: number
  ): AnalyticsRectificationOverdueRankingItem[];
  getOverdueFranchisees(filters: AnalyticsFilters, context: RequestContext, limit?: number): AnalyticsOverdueFranchiseeItem[];
  getRectificationOverview(filters: AnalyticsFilters, context: RequestContext): AnalyticsRectificationOverviewMetrics;
  getDashboard(filters: AnalyticsFilters, context: RequestContext, issueTypeLimit?: number): AnalyticsDashboard;
}
