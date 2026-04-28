"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import styles from "./report-result-detail-view.module.css";

import type { ReviewSelectedIssue, ResultReviewState } from "@/backend/report/report.types";
import type { ReportResultSemanticState } from "@/ui/report/report-result-semantics";
import { buildRectificationPreviewOrders, RectificationPreviewError } from "@/lib/rectification-preview";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import {
  ISSUE_SELECTION_MODAL_MESSAGE,
  validateCompletedReviewSubmission
} from "@/ui/report/result-review-workflow.validation";

type ReviewIssueOption = {
  id: number;
  title: string;
  imageUrls?: string[];
};

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultShouldCorrectedDate(defaultDays: number): string {
  const nextDate = new Date();
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + Math.max(0, Math.floor(defaultDays)));
  return formatDateInputValue(nextDate);
}

function uniqueNonEmptyStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export function ResultReviewWorkflow({
  actionUrl,
  activeInspectionId,
  canReview,
  currentImageUrl,
  currentPath,
  initialSelectedIssueIds,
  initialReviewState,
  failedInspectionId,
  imageNotice,
  issues,
  maxDescriptionLength,
  rectificationImageUrl,
  semanticState,
  defaultShouldCorrectedDays
}: {
  actionUrl: string;
  activeInspectionId?: string;
  canReview: boolean;
  currentImageUrl: string;
  currentPath: string;
  failedInspectionId?: string;
  initialSelectedIssueIds: number[];
  initialReviewState: ResultReviewState;
  imageNotice?: string;
  issues: ReviewIssueOption[];
  maxDescriptionLength: number;
  rectificationImageUrl?: string;
  semanticState: ReportResultSemanticState;
  defaultShouldCorrectedDays: number;
}) {
  const router = useRouter();
  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>(() =>
    Array.from(new Set(initialSelectedIssueIds.filter((issueId) => issues.some((issue) => issue.id === issueId))))
  );
  const [shouldCorrected, setShouldCorrected] = useState(() => buildDefaultShouldCorrectedDate(defaultShouldCorrectedDays));
  const [shouldCorrectedError, setShouldCorrectedError] = useState("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [issueSelectionModalOpen, setIssueSelectionModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processingOpen, setProcessingOpen] = useState(false);
  const [previewOrders, setPreviewOrders] = useState<ReturnType<typeof buildRectificationPreviewOrders>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const selectedIssueOptions = issues.filter((issue) => selectedIssueIds.includes(issue.id));
  const selectedIssues: ReviewSelectedIssue[] = selectedIssueOptions.map((issue) => ({ id: issue.id, title: issue.title }));
  const requiresRectification = semanticState === "issue_found" || issues.length > 0;
  const effectiveRectificationImageUrls = uniqueNonEmptyStrings([
    ...selectedIssueOptions.flatMap((issue) => issue.imageUrls ?? []),
    rectificationImageUrl || currentImageUrl || ""
  ]).slice(0, 9);
  const effectiveRectificationImageUrl = effectiveRectificationImageUrls[0] || "";

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleIssue(issueId: number) {
    setSelectedIssueIds((current) =>
      current.includes(issueId) ? current.filter((value) => value !== issueId) : [...current, issueId]
    );
  }

  function selectAll() {
    setSelectedIssueIds(issues.map((issue) => issue.id));
  }

  function clearAll() {
    setSelectedIssueIds([]);
  }

  async function submitReview(reviewStatus: "pending" | "completed") {
    setErrorMessage("");
    try {
      const response = await fetch(actionUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          review_status: reviewStatus,
          should_corrected: shouldCorrected,
          active_inspection_id: activeInspectionId || "",
          failed_inspection_id: failedInspectionId || "",
          note,
          return_to: currentPath,
          selected_issues_json: JSON.stringify(selectedIssues),
          rectification_image_url: effectiveRectificationImageUrl,
          rectification_image_urls_json: JSON.stringify(effectiveRectificationImageUrls),
          result_semantic_state: semanticState
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(payload.detail || payload.error || "提交复核失败。");
      }

      router.refresh();
    } finally {
      setIsSubmitting(false);
      setProcessingOpen(false);
    }
  }

  function handleSubmitCompletedPreview() {
    setErrorMessage("");
    const validationResult = validateCompletedReviewSubmission({
      requiresRectification,
      selectedIssueCount: selectedIssues.length,
      shouldCorrected
    });
    setShouldCorrectedError(validationResult.shouldCorrectedError);
    if (validationResult.shouldCorrectedError) {
      return;
    }
    if (validationResult.shouldShowIssueSelectionModal) {
      setIssueSelectionModalOpen(true);
      return;
    }
    if (!requiresRectification) {
      setIsSubmitting(true);
      setProcessingOpen(true);
      void submitReview("completed").catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "提交复核失败。");
      });
      return;
    }
    try {
      const nextPreviewOrders = buildRectificationPreviewOrders({
        selectedIssues,
        note,
        shouldCorrected,
        imageUrls: effectiveRectificationImageUrls,
        maxLength: maxDescriptionLength
      });
      setPreviewOrders(nextPreviewOrders);
      setConfirmOpen(true);
    } catch (error) {
      if (error instanceof RectificationPreviewError) {
        setErrorMessage(error.message);
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "生成整改单预览失败。");
    }
  }

  function handleBackToPending() {
    setIsSubmitting(true);
    void submitReview("pending").catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "退回待复核失败。");
    });
  }

  function handleConfirmSubmit() {
    setIsSubmitting(true);
    setConfirmOpen(false);
    setProcessingOpen(true);
    void submitReview("completed").catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "创建整改单失败。");
    });
  }

  function handleIssueSelectionConfirm() {
    setIsSubmitting(true);
    setIssueSelectionModalOpen(false);
    setProcessingOpen(true);
    void submitReview("completed").catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "创建整改单失败。");
    });
  }

  return (
    <>
      <div className={styles.reviewIssueSelector}>
        <div className={styles.alertHead}>
          <strong>当前结果概况</strong>
          <span className={styles.selectionSummary}>
            已选择 {selectedIssueIds.length} / {issues.length}
          </span>
        </div>
        {issues.length > 0 ? (
          <>
            <div className={styles.selectionToolbar}>
              <Button className={styles.selectionAction} disabled={!canReview || isSubmitting} onClick={selectAll} size="sm" type="button" variant="ghost">
                全选
              </Button>
              <Button className={styles.selectionAction} disabled={!canReview || isSubmitting} onClick={clearAll} size="sm" type="button" variant="ghost">
                清空
              </Button>
            </div>
            <ul className={styles.issueChecklist}>
              {issues.map((issue) => {
                const checked = selectedIssueIds.includes(issue.id);
                return (
                  <li className={styles.issueChecklistItem} key={issue.id}>
                    <label className={styles.issueChecklistLabel}>
                      <input
                        checked={checked}
                        className={styles.issueCheckbox}
                        disabled={!canReview || isSubmitting}
                        onChange={() => toggleIssue(issue.id)}
                        type="checkbox"
                      />
                      <span className={styles.issueChecklistText}>{issue.title}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className={styles.analysisCopy}>
            {requiresRectification
              ? "当前结果没有关联问题项，提交整改单前需要先确认至少一个问题项。"
              : "当前结果无需下发整改单，本次提交仅在本地完成复核。"}
          </p>
        )}
      </div>

      <div className={styles.reviewBlock}>
        <h3 className={styles.blockTitle}>复核备注</h3>
        {canReview ? (
          <div className={styles.reviewForm}>
            <div className="field">
              <label htmlFor="shouldCorrected">整改截止日期</label>
              <DatePickerField
                className={shouldCorrectedError ? styles.reviewInputError : undefined}
                disabled={!requiresRectification}
                id="shouldCorrected"
                name="should_corrected"
                onValueChange={(nextValue) => {
                  setShouldCorrected(nextValue);
                  if (shouldCorrectedError) {
                    setShouldCorrectedError("");
                  }
                }}
                value={shouldCorrected}
              />
              {!requiresRectification ? (
                <div className={styles.analysisCopy}>当前结果状态不需要下发整改单，整改截止日期不会参与本次提交。</div>
              ) : null}
              {shouldCorrectedError ? (
                <div className={styles.reviewFieldError} id="shouldCorrected-error" role="alert">
                  {shouldCorrectedError}
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="note">备注内容</label>
              <Textarea
                id="note"
                name="note"
                onChange={(event) => setNote(event.target.value)}
                placeholder="例如：已与门店确认问题属实，建议本周完成整改后再次复核。"
                value={note}
              />
            </div>
            {errorMessage ? <div className={styles.reviewError}>{errorMessage}</div> : null}
            {imageNotice ? <div className={styles.imageFallbackNotice}>{imageNotice}</div> : null}
            <div className={styles.reviewActions}>
              <Button
                disabled={initialReviewState === "pending" || isSubmitting}
                onClick={handleBackToPending}
                size="sm"
                type="button"
                variant="secondary"
              >
                退回
              </Button>
              <Button
                disabled={initialReviewState === "completed" || isSubmitting}
                onClick={handleSubmitCompletedPreview}
                size="sm"
                type="button"
              >
                {requiresRectification ? "提交" : "提交"}
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState>你当前只有查看权限，无法更新复核状态。</EmptyState>
        )}
      </div>

      {mounted && confirmOpen
        ? createPortal(
        <div className={styles.reviewModalOverlay}>
          <div
            className={styles.reviewModalBackdrop}
            onClick={() => {
              setConfirmOpen(false);
              setPreviewOrders([]);
            }}
          />
          <div className={styles.reviewModalCard}>
            <div className={styles.reviewModalHeader}>
              <div>
                <h3 className={styles.blockTitle}>确认整改单内容</h3>
                <p className={styles.analysisCopy}>确认后才会调用慧运营 API 创建整改单，并同步完成本次复核。</p>
              </div>
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  setPreviewOrders([]);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                关闭
              </Button>
            </div>
            <div className={styles.reviewModalLayout}>
              <section className={styles.reviewModalImagePanel}>
                <div className={styles.reviewModalImageFrame}>
                  {effectiveRectificationImageUrl ? (
                    <img alt="当前巡检结果图片预览" className={styles.reviewModalImage} src={effectiveRectificationImageUrl} />
                  ) : (
                    <div className={styles.imageUnavailable}>图片不可用</div>
                  )}
                </div>
                {effectiveRectificationImageUrls.length > 1 ? (
                  <p className={styles.previewMeta}>将随整改单下发 {effectiveRectificationImageUrls.length} 张标注图。</p>
                ) : null}
                {imageNotice ? <p className={styles.imageFallbackNotice}>{imageNotice}</p> : null}
              </section>
              <div className={styles.reviewModalBody}>
                {previewOrders.map((order, index) => (
                  <article className={styles.previewOrderCard} key={`preview-${index}`}>
                    <div className={styles.previewOrderHead}>
                      <strong>整改单 {previewOrders.length > 1 ? `#${index + 1}` : ""}</strong>
                      <span>{order.issueCount} 个问题项</span>
                    </div>
                    <p className={styles.previewMeta}>整改截止日期：{order.shouldCorrected || "-"}</p>
                    <pre className={styles.previewDescription}>{order.description}</pre>
                  </article>
                ))}
              </div>
            </div>
            <div className={styles.reviewModalActions}>
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  setPreviewOrders([]);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                返回
              </Button>
              <Button disabled={isSubmitting} onClick={handleConfirmSubmit} size="sm" type="button">
                确认创建整改单
              </Button>
            </div>
          </div>
        </div>,
          document.body
        )
        : null}

      {mounted && issueSelectionModalOpen
        ? createPortal(
            <div className={styles.reviewModalOverlay}>
              <div
                className={styles.reviewModalBackdrop}
                onClick={() => {
                  setIssueSelectionModalOpen(false);
                }}
              />
              <div className={styles.reviewModalCard}>
                <div className={styles.reviewModalHeader}>
                  <div>
                    <h3 className={styles.blockTitle}>请先勾选问题项</h3>
                    <p className={styles.analysisCopy}>{ISSUE_SELECTION_MODAL_MESSAGE}</p>
                  </div>
                </div>
                <div className={styles.reviewModalActions}>
                  <Button
                    onClick={() => {
                      setIssueSelectionModalOpen(false);
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    取消
                  </Button>
                  <Button
                    disabled={isSubmitting}
                    onClick={handleIssueSelectionConfirm}
                    size="sm"
                    type="button"
                  >
                    确认
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && processingOpen
        ? createPortal(
            <div className={styles.processingOverlay}>
              <div className={styles.processingBackdrop} />
              <div className={styles.processingCard}>
                <div className={styles.processingSpinner} />
                <div className={styles.processingContent}>
                  <h3 className={styles.blockTitle}>处理中</h3>
                  <p className={styles.analysisCopy}>
                    {requiresRectification ? "正在创建整改单，请稍候。" : "正在提交本地复核，请稍候。"}
                  </p>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
