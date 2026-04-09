import Link from "next/link";

import styles from "./analytics-page.module.css";

import { createAnalyticsService } from "@/backend/analytics/analytics.module";
import type { AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import { buildRequestContext, requirePermission } from "@/backend/auth/session";
import { createMasterDataService } from "@/backend/master-data/master-data.module";
import type { MasterDataOrganization } from "@/backend/master-data/master-data.types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsFilterForm } from "@/app/analytics/analytics-filter-form";
import { AnalyticsGovernanceCharts } from "@/ui/analytics/analytics-governance-charts";
import { AnalyticsOverviewCharts } from "@/ui/analytics/analytics-overview-charts";
import { AnalyticsProblemCharts } from "@/ui/analytics/analytics-problem-charts";
import { DashboardHeader } from "@/ui/shared/dashboard-header";
import { formatReportType } from "@/ui/report/report-view";

export const dynamic = "force-dynamic";

const analyticsService = createAnalyticsService();
const masterDataService = createMasterDataService();

function buildFilters(searchParams: Record<string, string | string[] | undefined>): AnalyticsFilters {
  return {
    startDate: typeof searchParams.startDate === "string" ? searchParams.startDate.trim() : "",
    endDate: typeof searchParams.endDate === "string" ? searchParams.endDate.trim() : "",
    enterpriseId: "",
    organizationId: typeof searchParams.organizationId === "string" ? searchParams.organizationId.trim() : "",
    franchiseeName: "",
    storeId: typeof searchParams.storeId === "string" ? searchParams.storeId.trim() : "",
    reportType: typeof searchParams.reportType === "string" ? searchParams.reportType.trim() : "",
    topic: typeof searchParams.topic === "string" ? searchParams.topic.trim() : "",
    planId: typeof searchParams.planId === "string" ? searchParams.planId.trim() : ""
  };
}

function buildQueryString(filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

function buildViewHref(filters: AnalyticsFilters, view: string): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  params.set("view", view);
  return `/analytics?${params.toString()}`;
}

function buildAnalyticsDrilldownHref(
  filters: AnalyticsFilters,
  patch: Partial<AnalyticsFilters>,
  view: string
): string {
  return buildViewHref({ ...filters, ...patch }, view);
}

function buildRectificationDrilldownHref(filters: AnalyticsFilters, keyword: string): string {
  const params = new URLSearchParams();
  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }
  params.set("keyword", keyword);
  return `/rectifications?${params.toString()}`;
}

function hasAdvancedFilters(filters: AnalyticsFilters): boolean {
  return Boolean(filters.topic || filters.planId);
}

