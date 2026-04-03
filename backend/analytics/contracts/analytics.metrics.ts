import type { ReportResultSemanticState } from "@/backend/report/result-semantics";

export interface AnalyticsOverviewMetrics {
  report_count: number;
  store_count: number;
  result_count: number;
  issue_count: number;
  pending_review_count: number;
  completed_review_count: number;
  auto_completed_review_count: number;
  manual_completed_review_count: number;
  rectification_order_count: number;
  rectification_completed_count: number;
  rectification_pending_count: number;
  rectification_overdue_count: number;
  rectification_close_rate: number;
}

export interface AnalyticsSemanticDistributionItem {
  state: ReportResultSemanticState;
  label: string;
  count: number;
  issue_count: number;
}

export interface AnalyticsIssueTypeRankingItem {
  issue_type: string;
  count: number;
  store_count: number;
  result_count: number;
}

export interface AnalyticsSkillDistributionItem {
  skill_id: string;
  skill_name: string;
  count: number;
  store_count: number;
  result_count: number;
}

export interface AnalyticsSeverityDistributionItem {
  severity: string;
  label: string;
  count: number;
  store_count: number;
  result_count: number;
}

export interface AnalyticsOrganizationRankingItem {
  organization_code: string;
  organization_name: string;
  store_count: number;
  result_count: number;
  issue_count: number;
  issue_result_count: number;
  pending_review_count: number;
  rectification_required_count: number;
}

export interface AnalyticsOrganizationGovernanceItem {
  organization_code: string;
  organization_name: string;
  store_count: number;
  franchisee_count: number;
  pending_review_count: number;
  overdue_count: number;
  high_risk_franchisee_count: number;
  governance_score: number;
}

export interface AnalyticsFranchiseeRankingItem {
  franchisee_name: string;
  store_count: number;
  result_count: number;
  issue_count: number;
  issue_result_count: number;
  pending_review_count: number;
  rectification_required_count: number;
}

export interface AnalyticsFranchiseeCloseRateItem {
  franchisee_name: string;
  store_count: number;
  order_count: number;
  completed_count: number;
  overdue_count: number;
  close_rate: number;
}

export interface AnalyticsHighRiskFranchiseeItem {
  franchisee_name: string;
  store_count: number;
  issue_count: number;
  pending_review_count: number;
  overdue_count: number;
  risk_score: number;
}

export interface AnalyticsRecurringStoreItem {
  store_id: string;
  store_name: string;
  franchisee_name: string;
  organization_name: string;
  abnormal_result_count: number;
  abnormal_day_count: number;
  issue_count: number;
  pending_review_count: number;
}

export interface AnalyticsRecurringFranchiseeItem {
  franchisee_name: string;
  store_count: number;
  recurring_store_count: number;
  abnormal_result_count: number;
  abnormal_day_count: number;
  overdue_count: number;
  risk_score: number;
}

export interface AnalyticsStoreRankingItem {
  store_id: string;
  store_name: string;
  franchisee_name: string;
  organization_name: string;
  result_count: number;
  issue_count: number;
  issue_result_count: number;
  pending_review_count: number;
  rectification_required_count: number;
}

export interface AnalyticsDailyTrendItem {
  snapshot_date: string;
  report_count: number;
  store_count: number;
  result_count: number;
  issue_count: number;
  pending_review_count: number;
  rectification_order_count: number;
  rectification_completed_count: number;
  rectification_close_rate: number;
}

export interface AnalyticsReviewEfficiencyMetrics {
  review_action_count: number;
  manual_completed_count: number;
  reopened_count: number;
  operator_count: number;
  average_review_latency_hours: number;
}

export interface AnalyticsReviewStatusDistributionItem {
  review_state: string;
  label: string;
  count: number;
}

export interface AnalyticsRectificationOverdueRankingItem {
  store_id: string;
  store_name: string;
  organization_name: string;
  overdue_count: number;
  pending_count: number;
  nearest_due_date: string | null;
}

export interface AnalyticsRectificationOverviewMetrics {
  order_count: number;
  completed_count: number;
  pending_count: number;
  overdue_count: number;
  sync_failed_count: number;
  close_rate: number;
  average_rectification_duration_days: number;
}

export interface AnalyticsOverdueFranchiseeItem {
  franchisee_name: string;
  store_count: number;
  overdue_count: number;
  pending_count: number;
  nearest_due_date: string | null;
}
