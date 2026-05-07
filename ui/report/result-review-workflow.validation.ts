export const SHOULD_CORRECTED_REQUIRED_MESSAGE = "请选择整改日期";
export const ISSUE_SELECTION_MODAL_MESSAGE = "当前未勾选问题项，请先勾选至少一个问题项后再提交整改单。";
export const REVIEW_DISPOSITION_REQUIRED_MESSAGE = "请选择复核结论";
export const REVIEW_DISPOSITION_NOTE_REQUIRED_MESSAGE = "选择其他结论时请填写复核备注";

export function validateCompletedReviewSubmission(input: {
  requiresRectification: boolean;
  reviewAction?: "create_rectification" | "complete_only";
  reviewDisposition?: string;
  note?: string;
  selectedIssueCount: number;
  shouldCorrected: string;
}): {
  shouldCorrectedError: string;
  reviewDispositionError: string;
  shouldShowIssueSelectionModal: boolean;
} {
  const reviewAction = input.reviewAction ?? (input.requiresRectification ? "create_rectification" : "complete_only");
  if (reviewAction === "complete_only") {
    const disposition = String(input.reviewDisposition || "").trim();
    if (!disposition) {
      return {
        shouldCorrectedError: "",
        reviewDispositionError: REVIEW_DISPOSITION_REQUIRED_MESSAGE,
        shouldShowIssueSelectionModal: false
      };
    }
    if (disposition === "other" && !String(input.note || "").trim()) {
      return {
        shouldCorrectedError: "",
        reviewDispositionError: REVIEW_DISPOSITION_NOTE_REQUIRED_MESSAGE,
        shouldShowIssueSelectionModal: false
      };
    }
    return {
      shouldCorrectedError: "",
      reviewDispositionError: "",
      shouldShowIssueSelectionModal: false
    };
  }

  const normalizedShouldCorrected = String(input.shouldCorrected || "").trim();
  const selectedIssueCount = Number.isFinite(input.selectedIssueCount) ? Math.max(0, Math.floor(input.selectedIssueCount)) : 0;

  if (!normalizedShouldCorrected) {
    return {
      shouldCorrectedError: SHOULD_CORRECTED_REQUIRED_MESSAGE,
      reviewDispositionError: "",
      shouldShowIssueSelectionModal: false
    };
  }

  return {
    shouldCorrectedError: "",
    reviewDispositionError: "",
    shouldShowIssueSelectionModal: selectedIssueCount === 0
  };
}
