import { getSessionUserFromRequest, hasPermission, buildRequestContext } from "@/backend/auth/session";
import { createAnalyticsService } from "@/backend/analytics/analytics.module";
import { normalizeAnalyticsFilters, type AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";

const analyticsService = createAnalyticsService();

function buildFilters(searchParams: URLSearchParams): AnalyticsFilters {
  return normalizeAnalyticsFilters({
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    enterpriseId: searchParams.get("enterpriseId") || "",
    organizationId: searchParams.get("organizationId") || "",
    franchiseeName: searchParams.get("franchiseeName") || "",
    storeId: searchParams.get("storeId") || "",
    reportType: searchParams.get("reportType") || "",
    topic: searchParams.get("topic") || "",
    planId: searchParams.get("planId") || ""
  });
}

function escapeCsvValue(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function buildCsv(dashboard: ReturnType<typeof analyticsService.getDashboard>): string {
  const rows: string[] = [];

  rows.push("section,key,value");
  rows.push(`overview,report_count,${dashboard.overview.report_count}`);
  rows.push(`overview,store_count,${dashboard.overview.store_count}`);
  rows.push(`overview,result_count,${dashboard.overview.result_count}`);
  rows.push(`overview,issue_count,${dashboard.overview.issue_count}`);
  rows.push(`overview,pending_review_count,${dashboard.overview.pending_review_count}`);
  rows.push(`overview,completed_review_count,${dashboard.overview.completed_review_count}`);
  rows.push(`overview,rectification_order_count,${dashboard.overview.rectification_order_count}`);
  rows.push(`overview,rectification_close_rate,${dashboard.overview.rectification_close_rate}`);
  rows.push(`overview,average_rectification_duration_days,${dashboard.rectification_overview.average_rectification_duration_days}`);

  rows.push("");
  rows.push("review_status_distribution,review_state,label,count");
  dashboard.review_status_distribution.forEach((item) => {
    rows.push(
      [
        "review_status_distribution",
        escapeCsvValue(item.review_state),
        escapeCsvValue(item.label),
        item.count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("semantic_distribution,state,label,count,issue_count");
  dashboard.semantic_distribution.forEach((item) => {
    rows.push(
      [
        "semantic_distribution",
        escapeCsvValue(item.state),
        escapeCsvValue(item.label),
        item.count,
        item.issue_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("daily_trend,snapshot_date,report_count,store_count,result_count,issue_count,pending_review_count,rectification_order_count,rectification_completed_count,rectification_close_rate");
  dashboard.daily_trend.forEach((item) => {
    rows.push(
      [
        "daily_trend",
        item.snapshot_date,
        item.report_count,
        item.store_count,
        item.result_count,
        item.issue_count,
        item.pending_review_count,
        item.rectification_order_count,
        item.rectification_completed_count,
        item.rectification_close_rate
      ].join(",")
    );
  });

  rows.push("");
  rows.push("issue_type_ranking,issue_type,count,store_count,result_count");
  dashboard.issue_type_ranking.forEach((item) => {
    rows.push(
      [
        "issue_type_ranking",
        escapeCsvValue(item.issue_type),
        item.count,
        item.store_count,
        item.result_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("skill_distribution,skill_id,skill_name,count,store_count,result_count");
  dashboard.skill_distribution.forEach((item) => {
    rows.push(
      [
        "skill_distribution",
        escapeCsvValue(item.skill_id),
        escapeCsvValue(item.skill_name),
        item.count,
        item.store_count,
        item.result_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("severity_distribution,severity,label,count,store_count,result_count");
  dashboard.severity_distribution.forEach((item) => {
    rows.push(
      [
        "severity_distribution",
        escapeCsvValue(item.severity),
        escapeCsvValue(item.label),
        item.count,
        item.store_count,
        item.result_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("organization_ranking,organization_code,organization_name,store_count,result_count,issue_count,pending_review_count,rectification_required_count");
  dashboard.organization_ranking.forEach((item) => {
    rows.push(
      [
        "organization_ranking",
        escapeCsvValue(item.organization_code),
        escapeCsvValue(item.organization_name),
        item.store_count,
        item.result_count,
        item.issue_count,
        item.pending_review_count,
        item.rectification_required_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("organization_governance_ranking,organization_code,organization_name,store_count,franchisee_count,pending_review_count,overdue_count,high_risk_franchisee_count,governance_score");
  dashboard.organization_governance_ranking.forEach((item) => {
    rows.push(
      [
        "organization_governance_ranking",
        escapeCsvValue(item.organization_code),
        escapeCsvValue(item.organization_name),
        item.store_count,
        item.franchisee_count,
        item.pending_review_count,
        item.overdue_count,
        item.high_risk_franchisee_count,
        item.governance_score
      ].join(",")
    );
  });

  rows.push("");
  rows.push("franchisee_ranking,franchisee_name,store_count,result_count,issue_count,pending_review_count,rectification_required_count");
  dashboard.franchisee_ranking.forEach((item) => {
    rows.push(
      [
        "franchisee_ranking",
        escapeCsvValue(item.franchisee_name),
        item.store_count,
        item.result_count,
        item.issue_count,
        item.pending_review_count,
        item.rectification_required_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("franchisee_close_rate_ranking,franchisee_name,store_count,order_count,completed_count,overdue_count,close_rate");
  dashboard.franchisee_close_rate_ranking.forEach((item) => {
    rows.push(
      [
        "franchisee_close_rate_ranking",
        escapeCsvValue(item.franchisee_name),
        item.store_count,
        item.order_count,
        item.completed_count,
        item.overdue_count,
        item.close_rate
      ].join(",")
    );
  });

  rows.push("");
  rows.push("high_risk_franchisees,franchisee_name,store_count,issue_count,pending_review_count,overdue_count,risk_score");
  dashboard.high_risk_franchisees.forEach((item) => {
    rows.push(
      [
        "high_risk_franchisees",
        escapeCsvValue(item.franchisee_name),
        item.store_count,
        item.issue_count,
        item.pending_review_count,
        item.overdue_count,
        item.risk_score
      ].join(",")
    );
  });

  rows.push("");
  rows.push("overdue_franchisees,franchisee_name,store_count,overdue_count,pending_count,nearest_due_date");
  dashboard.overdue_franchisees.forEach((item) => {
    rows.push(
      [
        "overdue_franchisees",
        escapeCsvValue(item.franchisee_name),
        item.store_count,
        item.overdue_count,
        item.pending_count,
        escapeCsvValue(item.nearest_due_date || "")
      ].join(",")
    );
  });

  rows.push("");
  rows.push("recurring_franchisees,franchisee_name,store_count,recurring_store_count,abnormal_result_count,abnormal_day_count,overdue_count,risk_score");
  dashboard.recurring_franchisees.forEach((item) => {
    rows.push(
      [
        "recurring_franchisees",
        escapeCsvValue(item.franchisee_name),
        item.store_count,
        item.recurring_store_count,
        item.abnormal_result_count,
        item.abnormal_day_count,
        item.overdue_count,
        item.risk_score
      ].join(",")
    );
  });

  rows.push("");
  rows.push("recurring_stores,store_id,store_name,franchisee_name,organization_name,abnormal_result_count,abnormal_day_count,issue_count,pending_review_count");
  dashboard.recurring_stores.forEach((item) => {
    rows.push(
      [
        "recurring_stores",
        escapeCsvValue(item.store_id),
        escapeCsvValue(item.store_name),
        escapeCsvValue(item.franchisee_name),
        escapeCsvValue(item.organization_name),
        item.abnormal_result_count,
        item.abnormal_day_count,
        item.issue_count,
        item.pending_review_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("store_ranking,store_id,store_name,franchisee_name,organization_name,result_count,issue_count,pending_review_count,rectification_required_count");
  dashboard.store_ranking.forEach((item) => {
    rows.push(
      [
        "store_ranking",
        escapeCsvValue(item.store_id),
        escapeCsvValue(item.store_name),
        escapeCsvValue(item.franchisee_name),
        escapeCsvValue(item.organization_name),
        item.result_count,
        item.issue_count,
        item.pending_review_count,
        item.rectification_required_count
      ].join(",")
    );
  });

  rows.push("");
  rows.push("review_efficiency,key,value");
  rows.push(`review_efficiency,review_action_count,${dashboard.review_efficiency.review_action_count}`);
  rows.push(`review_efficiency,manual_completed_count,${dashboard.review_efficiency.manual_completed_count}`);
  rows.push(`review_efficiency,reopened_count,${dashboard.review_efficiency.reopened_count}`);
  rows.push(`review_efficiency,operator_count,${dashboard.review_efficiency.operator_count}`);
  rows.push(`review_efficiency,average_review_latency_hours,${dashboard.review_efficiency.average_review_latency_hours}`);

  rows.push("");
  rows.push("rectification_overdue_ranking,store_id,store_name,organization_name,overdue_count,pending_count,nearest_due_date");
  dashboard.rectification_overdue_ranking.forEach((item) => {
    rows.push(
      [
        "rectification_overdue_ranking",
        escapeCsvValue(item.store_id),
        escapeCsvValue(item.store_name),
        escapeCsvValue(item.organization_name),
        item.overdue_count,
        item.pending_count,
        escapeCsvValue(item.nearest_due_date || "")
      ].join(",")
    );
  });

  return rows.join("\n");
}

export async function GET(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "report:read")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = buildFilters(url.searchParams);
  const dashboard = analyticsService.getDashboard(filters, buildRequestContext(currentUser), 20);
  const csv = buildCsv(dashboard);
  const fileName = `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`
    }
  });
}
