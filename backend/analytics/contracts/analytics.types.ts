import type {
  AnalyticsDailyTrendItem,
  AnalyticsFranchiseeRankingItem,
  AnalyticsFranchiseeCloseRateItem,
  AnalyticsHighRiskFranchiseeItem,
  AnalyticsSkillDistributionItem,
  AnalyticsIssueTypeRankingItem,
  AnalyticsOrganizationGovernanceItem,
  AnalyticsOrganizationRankingItem,
  AnalyticsOverviewMetrics,
  AnalyticsRecurringFranchiseeItem,
  AnalyticsRecurringStoreItem,
  AnalyticsRectificationOverdueRankingItem,
  AnalyticsOverdueFranchiseeItem,
  AnalyticsRectificationOverviewMetrics,
  AnalyticsReviewEfficiencyMetrics,
  AnalyticsReviewStatusDistributionItem,
  AnalyticsSeverityDistributionItem,
  AnalyticsSemanticDistributionItem,
  AnalyticsStoreRankingItem
} from "@/backend/analytics/contracts/analytics.metrics";

export interface AnalyticsDashboard {
  overview: AnalyticsOverviewMetrics;
  semantic_distribution: AnalyticsSemanticDistributionItem[];
  daily_trend: AnalyticsDailyTrendItem[];
  issue_type_ranking: AnalyticsIssueTypeRankingItem[];
  skill_distribution: AnalyticsSkillDistributionItem[];
  severity_distribution: AnalyticsSeverityDistributionItem[];
  organization_ranking: AnalyticsOrganizationRankingItem[];
  organization_governance_ranking: AnalyticsOrganizationGovernanceItem[];
  franchisee_ranking: AnalyticsFranchiseeRankingItem[];
  franchisee_close_rate_ranking: AnalyticsFranchiseeCloseRateItem[];
  high_risk_franchisees: AnalyticsHighRiskFranchiseeItem[];
  recurring_stores: AnalyticsRecurringStoreItem[];
  recurring_franchisees: AnalyticsRecurringFranchiseeItem[];
  store_ranking: AnalyticsStoreRankingItem[];
  review_efficiency: AnalyticsReviewEfficiencyMetrics;
  review_status_distribution: AnalyticsReviewStatusDistributionItem[];
  rectification_overdue_ranking: AnalyticsRectificationOverdueRankingItem[];
  overdue_franchisees: AnalyticsOverdueFranchiseeItem[];
  rectification_overview: AnalyticsRectificationOverviewMetrics;
}
