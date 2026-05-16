import type { ReportInspection, ReportIssue } from "@/backend/report/report.types";

export type ReportResultSemanticState = "issue_found" | "pass" | "inconclusive" | "inspection_failed";

const FAILURE_STATUS_KEYWORDS = ["fail", "failed", "error", "timeout", "exception", "crash", "aborted"];
const FAILURE_TEXT_KEYWORDS = [
  "执行失败",
  "识别失败",
  "模型超时",
  "算法异常",
  "internal error",
  "timeout",
  "exception"
];
const INCONCLUSIVE_STATUS_KEYWORDS = ["inconclusive", "unknown", "skipped", "no_target", "not_applicable"];
const INCONCLUSIVE_TEXT_KEYWORDS = [
  "目标缺失",
  "巡检目标缺失",
  "未检测到",
  "未找到",
  "无法判断",
  "无法识别",
  "无法进行",
  "低置信度",
  "画面不完整",
  "图像不可用",
  "条件不足",
  "未覆盖"
];

function normalizeText(value: string | null | undefined): any {
  return String(value || "").trim().toLowerCase();
}

function containsAnyKeyword(text: string, keywords: string[]): any {
  return keywords.some((keyword) => text.includes(keyword));
}

function inspectionHasFailure(inspection: Pick<ReportInspection, "status" | "raw_result" | "error_message">): any {
  const status = normalizeText(inspection.status);
  const rawResult = normalizeText(inspection.raw_result);
  const errorMessage = normalizeText(inspection.error_message);
  if (errorMessage) {
    return true;
  }
  return (
    containsAnyKeyword(status, FAILURE_STATUS_KEYWORDS) ||
    containsAnyKeyword(rawResult, FAILURE_TEXT_KEYWORDS) ||
    containsAnyKeyword(errorMessage, FAILURE_TEXT_KEYWORDS)
  );
}

function inspectionIsInconclusive(inspection: Pick<ReportInspection, "status" | "raw_result" | "error_message">): any {
  const status = normalizeText(inspection.status);
  const rawResult = normalizeText(inspection.raw_result);
  const errorMessage = normalizeText(inspection.error_message);
  const merged = `${status}\n${rawResult}\n${errorMessage}`;
  return (
    containsAnyKeyword(status, INCONCLUSIVE_STATUS_KEYWORDS) ||
    containsAnyKeyword(merged, INCONCLUSIVE_TEXT_KEYWORDS)
  );
}

export function classifyReportResultSemantics(
  issuesOrCount: ReadonlyArray<unknown> | number,
  inspections: Array<Pick<ReportInspection, "status" | "raw_result" | "error_message">>
): any {
  const issueCount = Array.isArray(issuesOrCount)
    ? issuesOrCount.length
    : Number.isFinite(Number(issuesOrCount))
      ? Math.max(0, Math.trunc(Number(issuesOrCount)))
      : 0;
  if (issueCount > 0) {
    return "issue_found";
  }
  if (inspections.some(inspectionHasFailure)) {
    return "inspection_failed";
  }
  if (inspections.length === 0 || inspections.some(inspectionIsInconclusive)) {
    return "inconclusive";
  }
  return "pass";
}

export function getReportResultSemanticLabel(state: ReportResultSemanticState, issueCount = 0): any {
  if (state === "issue_found") {
    return `${issueCount}`;
  }
  if (state === "pass") {
    return "0";
  }
  if (state === "inspection_failed") {
    return "巡检失败";
  }
  return "无法判定";
}

export function getReportResultSemanticSummaryLabel(state: ReportResultSemanticState, issueCount?: number): any {
  if (state === "issue_found") {
    if (typeof issueCount === "number" && issueCount > 0) {
      return `发现 ${issueCount} 个问题`;
    }
    return "发现问题";
  }
  if (state === "pass") {
    return "未发现问题";
  }
  if (state === "inspection_failed") {
    return "巡检失败";
  }
  return "无法判定";
}

export function getReportResultSemanticTone(state: ReportResultSemanticState): any {
  if (state === "issue_found") {
    return "default";
  }
  if (state === "pass") {
    return "secondary";
  }
  return "outline";
}
