export const SHOULD_CORRECTED_REQUIRED_MESSAGE = "请选择整改日期";
export const ISSUE_SELECTION_MODAL_MESSAGE = "当前未勾选问题项，请先勾选至少一个问题项后再提交整改单。";

export function validateCompletedReviewSubmission(input: {
  selectedIssueCount: number;
  shouldCorrected: string;
}): {
  shouldCorrectedError: string;
  shouldShowIssueSelectionModal: boolean;
} {
  const normalizedShouldCorrected = String(input.shouldCorrected || "").trim();
  const selectedIssueCount = Number.isFinite(input.selectedIssueCount) ? Math.max(0, Math.floor(input.selectedIssueCount)) : 0;

  if (!normalizedShouldCorrected) {
    return {
      shouldCorrectedError: SHOULD_CORRECTED_REQUIRED_MESSAGE,
      shouldShowIssueSelectionModal: false
    };
  }

  return {
    shouldCorrectedError: "",
    shouldShowIssueSelectionModal: selectedIssueCount === 0
  };
}
