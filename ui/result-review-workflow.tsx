"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import styles from "./report-result-detail-view.module.css";

import type { ReviewSelectedIssue, ResultReviewState } from "@/backend/report/report.types";
import { buildRectificationPreviewOrders, RectificationPreviewError } from "@/lib/rectification-preview";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReviewIssueOption = {
  id: number;
  title: string;
};

export function ResultReviewWorkflow({
  actionUrl,
  canReview,
  currentImageUrl,
  currentPath,
  initialSelectedIssueIds,
  initialReviewState,
  issues,
  maxDescriptionLength
}: {
  actionUrl: string;
  canReview: boolean;
  currentImageUrl: string;
  currentPath: string;
  initialSelectedIssueIds: number[];
  initialReviewState: ResultReviewState;
  issues: ReviewIssueOption[];
  maxDescriptionLength: number;
}) {
  const router = useRouter();
  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>(() =>
    Array.from(new Set(initialSelectedIssueIds.filter((issueId) => issues.some((issue) => issue.id === issueId))))
  );
  const [shouldCorrected, setShouldCorrected] = useState("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processingOpen, setProcessingOpen] = useState(false);
  const [previewOrders, setPreviewOrders] = useState<ReturnType<typeof buildRectificationPreviewOrders>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const selectedIssues: ReviewSelectedIssue[] = issues.filter((issue) => selectedIssueIds.includes(issue.id));

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
          note,
          return_to: currentPath,
          selected_issues_json: JSON.stringify(selectedIssues)
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
    try {
      const nextPreviewOrders = buildRectificationPreviewOrders({
        selectedIssues,
        note,
        shouldCorrected,
        imageUrls: currentImageUrl ? [currentImageUrl] : [],
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
              <button className={styles.selectionAction} disabled={!canReview || isSubmitting} onClick={selectAll} type="button">
                全选
              </button>
              <button className={styles.selectionAction} disabled={!canReview || isSubmitting} onClick={clearAll} type="button">
                清空
              </button>
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
          <p className={styles.analysisCopy}>当前结果没有关联问题项，可以直接补充备注后完成复核。</p>
        )}
      </div>

      <div className={styles.reviewBlock}>
        <h3 className={styles.blockTitle}>复核备注</h3>
        {canReview ? (
          <div className={styles.reviewForm}>
            <div className="field">
              <label htmlFor="shouldCorrected">整改截止日期</label>
              <Input
                id="shouldCorrected"
                name="should_corrected"
                onChange={(event) => setShouldCorrected(event.target.value)}
                type="date"
                value={shouldCorrected}
              />
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
            <div className={styles.reviewActions}>
              <Button
                disabled={initialReviewState === "pending" || isSubmitting}
                onClick={handleBackToPending}
                size="sm"
                type="button"
                variant="secondary"
              >
                退回待复核
              </Button>
              <Button
                disabled={initialReviewState === "completed" || isSubmitting}
                onClick={handleSubmitCompletedPreview}
                size="sm"
                type="button"
              >
                提交复核
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
                  <img alt="当前巡检结果图片预览" className={styles.reviewModalImage} src={currentImageUrl} />
                </div>
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
                返回修改
              </Button>
              <Button disabled={isSubmitting} onClick={handleConfirmSubmit} size="sm" type="button">
                提交整改单
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
                  <p className={styles.analysisCopy}>正在创建整改单，请稍候。</p>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
