import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ISSUE_SELECTION_MODAL_MESSAGE,
  REVIEW_DISPOSITION_NOTE_REQUIRED_MESSAGE,
  REVIEW_DISPOSITION_REQUIRED_MESSAGE,
  SHOULD_CORRECTED_REQUIRED_MESSAGE,
  validateCompletedReviewSubmission
} from "../ui/report/result-review-workflow.validation";

test("未勾选问题项时弹出确认模态提示", () => {
  const result = validateCompletedReviewSubmission({
    requiresRectification: true,
    selectedIssueCount: 0,
    shouldCorrected: "2026-04-08"
  });

  assert.equal(result.shouldCorrectedError, "");
  assert.equal(result.reviewDispositionError, "");
  assert.equal(result.shouldShowIssueSelectionModal, true);
  assert.equal(ISSUE_SELECTION_MODAL_MESSAGE, "当前未勾选问题项，请先勾选至少一个问题项后再提交整改单。");
});

test("整改日期为空时返回字段必填错误并阻止弹出问题项模态", () => {
  const result = validateCompletedReviewSubmission({
    requiresRectification: true,
    selectedIssueCount: 2,
    shouldCorrected: "  "
  });

  assert.equal(result.shouldCorrectedError, SHOULD_CORRECTED_REQUIRED_MESSAGE);
  assert.equal(result.reviewDispositionError, "");
  assert.equal(result.shouldShowIssueSelectionModal, false);
});

test("本地复核场景需要复核结论但不要求整改日期也不要求勾选问题项", () => {
  const result = validateCompletedReviewSubmission({
    requiresRectification: false,
    reviewAction: "complete_only",
    reviewDisposition: "no_rectification",
    selectedIssueCount: 0,
    shouldCorrected: "  "
  });

  assert.equal(result.shouldCorrectedError, "");
  assert.equal(result.reviewDispositionError, "");
  assert.equal(result.shouldShowIssueSelectionModal, false);
});

test("本地复核缺少结论时阻止提交", () => {
  const result = validateCompletedReviewSubmission({
    requiresRectification: true,
    reviewAction: "complete_only",
    reviewDisposition: "",
    selectedIssueCount: 0,
    shouldCorrected: "  "
  });

  assert.equal(result.shouldCorrectedError, "");
  assert.equal(result.reviewDispositionError, REVIEW_DISPOSITION_REQUIRED_MESSAGE);
  assert.equal(result.shouldShowIssueSelectionModal, false);
});

test("本地复核选择其他结论时备注必填", () => {
  const result = validateCompletedReviewSubmission({
    requiresRectification: true,
    reviewAction: "complete_only",
    reviewDisposition: "other",
    note: " ",
    selectedIssueCount: 0,
    shouldCorrected: "  "
  });

  assert.equal(result.shouldCorrectedError, "");
  assert.equal(result.reviewDispositionError, REVIEW_DISPOSITION_NOTE_REQUIRED_MESSAGE);
  assert.equal(result.shouldShowIssueSelectionModal, false);
});
