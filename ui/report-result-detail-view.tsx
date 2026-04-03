import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Store } from "lucide-react";

import styles from "./report-result-detail-view.module.css";

import type { SessionUser } from "@/backend/auth/auth.types";
import type { ReportDetail, ReportInspection, ReportIssue } from "@/backend/report/report.types";
import { getRectificationStateLabel } from "@/backend/rectification/rectification-sync";
import type { RectificationOrderRecord } from "@/backend/rectification/rectification.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  buildScopeStoreIds,
  buildSearch,
  filterImages,
  matchesInspectionToImage,
  matchesIssueToImage,
  readMetadataString,
  type DetailFilters
} from "@/ui/report-detail-helpers";
import { DashboardHeader } from "@/ui/dashboard-header";
import { ReviewStatusBadge } from "@/ui/review-status-badge";
import { formatDisplayDate, formatResultReviewState } from "@/ui/report-view";
import {
  classifyReportResultSemantics,
  getReportResultSemanticLabel,
  getReportResultSemanticSummaryLabel,
  getReportResultSemanticTone
} from "@/ui/report-result-semantics";
import { ResultReviewWorkflow } from "@/ui/result-review-workflow";

function formatCompactDate(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "-";
  }
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return normalized;
}

function buildResultPath(
  reportId: number,
  resultId: number,
  filters: DetailFilters,
  options?: { inspection?: string; panel?: string }
): string {
  const searchParams = new URLSearchParams(buildSearch(filters).replace(/^\?/, ""));
  if (options?.inspection) {
    searchParams.set("inspection", options.inspection);
  } else {
    searchParams.delete("inspection");
  }
  if (options?.panel) {
    searchParams.set("panel", options.panel);
  } else {
    searchParams.delete("panel");
  }
  const search = searchParams.toString();
  return search ? `/reports/${reportId}/results/${resultId}?${search}` : `/reports/${reportId}/results/${resultId}`;
}

function getInspectionIssues(issues: ReportIssue[], inspection: ReportInspection): ReportIssue[] {
  return issues.filter((issue) => {
    const issueInspectionId = readMetadataString(issue.metadata, "inspection_id");
    const issueSkillId = readMetadataString(issue.metadata, "skill_id");
    const issueSkillName = readMetadataString(issue.metadata, "skill_name");
    if (issueInspectionId && issueInspectionId === inspection.inspection_id) {
      return true;
    }
    if (issueSkillId && issueSkillId === inspection.skill_id) {
      return true;
    }
    if (inspection.skill_name && issueSkillName && issueSkillName === inspection.skill_name) {
      return true;
    }
    return false;
  });
}

