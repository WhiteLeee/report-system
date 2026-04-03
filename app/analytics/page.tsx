import Link from "next/link";

import styles from "./analytics-page.module.css";

import { createAnalyticsService } from "@/backend/analytics/analytics.module";
import type { AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import { buildRequestContext, requirePermission } from "@/backend/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsGovernanceCharts } from "@/ui/analytics-governance-charts";
import { AnalyticsOverviewCharts } from "@/ui/analytics-overview-charts";
import { AnalyticsProblemCharts } from "@/ui/analytics-problem-charts";
import { DashboardHeader } from "@/ui/dashboard-header";

export const dynamic = "force-dynamic";

const analyticsService = createAnalyticsService();

function buildFilters(searchParams: Record<string, string | string[] | undefined>): AnalyticsFilters {
  return {
    startDate: typeof searchParams.startDate === "string" ? searchParams.startDate.trim() : "",
    endDate: typeof searchParams.endDate === "string" ? searchParams.endDate.trim() : "",
    enterpriseId: typeof searchParams.enterpriseId === "string" ? searchParams.enterpriseId.trim() : "",
    organizationId: typeof searchParams.organizationId === "string" ? searchParams.organizationId.trim() : "",
    franchiseeName: typeof searchParams.franchiseeName === "string" ? searchParams.franchiseeName.trim() : "",
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

function buildFilterSummary(filters: AnalyticsFilters): Array<{ label: string; value: string }> {
  const summary: Array<{ label: string; value: string }> = [];
  if (filters.startDate || filters.endDate) {
    summary.push({
      label: "时间",
      value: [filters.startDate || "未设开始", filters.endDate || "未设结束"].join(" ~ ")
    });
  }
  if (filters.enterpriseId) {
    summary.push({ label: "企业", value: filters.enterpriseId });
  }
  if (filters.organizationId) {
    summary.push({ label: "组织", value: filters.organizationId });
  }
  if (filters.franchiseeName) {
    summary.push({ label: "加盟商", value: filters.franchiseeName });
  }
  if (filters.storeId) {
    summary.push({ label: "门店", value: filters.storeId });
  }
  if (filters.reportType) {
    summary.push({ label: "报告类型", value: filters.reportType });
  }
  if (filters.topic) {
    summary.push({ label: "主题", value: filters.topic });
  }
  if (filters.planId) {
    summary.push({ label: "计划", value: filters.planId });
  }
  return summary;
}

function hasAdvancedFilters(filters: AnalyticsFilters): boolean {
  return Boolean(filters.franchiseeName || filters.storeId || filters.topic || filters.planId);
}

function getViewLabel(view: string): string {
  switch (view) {
    case "governance":
      return "治理执行";
    case "responsibility":
      return "责任定位";
    default:
      return "经营概览";
  }
}

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("report:read", "/analytics");
  const resolvedSearchParams = await searchParams;
  const filters = buildFilters(resolvedSearchParams);
  const currentView =
    typeof resolvedSearchParams.view === "string" && ["overview", "governance", "responsibility"].includes(resolvedSearchParams.view)
      ? resolvedSearchParams.view
      : "overview";
  const hasActiveFilters = Object.values(filters).some((value) => Boolean(value));
  const hasAdvancedFilterValues = hasAdvancedFilters(filters);
  const filterSummary = buildFilterSummary(filters);
  const dashboard = analyticsService.getDashboard(filters, buildRequestContext(currentUser), 10);
  const queryString = buildQueryString(filters);
  const isAdmin = currentUser.roles.includes("admin");

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="基于 report-system 已落盘业务数据进行巡检质量、复核效率和整改闭环分析。"
        title="数据分析"
      />

      <section className={`section ${styles.hero}`}>
        <Card className={styles.filterCard}>
          <CardHeader>
            <CardTitle>分析筛选</CardTitle>
            <CardDescription>默认折叠。先看当前口径，再决定是否展开高级筛选。</CardDescription>
          </CardHeader>
          <CardContent className={styles.filterBody}>
            <div className={styles.filterSummaryBar}>
              <div className={styles.filterSummaryMeta}>
                <strong>当前视图：{getViewLabel(currentView)}</strong>
                <span>
                  高频筛选默认展开：时间、企业、组织、报告类型。加盟商、门店、主题与计划收在高级筛选里。
                </span>
              </div>
              <div className={styles.filterSummaryBadges}>
                {filterSummary.length > 0 ? (
                  filterSummary.map((item) => (
                    <Badge key={`${item.label}:${item.value}`} variant="outline">
                      {item.label}：{item.value}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">当前查看全部范围</Badge>
                )}
                {hasAdvancedFilterValues ? <Badge variant="outline">已启用高级筛选</Badge> : null}
              </div>
            </div>
            <details className={styles.filterDisclosure} open={hasActiveFilters}>
              <summary className={styles.filterSummary}>
                <span>{hasActiveFilters ? "已应用筛选，点击展开查看条件" : "点击展开筛选条件"}</span>
              </summary>
              <form className={styles.filterForm} method="get">
                <input name="view" type="hidden" value={currentView} />
                <div className={styles.filterSection}>
                  <div className={styles.filterSectionHeader}>
                    <strong>高频筛选</strong>
                    <span>先按时间、企业、组织与报告类型收口分析范围。</span>
                  </div>
                  <div className={styles.filterGrid}>
                    <div className="field">
                      <label htmlFor="startDate">开始日期</label>
                      <DatePickerField defaultValue={filters.startDate} id="startDate" name="startDate" />
                    </div>
                    <div className="field">
                      <label htmlFor="endDate">结束日期</label>
                      <DatePickerField defaultValue={filters.endDate} id="endDate" name="endDate" />
                    </div>
                    <div className="field">
                      <label htmlFor="enterpriseId">企业 ID</label>
                      <Input defaultValue={filters.enterpriseId} id="enterpriseId" name="enterpriseId" placeholder="enterprise-a" />
                    </div>
                    <div className="field">
                      <label htmlFor="organizationId">组织编码</label>
                      <Input defaultValue={filters.organizationId} id="organizationId" name="organizationId" placeholder="ORG-001" />
                    </div>
                    <div className="field">
                      <label htmlFor="reportType">报告类型</label>
                      <Input defaultValue={filters.reportType} id="reportType" name="reportType" placeholder="daily" />
                    </div>
                  </div>
                </div>
                <details className={styles.advancedDisclosure} open={hasAdvancedFilterValues}>
                  <summary className={styles.advancedSummary}>
                    <span>{hasAdvancedFilterValues ? "已启用高级筛选，点击查看详细条件" : "展开高级筛选"}</span>
                  </summary>
                  <div className={styles.filterSection}>
                    <div className={styles.filterSectionHeader}>
                      <strong>高级筛选</strong>
                      <span>用于精细定位加盟商、门店或特定主题/计划。</span>
                    </div>
                    <div className={styles.filterGrid}>
                      <div className="field">
                        <label htmlFor="franchiseeName">加盟商</label>
                        <Input defaultValue={filters.franchiseeName} id="franchiseeName" name="franchiseeName" placeholder="加盟商A" />
                      </div>
                      <div className="field">
                        <label htmlFor="storeId">门店 ID</label>
                        <Input defaultValue={filters.storeId} id="storeId" name="storeId" placeholder="store-001" />
                      </div>
                      <div className="field">
                        <label htmlFor="topic">报告主题</label>
                        <Input defaultValue={filters.topic} id="topic" name="topic" placeholder="智能巡检" />
                      </div>
                      <div className="field">
                        <label htmlFor="planId">计划 ID</label>
                        <Input defaultValue={filters.planId} id="planId" name="planId" placeholder="plan-demo-001" />
                      </div>
                    </div>
                  </div>
                </details>
                <div className={styles.filterActions}>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/analytics">重置</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/api/analytics/export${queryString}`}>导出 CSV</Link>
                  </Button>
                  {isAdmin ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/analytics/jobs">分析任务</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" type="submit">
                    应用筛选
                  </Button>
                </div>
              </form>
            </details>
          </CardContent>
        </Card>

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <CardContent className={styles.statBody}>
              <span className={styles.statLabel}>巡检批次数</span>
              <strong className={styles.statValue}>{dashboard.overview.report_count}</strong>
              <span className={styles.statNote}>当前筛选范围内已发布批次</span>
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
              <span className={styles.statNote}>当前范围内问题项总数</span>
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
