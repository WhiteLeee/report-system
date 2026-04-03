import Link from "next/link";

import styles from "./reports-page.module.css";

import { buildRequestContext, requirePermission } from "@/backend/auth/session";
import { createReportService } from "@/backend/report/report.module";
import type { ReportFilters } from "@/backend/report/report.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { DashboardHeader } from "@/ui/dashboard-header";
import { QueryPagination } from "@/ui/query-pagination";
import { ReviewStatusBadge } from "@/ui/review-status-badge";
import {
  formatDateRange,
  formatDisplayDate,
  formatReportType,
} from "@/ui/report-view";

export const dynamic = "force-dynamic";

const reportService = createReportService();
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildFilters(searchParams: Record<string, string | string[] | undefined>): ReportFilters {
  return {
    enterprise: "",
    reportType: typeof searchParams.reportType === "string" ? searchParams.reportType : "",
    reviewStatus:
      typeof searchParams.reviewStatus === "string"
        ? (searchParams.reviewStatus as ReportFilters["reviewStatus"])
        : "",
    startDate: typeof searchParams.startDate === "string" ? searchParams.startDate : "",
    endDate: typeof searchParams.endDate === "string" ? searchParams.endDate : ""
  };
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("report:read", "/reports");
  const resolvedSearchParams = await searchParams;
  const filters = buildFilters(resolvedSearchParams);
  const requestContext = buildRequestContext(currentUser);
  const allReports = reportService.listReports({}, requestContext);
  const filteredReports = reportService.listReports(filters, requestContext);
  const pageSize = parsePositiveInt(resolvedSearchParams.pageSize, PAGE_SIZE_OPTIONS[0]);
  const totalReports = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalReports / pageSize));
  const page = Math.min(parsePositiveInt(resolvedSearchParams.page, 1), totalPages);
  const startIndex = (page - 1) * pageSize;
  const reports = filteredReports.slice(startIndex, startIndex + pageSize);
  const reportTypeOptions = Array.from(new Set(allReports.map((report) => report.report_type).filter(Boolean))).sort();
  const pendingReports = allReports.filter((report) => report.pending_result_count > 0).length;
  const totalIssues = allReports.reduce((sum, report) => sum + report.issue_count, 0);
  const totalImages = allReports.reduce((sum, report) => sum + report.total_result_count, 0);

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="按批次管理报告。"
        title={`报告工作台`}
      />

      <section className={styles.workspaceHero}>
        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>报告批次</span>
              <strong className={styles.statValue}>{allReports.length}</strong>
              <span className={styles.statNote}>当前可查看范围</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>待复核批次</span>
              <strong className={styles.statValue}>{pendingReports}</strong>
              <span className={styles.statNote}>仍有待处理结果的批次</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>巡检结果</span>
              <strong className={styles.statValue}>{totalImages}</strong>
              <span className={styles.statNote}>需要逐条查看的现场记录</span>
            </CardContent>
          </Card>
          <Card className={styles.statCard}>
            <CardContent className={styles.statCardInner}>
              <span className={styles.statLabel}>问题项</span>
              <strong className={styles.statValue}>{totalIssues}</strong>
              <span className={styles.statNote}>待确认或补充说明</span>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className={`section ${styles.workspaceSection}`}>
        <Card className={styles.workspacePanel}>
          <CardHeader className={styles.workspacePanelHeader}>
            <div>
              <CardTitle className={styles.listTitle}>报告列表</CardTitle>
              <CardDescription className={styles.listCopy}>先按条件筛选批次，再在表格中查看规模和提交信息，直接进入详情处理。</CardDescription>
            </div>
          </CardHeader>
          <CardContent className={styles.workspacePanelBody}>
            <details className={styles.filterDisclosure}>
              <summary className={styles.filterDisclosureSummary}>
                <div>
                  <strong className={styles.filterDisclosureTitle}>筛选批次</strong>
                  
                </div>
                <div className={styles.filterDisclosureMeta}>
                  <span className={styles.filterToggleLabel}>展开筛选</span>
                </div>
              </summary>
              <div className={styles.filterDisclosureBody}>
                <form className={styles.sidebarForm} method="get">
                  <div className={styles.filterFormPanel}>
                    <div className={styles.filterFormRow}>
                      <div className={styles.sidebarGrid}>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="reportType">报告类型</label>
                          <NativeSelect className={styles.control} id="reportType" name="reportType" defaultValue={filters.reportType}>
                            <option value="">全部类型</option>
                            {reportTypeOptions.map((reportType) => (
                              <option key={reportType} value={reportType}>
                                {formatReportType(reportType)}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="reviewStatus">复核状态</label>
                          <NativeSelect className={styles.control} id="reviewStatus" name="reviewStatus" defaultValue={filters.reviewStatus}>
                            <option value="">全部状态</option>
                            <option value="pending">待复核</option>
                            <option value="in_progress">未完成</option>
                            <option value="completed">已完成</option>
                          </NativeSelect>
                        </div>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="startDate">开始日期</label>
                          <DatePickerField className={styles.control} defaultValue={filters.startDate} id="startDate" name="startDate" />
                        </div>
                        <div className={`field ${styles.compactField}`}>
                          <label htmlFor="endDate">结束日期</label>
                          <DatePickerField className={styles.control} defaultValue={filters.endDate} id="endDate" name="endDate" />
                        </div>
                      </div>
                      <div className={styles.filterActions}>
                        <Button asChild className={styles.filterButton} size="sm" variant="secondary">
                          <Link href="/reports">重置</Link>
                        </Button>
                        <Button className={styles.filterButton} size="sm" type="submit">
                          筛选
                        </Button>
                      </div>
                    </div>
                    
                  </div>
                </form>
              </div>
            </details>

            <div className={styles.reportStack}>
              {reports.length > 0 ? (
                <div className={styles.reportTableShell}>
                  <div className={styles.reportTableWrap}>
                    <table className={styles.reportTable}>
                      <colgroup>
                        <col className={styles.typeCol} />
                        <col className={styles.rangeCol} />
                        <col className={styles.storeCol} />
                        <col className={styles.imageCol} />
                        <col className={styles.issueCol} />
                        <col className={styles.progressCol} />
                        <col className={styles.submitterCol} />
                        <col className={styles.updatedCol} />
                        <col className={styles.actionCol} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>报告类型</th>
                          <th>报告时间范围</th>
                          <th>门店数</th>
                          <th>巡检结果</th>
                          <th>问题项</th>
                          <th>复核信息</th>
                          <th>提交人</th>
                          <th>更新时间</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((report) => (
                          <tr className={styles.reportTableRow} key={report.id}>
                            <td>
                              <div className={styles.progressCell}>
                                <Badge className={styles.reportTypeBadge} variant="outline">
                                  {formatReportType(report.report_type)}
                                </Badge>
                                <span className={styles.cellMeta}>
                                  {report.report_topic || report.plan_name || "未命名主题"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={styles.cellValue}>
                                {formatDateRange(report.period_start, report.period_end).replace(" - ", "～")}
                              </span>
                            </td>
                            <td>
                              <span className={styles.cellValue}>{report.store_count}</span>
                            </td>
                            <td>
                              <span className={styles.cellValue}>{report.total_result_count}</span>
                            </td>
                            <td>
                              <span className={styles.cellValue}>{report.issue_count}</span>
                            </td>
                            <td>
                              <div className={styles.progressCell}>
                                <ReviewStatusBadge
                                  completed={report.completed_result_count}
                                  mode="progress"
                                  status={report.progress_state}
                                  total={report.total_result_count}
                                />
                              </div>
                            </td>
                            <td>
                              <span className={styles.cellValue}>{report.operator_name}</span>
                            </td>
                            <td>
                              <span className={styles.cellMeta}>{formatDisplayDate(report.published_at)}</span>
                            </td>
                            <td className={styles.actionCell}>
                              <Button asChild className={styles.inlineActionButton} variant="secondary">
                                <Link href={`/reports/${report.id}`}>进入详情</Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyState className={styles.reportEmptyState}>
                  当前没有匹配的报告。可以先启动服务后调用 <span className="mono">POST /api/reports/publish</span>
                  接收新的报告数据。
                </EmptyState>
              )}
            </div>
            {totalReports > 0 ? (
              <QueryPagination
                className={styles.pager}
                leftClassName={styles.pagerLeft}
                page={page}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                rightClassName={styles.pagerRight}
                selectClassName={styles.pageSizeSelect}
                total={totalReports}
                totalPages={totalPages}
              />
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