function renderRawResult(rawResult: string | null) {
  const content = String(rawResult || "").trim();
  if (!content) {
    return <p className={styles.analysisCopy}>当前 inspection 没有返回详细分析文本。</p>;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    return (
      <pre className={styles.rawResultBlock}>
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    return <div className={styles.markdownBody}>{renderMarkdownBlocks(content)}</div>;
  }
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  for (match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={`${match.index}-bold`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code className={styles.inlineCode} key={`${match.index}-code`}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderMarkdownBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```([\w-]+)?$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || "";
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push(
        <pre className={styles.rawResultBlock} key={`code-${blocks.length}`}>
          <code data-language={language || undefined}>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(4, headingMatch[1].length);
      const headingContent = renderInlineMarkdown(headingMatch[2]);
      if (level === 1) {
        blocks.push(<h1 className={styles.markdownH1} key={`h1-${blocks.length}`}>{headingContent}</h1>);
      } else if (level === 2) {
        blocks.push(<h2 className={styles.markdownH2} key={`h2-${blocks.length}`}>{headingContent}</h2>);
      } else if (level === 3) {
        blocks.push(<h3 className={styles.markdownH3} key={`h3-${blocks.length}`}>{headingContent}</h3>);
      } else {
        blocks.push(<h4 className={styles.markdownH4} key={`h4-${blocks.length}`}>{headingContent}</h4>);
      }
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr className={styles.markdownHr} key={`hr-${blocks.length}`} />);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul className={styles.analysisList} key={`ul-${blocks.length}`}>
          {items.map((item, itemIndex) => (
            <li key={`li-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol className={styles.analysisListOrdered} key={`ol-${blocks.length}`}>
          {items.map((item, itemIndex) => (
            <li key={`oli-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        /^```/.test(current) ||
        /^(#{1,4})\s+/.test(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        /^---+$/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push(
      <p className={styles.analysisCopy} key={`p-${blocks.length}`}>
        {renderInlineMarkdown(paragraphLines.join(" "))}
      </p>
    );
  }

  return blocks;
}

function formatRectificationState(order: RectificationOrderRecord): string {
  return getRectificationStateLabel(order);
}

function readSelectedIssueIds(reviewPayload: ReportDetail["results"][number]["review_payload"]): number[] {
  if (!reviewPayload || typeof reviewPayload !== "object" || Array.isArray(reviewPayload)) {
    return [];
  }
  const selectedIssues = (reviewPayload as Record<string, unknown>).selected_issues;
  if (!Array.isArray(selectedIssues)) {
    return [];
  }
  return selectedIssues
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return 0;
      }
      return Number(item.id);
    })
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function ReportResultDetailView({
  activeInspectionId,
  activePanel,
  currentUser,
  defaultShouldCorrectedDays,
  filters,
  maxRectificationDescriptionLength,
  previewImage,
  rectificationOrders,
  report,
  resultId
}: {
  activeInspectionId: string;
  activePanel: string;
  currentUser: SessionUser;
  defaultShouldCorrectedDays: number;
  filters: DetailFilters;
  maxRectificationDescriptionLength: number;
  previewImage: boolean;
  rectificationOrders: RectificationOrderRecord[];
  report: ReportDetail;
  resultId: number;
}) {
  const canReview = currentUser.permissions.includes("review:write");
  const scopedStoreIds = buildScopeStoreIds(report.stores, filters);
  const visibleResults = filterImages(report.results, scopedStoreIds, filters);
  const resultPool = visibleResults.length > 0 ? visibleResults : report.results;
  const selectedResult =
    resultPool.find((result) => result.id === resultId) ?? report.results.find((result) => result.id === resultId) ?? null;

  if (!selectedResult) {
    notFound();
  }

  const navigationPool = resultPool.some((result) => result.id === selectedResult.id) ? resultPool : report.results;
  const selectedIndex = navigationPool.findIndex((result) => result.id === selectedResult.id);
  const previousResult = selectedIndex > 0 ? navigationPool[selectedIndex - 1] : null;
  const nextResult =
    selectedIndex >= 0 && selectedIndex < navigationPool.length - 1 ? navigationPool[selectedIndex + 1] : null;
  const storeById = new Map(report.stores.map((store) => [store.store_id, store]));
  const selectedStore = selectedResult.store_id ? storeById.get(selectedResult.store_id) ?? null : null;
  const selectedIssues = report.issues.filter((issue) => matchesIssueToImage(issue, selectedResult));
  const selectedInspections = report.inspections
    .filter((inspection) => matchesInspectionToImage(inspection, selectedResult))
    .sort((left, right) => left.display_order - right.display_order);
  const selectedResultSemanticState = classifyReportResultSemantics(selectedIssues, selectedInspections);
  const selectedLogs = report.review_logs.filter((log) => log.result_id === selectedResult.id);
  const backPath = `/reports/${report.id}${buildSearch(filters)}`;
  const currentPath = buildResultPath(report.id, selectedResult.id, filters, {
    inspection: activeInspectionId,
    panel: activePanel
  });
  const previewPath = `${currentPath}${currentPath.includes("?") ? "&" : "?"}preview=1`;
  const currentImageUrl = readMetadataString(selectedResult.metadata, "display_url") || selectedResult.url;
  const currentCameraAlias = readMetadataString(selectedResult.metadata, "camera_alias") || "未标注摄像头";
  const currentStoreName = selectedResult.store_name || "未绑定门店";
  const currentStoreCode = selectedStore?.store_id || selectedResult.store_id || "";
  const initialSelectedIssueIds = readSelectedIssueIds(selectedResult.review_payload);
  const inspectionTabs = selectedInspections.map((inspection) => ({
    inspection,
    issues: getInspectionIssues(selectedIssues, inspection)
  }));
  const resolvedPanel = activePanel === "review" ? "review" : "inspection";
  const defaultInspectionId = inspectionTabs[0]?.inspection.inspection_id || "";
  const resolvedInspectionId =
    resolvedPanel === "review"
      ? ""
      : inspectionTabs.find((item) => item.inspection.inspection_id === activeInspectionId)?.inspection.inspection_id || defaultInspectionId;
  const activeInspection =
    resolvedInspectionId ? inspectionTabs.find((item) => item.inspection.inspection_id === resolvedInspectionId) || null : null;

  return (
    <main className="page-shell">
      <DashboardHeader
        currentUser={currentUser}
        subtitle="围绕单条巡检记录完成核查、备注和复核动作。"
        title="巡检结果处理"
      />

      <section className="section">
        <Card className={styles.overviewCard}>
          <CardContent className={styles.overviewBody}>
            <div className={styles.overviewTop}>
              <div className={styles.breadcrumbRow}>
                <Badge className={styles.overviewBadge} variant="outline">
                  巡检记录
                </Badge>
                <span className={styles.breadcrumbSlash}>›</span>
                <Badge className={styles.overviewBadge} variant="outline">
                  报告详情
                </Badge>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link href={backPath}>返回列表</Link>
              </Button>
            </div>

            <div className={styles.overviewMain}>
                <div className={styles.overviewIdentity}>
                <div className={styles.overviewIcon}>
                  <Store size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className={styles.overviewTitle}>
                    {currentStoreName}
                    {currentStoreCode ? `（${currentStoreCode}）` : ""}
                  </h2>
                </div>
              </div>

              <div className={styles.overviewMetaRow}>
                <Badge className={styles.dateBadge} variant="outline">
                  {formatCompactDate(selectedResult.captured_at)}
                </Badge>
                <Badge className={styles.metaPill} variant="outline">
                  1 张图片
                </Badge>
                <Badge
                  className={styles.alertBadge}
                  variant={getReportResultSemanticTone(selectedResultSemanticState)}
                >
                  {getReportResultSemanticSummaryLabel(selectedResultSemanticState, selectedIssues.length)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={`section ${styles.workspaceGrid}`}>
        <Card className={styles.previewCard}>
          <CardContent className={styles.previewCardBody}>
            <div className={styles.previewWrap}>
              <img alt={currentStoreName} className={styles.preview} src={currentImageUrl} />
            </div>
            <Button asChild className={styles.previewButton} size="sm" variant="secondary">
              <Link href={previewPath}>
                预览图片
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={styles.analysisCard}>
          <CardContent className={styles.analysisCardBody}>
            <div className={styles.tabBar}>
              {inspectionTabs.map(({ inspection, issues }) => {
                const isActive = resolvedPanel !== "review" && inspection.inspection_id === resolvedInspectionId;
                return (
                  <Link
                    className={`${styles.tabLink} ${isActive ? styles.tabLinkActive : ""}`}
                    href={buildResultPath(report.id, selectedResult.id, filters, { inspection: inspection.inspection_id })}
                    key={inspection.id}
                  >
                    <span>{inspection.skill_name || inspection.skill_id}</span>
                    <span className={styles.tabCount}>{issues.length}</span>
                  </Link>
                );
              })}
              <Link
                className={`${styles.tabLink} ${resolvedPanel === "review" ? styles.reviewTabLinkActive : ""}`}
                href={buildResultPath(report.id, selectedResult.id, filters, { panel: "review" })}
              >
                复核操作
              </Link>
            </div>

            {resolvedPanel === "review" ? (
              <div className={styles.reviewWorkspace}>
                <ResultReviewWorkflow
                  actionUrl={`/api/reports/${report.id}/images/${selectedResult.id}/review-status`}
                  canReview={canReview}
                  currentImageUrl={currentImageUrl}
                  currentPath={currentPath}
                  defaultShouldCorrectedDays={defaultShouldCorrectedDays}
                  initialReviewState={selectedResult.review_state}
                  initialSelectedIssueIds={initialSelectedIssueIds}
                  issues={selectedIssues.map((issue) => ({ id: issue.id, title: issue.title }))}
                  maxDescriptionLength={maxRectificationDescriptionLength}
                  semanticState={selectedResultSemanticState}
                />

                <div className={styles.reviewGrid}>
                  <div className={styles.reviewBlock}>
                    <h3 className={styles.blockTitle}>最近记录</h3>
                    {selectedLogs.length > 0 ? (
                      <div className={styles.timelineList}>
                        {selectedLogs.map((log) => (
                          <article className={styles.timelineItem} key={log.id}>
                            <div className={styles.timelineHead}>
                              <strong>{log.operator_name}</strong>
                              <span>{formatDisplayDate(log.created_at)}</span>
                            </div>
                            <p>
                              从 {formatResultReviewState(log.from_status)} 调整为 {formatResultReviewState(log.to_status)}
                            </p>
                            {log.note ? <div className={styles.timelineNote}>{log.note}</div> : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState>当前结果还没有复核记录。</EmptyState>
                    )}
                  </div>

                  <div className={styles.reviewBlock}>
                    <h3 className={styles.blockTitle}>整改单记录</h3>
                    {rectificationOrders.length > 0 ? (
                      <div className={styles.timelineList}>
                        {rectificationOrders.map((order) => (
                          <article className={styles.timelineItem} key={order.id}>
                            <div className={styles.timelineHead}>
                              <strong>
                                整改单 {order.huiyunying_order_id || `#${order.id}`}
                              </strong>
                              <span>{formatRectificationState(order)}</span>
                            </div>
                            <p>要求整改日期：{order.should_corrected || "-"}</p>
                            <p>创建时间：{formatDisplayDate(order.created_at)}</p>
                            {order.real_corrected_time ? (
                              <p>整改完成时间：{formatDisplayDate(order.real_corrected_time)}</p>
                            ) : null}
                            {order.selected_issues.length > 0 ? (
                              <ul className={styles.issueSummaryList}>
                                {order.selected_issues.map((issue) => (
                                  <li key={`${order.id}-${issue.id}`}>{issue.title}</li>
                                ))}
                              </ul>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState>当前结果还没有下发整改单。</EmptyState>
                    )}
                  </div>
                </div>
              </div>
            ) : activeInspection ? (
              <div className={styles.analysisWorkspace}>
                <div className={styles.alertPanel}>
                  <div className={styles.alertHead}>
                    <strong>{getReportResultSemanticSummaryLabel(selectedResultSemanticState, activeInspection.issues.length)}</strong>
                  </div>
                  {activeInspection.issues.length > 0 ? (
                    <ul className={styles.issueSummaryList}>
                      {activeInspection.issues.map((issue) => (
                        <li key={issue.id}>{issue.title}</li>
                      ))}
                    </ul>
                  ) : selectedResultSemanticState === "pass" ? (
                    <p className={styles.analysisCopy}>当前图片已完成巡检，未发现需要复核的问题项。</p>
                  ) : selectedResultSemanticState === "inspection_failed" ? (
                    <p className={styles.analysisCopy}>当前图片存在巡检失败记录，本次仅支持本地复核记录异常情况，不下发整改单。</p>
                  ) : (
                    <p className={styles.analysisCopy}>当前图片没有形成明确问题项，可结合算法返回内容判断是否属于目标缺失、画面异常或其他无法判定场景。</p>
                  )}
                </div>

                <div className={styles.analysisPanel}>
                  {renderRawResult(activeInspection.inspection.raw_result)}
                </div>
              </div>
            ) : (
              <EmptyState>当前结果还没有可展示的算法巡检明细。</EmptyState>
            )}
          </CardContent>
        </Card>
      </section>

      {previewImage ? (
        <div className={styles.imageModalOverlay}>
          <Link aria-label="关闭图片预览" className={styles.imageModalBackdrop} href={currentPath} />
          <Link aria-label="关闭图片预览" className={styles.imageModalCloseArea} href={currentPath} />
          <Card className={styles.imageModalCard}>
            <CardContent className={styles.imageModalBody}>
              <div className={styles.imageModalHeader}>
                <strong className={styles.blockTitle}>图片预览</strong>
                <Button asChild size="sm" variant="secondary">
                  <Link href={currentPath}>关闭</Link>
                </Button>
              </div>
              <div className={styles.imageModalFrame}>
                <img alt={currentStoreName} className={styles.imageModalPreview} src={currentImageUrl} />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
