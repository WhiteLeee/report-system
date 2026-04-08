import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ISSUE_SELECTION_MODAL_MESSAGE,
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
  assert.equal(result.shouldShowIssueSelectionModal, false);
});

test("本地复核场景不要求整改日期也不要求勾选问题项", () => {
  const result = validateCompletedReviewSubmission({
    requiresRectification: false,
    selectedIssueCount: 0,
    shouldCorrected: "  "
  });

  assert.equal(result.shouldCorrectedError, "");
  assert.equal(result.shouldShowIssueSelectionModal, false);
});
