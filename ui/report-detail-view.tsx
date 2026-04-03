import Link from "next/link";

import styles from "./report-detail-view.module.css";

import type { SessionUser } from "@/backend/auth/auth.types";
import type { ReportDetail } from "@/backend/report/report.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { DashboardHeader } from "@/ui/dashboard-header";
import {
  DETAIL_PAGE_SIZE_OPTIONS,
  buildScopeStoreIds,
  buildSearch,
  filterImages,
  filterIssues,
  filterStores,
  matchesInspectionToImage,
  matchesIssueToImage,
  readMetadataString,
  type DetailFilters
} from "@/ui/report-detail-helpers";
import { ReviewStatusBadge } from "@/ui/review-status-badge";
import {
  formatDateRange,
  formatDisplayDate,
  formatReportType,
  formatResultReviewState,
  getCompletionRatio
} from "@/ui/report-view";
import {
  classifyReportResultSemantics,
  getReportResultSemanticLabel,
  getReportResultSemanticTone
} from "@/ui/report-result-semantics";

function formatCompactDateTime(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "-";
  }
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2}):(\d{2})/);
  if (match) {
    return `${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
  }
  return normalized;
}

export function ReportDetailView({
  currentUser,
  report,
  filters,
  showCollaboration
}: {
  currentUser: SessionUser;
  report: ReportDetail;
  filters: DetailFilters;
  showCollaboration: boolean;
}) {
  const canReview = currentUser.permissions.includes("review:write");
  const organizationOptions = Array.from(new Set(report.stores.map((store) => store.organization_name || "").filter(Boolean))).sort();
  const scopedStoreIds = buildScopeStoreIds(report.stores, filters);
  const scopedImages = filterImages(report.results, scopedStoreIds, filters);
  const issues = filterIssues(report.issues, scopedStoreIds, filters);
  const storeById = new Map(report.stores.map((store) => [store.store_id, store]));
  const imageSemanticMap = new Map(
    scopedImages.map((image) => {
      const imageIssues = issues.filter((issue) => matchesIssueToImage(issue, image));
      const imageInspections = report.inspections.filter((inspection) => matchesInspectionToImage(inspection, image));
      return [image.id, classifyReportResultSemantics(imageIssues, imageInspections)];
    })
  );
  const semanticCounts = {
    issue_found: 0,
    pass: 0,
    inconclusive: 0,
    inspection_failed: 0
  };
  imageSemanticMap.forEach((state) => {
    semanticCounts[state] += 1;
  });
  const images = filters.semanticState
    ? scopedImages.filter((image) => imageSemanticMap.get(image.id) === filters.semanticState)
    : scopedImages;
  const pendingImages = images.filter((image) => image.review_state === "pending").length;
  const reviewedImages = images.length - pendingImages;
  const stores = filterStores(report.stores, filters);
  const completedStores = stores.filter((store) => store.progress_state === "completed").length;
  const reviewers = Array.from(new Set(report.review_logs.map((log) => log.operator_name).filter(Boolean)));
  const listTitle = filters.reviewStatus === "completed" ? "已复核结果" : filters.reviewStatus === "pending" ? "待复核结果" : "巡检结果";
  const totalPages = Math.max(1, Math.ceil(images.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pageStart = (currentPage - 1) * filters.pageSize;
  const pagedImages = images.slice(pageStart, pageStart + filters.pageSize);

  function buildPageHref(page: number, pageSize: DetailFilters["pageSize"] = filters.pageSize) {
    const searchParams = new URLSearchParams();
    if (filters.organization) {
      searchParams.set("organization", filters.organization);
    }
    if (filters.storeId) {
      searchParams.set("storeId", filters.storeId);
    }
    if (filters.reviewStatus) {
      searchParams.set("reviewStatus", filters.reviewStatus);
    }
    if (filters.semanticState) {
      searchParams.set("semanticState", filters.semanticState);
    }
    if (page > 1) {
      searchParams.set("page", String(page));
    }
    if (pageSize !== 30) {
      searchParams.set("pageSize", String(pageSize));
    }
    const search = searchParams.toString();
    return search ? `/reports/${report.id}?${search}` : `/reports/${report.id}`;
  }

  const collaborationHref = `${buildPageHref(currentPage, filters.pageSize)}${buildPageHref(currentPage, filters.pageSize).includes("?") ? "&" : "?"}collaboration=1`;

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="围绕巡检结果清单、复核备注和协作记录处理当前报告。"
        title={`报告复核台`}
      />


      <section className={`workspace-hero ${styles.detailHero}`}>
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className="eyebrow">report details</p>
            <h2 className={styles.heroTitle}>{report.report_topic || "智能巡检"}</h2>
            <p className={styles.heroCopy}>
              {formatDateRange(report.period_start, report.period_end)}
            </p>
            <div className={styles.heroInlineMeta}>
              <Badge className={styles.infoBadge} variant="outline">
                {formatReportType(report.report_type)}
              </Badge>
              {report.plan_name ? (
                <Badge className={styles.infoBadge} variant="outline">
                  计划 {report.plan_name}
                </Badge>
              ) : null}
              <ReviewStatusBadge
                className={styles.statusBadge}
                completed={report.completed_result_count}
                mode="progress"
                status={report.progress_state}
                total={report.total_result_count}
              />
              <Badge className={styles.infoBadge} variant="outline">
                提交人 {report.operator_name}
              </Badge>
              <Badge className={styles.infoBadge} variant="outline">
                最近更新 {formatDisplayDate(report.published_at)}
              </Badge>
            </div>
          </div>
          <div className={styles.heroStatGrid}>
              <Card className={styles.heroStatCard}>
                <CardContent className={styles.heroStatCardInner}>
                  <span className={styles.summaryLabel}>巡检结果</span>
                  <strong className={styles.summaryValue}>{scopedImages.length}</strong>
                </CardContent>
              </Card>
            <Card className={styles.heroStatCard}>
              <CardContent className={styles.heroStatCardInner}>
                <span className={styles.summaryLabel}>待复核结果</span>
                <strong className={styles.summaryValue}>{pendingImages}</strong>
              </CardContent>
            </Card>
            <Card className={styles.heroStatCard}>
              <CardContent className={styles.heroStatCardInner}>
                <span className={styles.summaryLabel}>门店进度</span>
                <strong className={styles.summaryValue}>
                  {completedStores}/{stores.length || 0}
                </strong>
              </CardContent>
            </Card>
            <Link className={styles.heroStatLink} href={collaborationHref}>
              <Card className={styles.heroStatCard}>
                <CardContent className={styles.heroStatCardInner}>
                  <span className={styles.summaryLabel}>参与协作</span>
                  <strong className={styles.summaryValue}>{reviewers.length}</strong>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
        <div className={styles.progressStrip}>
          <div className={styles.progressLabel}>
            <span>复核进度</span>
            <strong>{getCompletionRatio(reviewedImages, images.length)}%</strong>
          </div>
          <div className={styles.progressTrack}>
            <span style={{ width: `${getCompletionRatio(reviewedImages, images.length)}%` }} />
          </div>
        </div>
      </section>

      <section className="section">
        <Card className={styles.workbenchShell}>
          <CardContent className={styles.workbenchShellBody}>
            <div className={styles.workbenchHeader}>
              <div>
                <h2 className={styles.workbenchTitle}>{listTitle}</h2>
                <p className={styles.workbenchCopy}>先按组织、门店、复核状态和巡检结论缩小当前批次范围，再逐条进入结果详情处理复核动作。</p>
              </div>
              <Badge className={styles.workbenchMetaBadge} variant="outline">
                {images.length} 条
              </Badge>
            </div>

            <div className={styles.semanticStatGrid}>
              <Card className={styles.semanticStatCard}>
                <CardContent className={styles.semanticStatBody}>
                  <span className={styles.summaryLabel}>发现问题</span>
                  <strong className={styles.summaryValue}>{semanticCounts.issue_found}</strong>
                </CardContent>
              </Card>
              <Card className={styles.semanticStatCard}>
                <CardContent className={styles.semanticStatBody}>
                  <span className={styles.summaryLabel}>未发现问题</span>
                  <strong className={styles.summaryValue}>{semanticCounts.pass}</strong>
                </CardContent>
              </Card>
              <Card className={styles.semanticStatCard}>
                <CardContent className={styles.semanticStatBody}>
                  <span className={styles.summaryLabel}>无法判定</span>
                  <strong className={styles.summaryValue}>{semanticCounts.inconclusive}</strong>
                </CardContent>
              </Card>
              <Card className={styles.semanticStatCard}>
                <CardContent className={styles.semanticStatBody}>
                  <span className={styles.summaryLabel}>巡检失败</span>
                  <strong className={styles.summaryValue}>{semanticCounts.inspection_failed}</strong>
                </CardContent>
              </Card>
            </div>

            <div className={styles.workbenchDivider} />

            <div className={styles.filterPanel}>
              <details className={styles.filterDisclosure}>
                <summary className={styles.filterDisclosureSummary}>
                  <div>
                    <strong className={styles.filterDisclosureTitle}>筛选范围</strong>
                  </div>
                  <div className={styles.filterDisclosureMeta}>
                    <span className={styles.filterToggleLabel} />
                  </div>
                </summary>
                <div className={styles.filterDisclosureBody}>
                  <div className={styles.filterSection}>
                    <p className="section-copy">按组织、门店、复核状态和巡检结论聚焦当前批次，点击巡检结果后进入单独页面处理。</p>
                    <form className={styles.filterForm} method="get">
                      <input name="page" type="hidden" value="1" />
                      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
                      <div className={styles.filterFieldsRow}>
                        <div className={`field ${styles.filterField}`}>
                          <label htmlFor="organization">组织</label>
                          <NativeSelect defaultValue={filters.organization} id="organization" name="organization">
                            <option value="">全部组织</option>
                            {organizationOptions.map((organizationName) => (
                              <option key={organizationName} value={organizationName}>
                                {organizationName}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className={`field ${styles.filterField}`}>
                          <label htmlFor="storeId">门店</label>
                          <NativeSelect defaultValue={filters.storeId} id="storeId" name="storeId">
                            <option value="">全部门店</option>
                            {report.stores.map((store) => (
                              <option key={store.id} value={store.store_id}>
                                {store.store_name}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className={`field ${styles.filterField}`}>
                          <label htmlFor="reviewStatus">复核状态</label>
                          <NativeSelect defaultValue={filters.reviewStatus} id="reviewStatus" name="reviewStatus">
                            <option value="">全部状态</option>
                            <option value="pending">待复核</option>
                            <option value="in_progress">未完成</option>
                            <option value="completed">已完成</option>
                          </NativeSelect>
                        </div>
                        <div className={`field ${styles.filterField}`}>
                          <label htmlFor="semanticState">巡检结论</label>
                          <NativeSelect defaultValue={filters.semanticState} id="semanticState" name="semanticState">
                            <option value="">全部结论</option>
                            <option value="issue_found">发现问题</option>
                            <option value="pass">未发现问题</option>
                            <option value="inconclusive">无法判定</option>
                            <option value="inspection_failed">巡检失败</option>
                          </NativeSelect>
                        </div>
                      </div>
                      <div className={styles.filterActions}>
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/reports/${report.id}`}>重置</Link>
                        </Button>
                        <Button size="sm" type="submit">
                          筛选
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </details>
            </div>

            <div className={styles.workbenchDivider} />

            <div className={styles.resultPanel}>
              <div className={styles.resultSection}>
                
                {images.length > 0 ? (
                  <div className={styles.resultTableShell}>
                    <div className={styles.resultTableWrap}>
                      <table className={styles.resultTable}>
                        <colgroup>
                          <col className={styles.resultStoreCol} />
                          <col className={styles.resultCameraCol} />
                          <col className={styles.resultScopeCol} />
                          <col className={styles.resultTimeCol} />
                          <col className={styles.resultIssueCol} />
                          <col className={styles.resultStatusCol} />
                          <col className={styles.resultActionCol} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>门店</th>
                            <th>摄像头</th>
                            <th>组织</th>
                            <th>拍摄时间</th>
                            <th>巡检结论</th>
                            <th>复核状态</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedImages.map((image) => {
                            const imageIssues = issues.filter((issue) => matchesIssueToImage(issue, image));
                            const imageSemanticState = imageSemanticMap.get(image.id) ?? "inconclusive";
                            const organizationName = image.store_id
                              ? storeById.get(image.store_id)?.organization_name || "未分组组织"
                              : "未绑定门店";
                            const cameraAlias = readMetadataString(image.metadata, "camera_alias") || "未标注摄像头";

                            return (
                              <tr className={styles.resultTableRow} id={`image-${image.id}`} key={image.id}>
                                <td>
                                  <div className={styles.resultInfoText}>
                                    <strong className={styles.resultInfoTitle} title={image.store_name || "未绑定门店"}>
                                      {image.store_name || "未绑定门店"}
                                    </strong>
                                  </div>
                                </td>
                                <td>
                                  <div className={styles.resultInfoText}>
                                    <Badge className={styles.resultInfoMeta} title={cameraAlias} variant="outline">
                                      {cameraAlias}
                                    </Badge>
                                  </div>
                                </td>
                                <td>
                                  <div className={styles.resultScopeCell}>
                                    <span className={styles.resultScopeText} title={organizationName}>
                                      {organizationName}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className={styles.resultTimeText}>{formatCompactDateTime(image.captured_at)}</span>
                                </td>
                                <td>
                                  <div className={styles.resultIssueCell}>
                                    <Badge
                                      className={styles.chipBadge}
                                      variant={getReportResultSemanticTone(imageSemanticState)}
                                    >
                                      {getReportResultSemanticLabel(imageSemanticState, imageIssues.length)}
                                    </Badge>
                                  </div>
                                </td>
                                <td>
                                  <ReviewStatusBadge className={styles.statusBadge} status={image.review_state} />
                                </td>
                                <td className={styles.resultActionCell}>
                                  <Button asChild className={styles.inlineActionButton} variant="secondary">
                                    <Link href={`/reports/${report.id}/results/${image.id}${buildSearch(filters)}`}>
                                      进入详情
                                    </Link>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.paginationBar}>
                      <form className={styles.pageSizeForm} method="get">
                        <input name="organization" type="hidden" value={filters.organization} />
                        <input name="storeId" type="hidden" value={filters.storeId} />
                        <input name="reviewStatus" type="hidden" value={filters.reviewStatus} />
                        <input name="page" type="hidden" value="1" />
                        <label className={styles.pageSizeLabel} htmlFor="pageSize">
                          每页显示
                        </label>
                        <NativeSelect
                          className={styles.pageSizeSelect}
                          defaultValue={String(filters.pageSize)}
                          id="pageSize"
                          name="pageSize"
                        >
                          {DETAIL_PAGE_SIZE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button size="sm" type="submit" variant="secondary">
                          应用
                        </Button>
                      </form>
                      <div className={styles.paginationSummary}>
                        第 {currentPage} / {totalPages} 页，共 {images.length} 条
                      </div>
                      <div className={styles.paginationActions}>
                        {currentPage > 1 ? (
                          <Button asChild size="sm" variant="secondary">
                            <Link href={buildPageHref(currentPage - 1)}>上一页</Link>
                          </Button>
                        ) : (
                          <Button disabled size="sm" variant="secondary">
                            上一页
                          </Button>
                        )}
                        {currentPage < totalPages ? (
                          <Button asChild size="sm" variant="secondary">
                            <Link href={buildPageHref(currentPage + 1)}>下一页</Link>
                          </Button>
                        ) : (
                          <Button disabled size="sm" variant="secondary">
                            下一页
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState>当前筛选条件下没有巡检结果。</EmptyState>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
      {showCollaboration ? (
        <div className={styles.modalOverlay}>
          <Link aria-label="关闭协作记录弹窗" className={styles.modalBackdrop} href={buildPageHref(currentPage, filters.pageSize)} />
          <Link aria-label="关闭协作记录弹窗" className={styles.modalCloseArea} href={buildPageHref(currentPage, filters.pageSize)} />
          <Card className={styles.modalCard}>
            <CardContent className={styles.panelBody}>
              <div className={styles.modalHeader}>
                <div>
                  <h2 className="section-title small">协作记录</h2>
                  <p className="section-copy">按时间查看最近复核动作和备注，方便交接复核上下文。</p>
                </div>
                <div className={styles.modalHeaderActions}>
                  <Badge className={styles.infoBadge} variant="outline">
                    {report.review_logs.length} 条
                  </Badge>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={buildPageHref(currentPage, filters.pageSize)}>关闭</Link>
                  </Button>
                </div>
              </div>
              {report.review_logs.length > 0 ? (
                <div className={styles.timelineList}>
                  {report.review_logs.map((log) => (
                    <article className={styles.timelineItem} key={log.id}>
                      <div className={styles.timelineHead}>
                        <strong>{log.operator_name}</strong>
                        <span>{formatDisplayDate(log.created_at)}</span>
                      </div>
                      <p>
                        {log.store_name || "未绑定门店"} 从 {formatResultReviewState(log.from_status)} 调整为 {formatResultReviewState(log.to_status)}
                      </p>
                      {log.note ? <div className={styles.timelineNote}>{log.note}</div> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>当前还没有协作复核记录。</EmptyState>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
