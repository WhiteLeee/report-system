"use client";

import { useMemo, useState } from "react";

import styles from "./report-result-detail-view.module.css";

import { Button } from "@/components/ui/button";

type ReviewIssueOption = {
  id: number;
  title: string;
};

export function ReviewIssueSelector({
  disabled,
  formId,
  initialSelectedIssueIds,
  issues
}: {
  disabled: boolean;
  formId: string;
  initialSelectedIssueIds: number[];
  issues: ReviewIssueOption[];
}) {
  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>(() =>
    Array.from(
      new Set(
        initialSelectedIssueIds.filter((issueId) =>
          issues.some((issue) => issue.id === issueId)
        )
      )
    )
  );

  const selectedIssues = useMemo(
    () => issues.filter((issue) => selectedIssueIds.includes(issue.id)),
    [issues, selectedIssueIds]
  );

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

  return (
    <div className={styles.reviewIssueSelector}>
      <div className={styles.alertHead}>
        <strong>当前结果概况</strong>
        <span className={styles.selectionSummary}>
          已选择 {selectedIssueIds.length} / {issues.length}
        </span>
      </div>
      <input form={formId} name="selected_issues_json" type="hidden" value={JSON.stringify(selectedIssues)} />
      {issues.length > 0 ? (
        <>
          <div className={styles.selectionToolbar}>
            <Button className={styles.selectionAction} disabled={disabled} onClick={selectAll} size="sm" type="button" variant="ghost">
              全选
            </Button>
            <Button className={styles.selectionAction} disabled={disabled} onClick={clearAll} size="sm" type="button" variant="ghost">
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
                      disabled={disabled}
                      form={formId}
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
  );
}