function flattenOrganizations(nodes: MasterDataOrganization[]): Array<{ value: string; label: string }> {
  const items: Array<{ value: string; label: string }> = [];
  const walk = (rows: MasterDataOrganization[]) => {
    rows.forEach((row) => {
      const code = row.organize_code.trim();
      const name = row.organize_name.trim() || code;
      if (code) {
        items.push({ value: code, label: name });
      }
      if (row.child.length > 0) {
        walk(row.child);
      }
    });
  };
  walk(nodes);
  return items.sort(
    (left, right) =>
      left.label.localeCompare(right.label, "zh-Hans-CN") ||
      left.value.localeCompare(right.value, "en")
  );
}

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("analytics:read", "/analytics");
  const resolvedSearchParams = await searchParams;
  const filters = buildFilters(resolvedSearchParams);
  const currentView =
    typeof resolvedSearchParams.view === "string" && ["overview", "governance", "responsibility"].includes(resolvedSearchParams.view)
      ? resolvedSearchParams.view
      : "overview";
  const hasActiveFilters = Object.values(filters).some((value) => Boolean(value));
  const hasAdvancedFilterValues = hasAdvancedFilters(filters);
  const requestContext = buildRequestContext(currentUser);
  const masterDataEnterprises = masterDataService.listEnterprises(requestContext);
  const activeEnterpriseId = masterDataEnterprises[0]?.enterprise_id || "";
  const organizationFilterOptions = activeEnterpriseId
    ? flattenOrganizations(masterDataService.listOrganizations(activeEnterpriseId, requestContext))
    : [];
  const storeFilterOptions = activeEnterpriseId
    ? masterDataService
        .listStores(
          {
            enterpriseId: activeEnterpriseId
          },
          requestContext
        )
        .map((item) => ({
          value: item.store_id,
          label: item.store_name || item.store_id,
          organizationId: item.organize_code || ""
        }))
        .sort(
          (left, right) =>
            left.label.localeCompare(right.label, "zh-Hans-CN") ||
            left.value.localeCompare(right.value, "en")
        )
    : [];
  const dashboard = analyticsService.getDashboard(filters, requestContext, 10);
  const baseFilterOptions = analyticsService.getFilterOptions(
    {
      ...filters,
      organizationId: "",
      storeId: "",
      topic: "",
      planId: ""
    },
    requestContext
  );
  const advancedFilterOptions = analyticsService.getFilterOptions(
    {
      ...filters,
      topic: "",
      planId: ""
    },
    requestContext
  );
  const queryString = buildQueryString(filters);
  const canManageUsers = currentUser.permissions.includes("system:settings:write");

  return (
    <main className="page-shell">
      <DashboardHeader
        activePath="/analytics"
        currentUser={currentUser}
        subtitle="基于 report-system 已落盘业务数据进行巡检质量、复核效率和整改闭环分析。"
        title="数据分析"
      />

      <section className={`section ${styles.hero}`}>
        <AnalyticsFilterForm
          currentView={currentView}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          hasAdvancedFilterValues={hasAdvancedFilterValues}
          isAdmin={canManageUsers}
          organizationOptions={organizationFilterOptions}
          planOptions={advancedFilterOptions.plans}
          queryString={queryString}
          reportTypeOptions={baseFilterOptions.report_types.map((item) => ({
            value: item.value,
            label: formatReportType(item.label)
          }))}
          storeOptions={storeFilterOptions}
          topicOptions={advancedFilterOptions.topics}
        />

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>巡检批次数</span>
              <strong className={styles.statValue}>{dashboard.overview.report_count}</strong>
              <span className={styles.statNote}>已接收的批次</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>巡检门店数</span>
              <strong className={styles.statValue}>{dashboard.overview.store_count}</strong>
              <span className={styles.statNote}>去重门店数量</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>巡检结果数</span>
              <strong className={styles.statValue}>{dashboard.overview.result_count}</strong>
              <span className={styles.statNote}>图片级巡检结果</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>问题总数</span>
              <strong className={styles.statValue}>{dashboard.overview.issue_count}</strong>
              <span className={styles.statNote}>问题项总数</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>待复核结果</span>
              <strong className={styles.statValue}>{dashboard.overview.pending_review_count}</strong>
              <span className={styles.statNote}>仍需人工处理的结果</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>自动已复核</span>
              <strong className={styles.statValue}>{dashboard.overview.auto_completed_review_count}</strong>
              <span className={styles.statNote}>系统自动闭环的结果</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>整改单总数</span>
              <strong className={styles.statValue}>{dashboard.overview.rectification_order_count}</strong>
              <span className={styles.statNote}>已下发整改单据</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>闭环率</span>
              <strong className={styles.statValue}>{dashboard.overview.rectification_close_rate}%</strong>
              <span className={styles.statNote}>已整改 / 已下发</span>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="section">
        <Tabs className={styles.analyticsTabs}>
          <TabsList className={styles.analyticsTabsList}>
            <TabsTrigger asChild isActive={currentView === "overview"}>
              <Link href={buildViewHref(filters, "overview")}>经营概览</Link>
            </TabsTrigger>
            <TabsTrigger asChild isActive={currentView === "governance"}>
              <Link href={buildViewHref(filters, "governance")}>治理执行</Link>
            </TabsTrigger>
            <TabsTrigger asChild isActive={currentView === "responsibility"}>
              <Link href={buildViewHref(filters, "responsibility")}>责任定位</Link>
            </TabsTrigger>
          </TabsList>

          {currentView === "overview" ? (
            <TabsContent className={styles.tabPanel}>
              <AnalyticsOverviewCharts dashboard={dashboard} />
            </TabsContent>
          ) : null}

          {currentView === "governance" ? (
            <TabsContent className={styles.tabPanel}>
              <AnalyticsGovernanceCharts dashboard={dashboard} />

              <section className={styles.panelGrid}>
                <Card>
                  <CardHeader>
                    <CardTitle>超期加盟商</CardTitle>
                    <CardDescription>优先定位名下门店已有超期整改单的加盟商，作为经营督导重点对象。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.overdue_franchisees.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>加盟商</th>
                            <th>涉及门店</th>
                            <th>超期单数</th>
                            <th>待整改单数</th>
                            <th>最近到期日</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.overdue_franchisees.map((item) => (
                            <tr key={item.franchisee_name}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.franchisee_name}</strong>
                                  <Link
                                    className={styles.inlineLink}
                                    href={buildAnalyticsDrilldownHref(filters, { franchiseeName: item.franchisee_name, storeId: "" }, "governance")}
                                  >
                                    查看加盟商
                                  </Link>
                                </div>
                              </td>
                              <td>{item.store_count}</td>
                              <td>{item.overdue_count}</td>
                              <td>{item.pending_count}</td>
                              <td>{item.nearest_due_date || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围没有超期加盟商。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>高风险加盟商</CardTitle>
                    <CardDescription>综合问题数、待复核积压和超期整改，优先定位需要经营跟进的加盟商。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.high_risk_franchisees.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>加盟商</th>
                            <th>门店数</th>
                            <th>问题数</th>
                            <th>待复核</th>
                            <th>超期</th>
                            <th>风险分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.high_risk_franchisees.map((item) => (
                            <tr key={item.franchisee_name}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.franchisee_name}</strong>
                                  <Link
                                    className={styles.inlineLink}
                                    href={buildAnalyticsDrilldownHref(filters, { franchiseeName: item.franchisee_name, storeId: "" }, "responsibility")}
                                  >
                                    下钻责任视图
                                  </Link>
                                </div>
                              </td>
                              <td>{item.store_count}</td>
                              <td>{item.issue_count}</td>
                              <td>{item.pending_review_count}</td>
                              <td>{item.overdue_count}</td>
                              <td>
                                <Badge variant={item.risk_score >= 10 ? "default" : item.risk_score >= 5 ? "outline" : "secondary"}>
                                  {item.risk_score}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围还没有高风险加盟商数据。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>整改超期排行</CardTitle>
                    <CardDescription>优先定位超期未整改、仍在积压的重点门店。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.rectification_overdue_ranking.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>门店</th>
                            <th>组织</th>
                            <th>超期单数</th>
                            <th>未闭环单数</th>
                            <th>最早截止日</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.rectification_overdue_ranking.map((item) => (
                            <tr key={item.store_id}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.store_name}</strong>
                                  <span className={styles.cellMeta}>{item.store_id}</span>
                                </div>
                              </td>
                              <td>{item.organization_name}</td>
                              <td>{item.overdue_count}</td>
                              <td>{item.pending_count}</td>
                              <td>
                                <div className={styles.actionStack}>
                                  <span>{item.nearest_due_date || "-"}</span>
                                  <Link
                                    className={styles.inlineLink}
                                    href={buildAnalyticsDrilldownHref(filters, { storeId: item.store_id, franchiseeName: "", organizationId: "" }, "responsibility")}
                                  >
                                    看门店
                                  </Link>
                                  <Link className={styles.inlineLink} href={buildRectificationDrilldownHref(filters, item.store_id)}>
                                    查看整改单
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围没有超期整改单。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </TabsContent>
          ) : null}

          {currentView === "responsibility" ? (
            <TabsContent className={styles.tabPanel}>
              <AnalyticsProblemCharts dashboard={dashboard} />

              <section className={styles.panelGrid}>
                <Card>
                  <CardHeader>
                    <CardTitle>反复异常门店</CardTitle>
                    <CardDescription>识别在多个日期重复出现异常结果的门店，优先推动门店和加盟商联合整改。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.recurring_stores.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>门店</th>
                            <th>加盟商</th>
                            <th>组织</th>
                            <th>异常结果</th>
                            <th>异常天数</th>
                            <th>待复核</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.recurring_stores.map((item) => (
                            <tr key={item.store_id}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.store_name}</strong>
                                  <span className={styles.cellMeta}>{item.store_id}</span>
                                </div>
                              </td>
                              <td>{item.franchisee_name || "-"}</td>
                              <td>{item.organization_name}</td>
                              <td>{item.abnormal_result_count}</td>
                              <td>{item.abnormal_day_count}</td>
                              <td>
                                <div className={styles.actionStack}>
                                  <span>{item.pending_review_count}</span>
                                  <Link
                                    className={styles.inlineLink}
                                    href={buildAnalyticsDrilldownHref(filters, { storeId: item.store_id, franchiseeName: "", organizationId: "" }, "responsibility")}
                                  >
                                    下钻
                                  </Link>
                                  <Link className={styles.inlineLink} href={buildRectificationDrilldownHref(filters, item.store_id)}>
                                    整改单
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围还没有反复异常门店。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>反复异常加盟商</CardTitle>
                    <CardDescription>识别在当前时间范围内多次出现异常结果、且门店反复出问题的加盟商。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.recurring_franchisees.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>加盟商</th>
                            <th>反复异常门店</th>
                            <th>异常结果</th>
                            <th>异常天数</th>
                            <th>超期</th>
                            <th>治理分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.recurring_franchisees.map((item) => (
                            <tr key={item.franchisee_name}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.franchisee_name}</strong>
                                  <span className={styles.cellMeta}>{item.store_count} 家涉及门店</span>
                                  <Link
                                    className={styles.inlineLink}
                                    href={buildAnalyticsDrilldownHref(filters, { franchiseeName: item.franchisee_name, storeId: "" }, "responsibility")}
                                  >
                                    下钻加盟商
                                  </Link>
                                </div>
                              </td>
                              <td>{item.recurring_store_count}</td>
                              <td>{item.abnormal_result_count}</td>
                              <td>{item.abnormal_day_count}</td>
                              <td>{item.overdue_count}</td>
                              <td>
                                <Badge variant={item.risk_score >= 12 ? "default" : item.risk_score >= 6 ? "outline" : "secondary"}>
                                  {item.risk_score}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围还没有反复异常加盟商。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>问题类型排行</CardTitle>
                    <CardDescription>当前筛选范围内问题类型 Top 10。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.issue_type_ranking.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>问题类型</th>
                            <th>问题数</th>
                            <th>门店数</th>
                            <th>结果数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.issue_type_ranking.map((item) => (
                            <tr key={item.issue_type}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.issue_type}</strong>
                                </div>
                              </td>
                              <td>{item.count}</td>
                              <td>{item.store_count}</td>
                              <td>{item.result_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围还没有问题项数据。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>组织问题排行</CardTitle>
                    <CardDescription>按运营组织聚合问题、待复核和需整改结果。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.organization_ranking.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>组织</th>
                            <th>编码</th>
                            <th>门店数</th>
                            <th>问题数</th>
                            <th>待复核</th>
                            <th>需整改</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.organization_ranking.map((item) => (
                            <tr key={`${item.organization_code || "unknown"}:${item.organization_name}`}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.organization_name}</strong>
                                  <span className={styles.cellMeta}>{item.result_count} 条巡检结果</span>
                                  {item.organization_code ? (
                                    <Link
                                      className={styles.inlineLink}
                                      href={buildAnalyticsDrilldownHref(filters, { organizationId: item.organization_code, franchiseeName: "", storeId: "" }, "governance")}
                                    >
                                      查看组织
                                    </Link>
                                  ) : null}
                                </div>
                              </td>
                              <td>{item.organization_code || "-"}</td>
                              <td>{item.store_count}</td>
                              <td>{item.issue_count}</td>
                              <td>{item.pending_review_count}</td>
                              <td>{item.rectification_required_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围还没有组织排行数据。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>加盟商问题排行</CardTitle>
                    <CardDescription>按加盟商聚合问题、待复核和需整改结果，用于定位经营责任主体。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.franchisee_ranking.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>加盟商</th>
                            <th>门店数</th>
                            <th>问题数</th>
                            <th>待复核</th>
                            <th>需整改</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.franchisee_ranking.map((item) => (
                            <tr key={item.franchisee_name}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.franchisee_name}</strong>
                                  <span className={styles.cellMeta}>{item.result_count} 条巡检结果</span>
                                  <Link
                                    className={styles.inlineLink}
                                    href={buildAnalyticsDrilldownHref(filters, { franchiseeName: item.franchisee_name, storeId: "" }, "responsibility")}
                                  >
                                    查看加盟商
                                  </Link>
                                </div>
                              </td>
                              <td>{item.store_count}</td>
                              <td>{item.issue_count}</td>
                              <td>{item.pending_review_count}</td>
                              <td>{item.rectification_required_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围还没有加盟商排行数据。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>门店问题排行</CardTitle>
                    <CardDescription>定位问题密集、待复核多、需整改多的重点门店。</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.panelBody}>
                    {dashboard.store_ranking.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>门店</th>
                            <th>加盟商</th>
                            <th>组织</th>
                            <th>问题数</th>
                            <th>待复核</th>
                            <th>需整改</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.store_ranking.map((item) => (
                            <tr key={item.store_id}>
                              <td>
                                <div className={styles.primaryCell}>
                                  <strong>{item.store_name}</strong>
                                  <span className={styles.cellMeta}>{item.store_id}</span>
                                </div>
                              </td>
                              <td>{item.franchisee_name || "-"}</td>
                              <td>{item.organization_name}</td>
                              <td>{item.issue_count}</td>
                              <td>{item.pending_review_count}</td>
                              <td>
                                <div className={styles.actionStack}>
                                  <span>{item.rectification_required_count}</span>
                                  <Link
                                    className={styles.inlineLink}
                                    href={buildAnalyticsDrilldownHref(filters, { storeId: item.store_id, franchiseeName: "", organizationId: "" }, "responsibility")}
                                  >
                                    下钻
                                  </Link>
                                  <Link className={styles.inlineLink} href={buildRectificationDrilldownHref(filters, item.store_id)}>
                                    整改单
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyBlock}>
                        <EmptyState>当前筛选范围还没有门店排行数据。</EmptyState>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </TabsContent>
          ) : null}
        </Tabs>
      </section>
    </main>
  );
}
