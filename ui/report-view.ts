import type { JsonValue } from "@/backend/shared/json";
import type { ProgressState, ResultReviewState } from "@/backend/report/report.types";

const reportTypeLabels: Record<string, string> = {
  daily: "日常报告",
  special: "专项报告",
  stage: "阶段报告",
  monthly_operation: "月度运营巡检",
  weekly_operation: "周度运营巡检",
  daily_operation: "日常巡检",
  special_audit: "专项复核"
};

export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) {
    return "未提供";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatResultReviewState(status: ResultReviewState | string): string {
  return status === "completed" || status === "reviewed" ? "已复核" : "待复核";
}

export function formatProgressState(status: ProgressState | string, completed = 0, total = 0): string {
  if (status === "completed") {
    return "已完成";
  }
  if (status === "in_progress") {
    return `未完成 ${completed}/${total}`;
  }
  return "待复核";
}

export function formatReportType(value: string): string {
  if (!value) {
    return "常规报告";
  }

  return (
    reportTypeLabels[value] ||
    value
      .split(/[_-]+/)
      .filter(Boolean)
      .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
      .join(" ")
  );
}

export function formatDateRange(start: string, end: string): string {
  if (!start && !end) {
    return "时间未提供";
  }

  if (!start || !end) {
    return start || end;
  }

  return `${start} - ${end}`;
}

export function formatMetricLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getMetricEntries(summaryMetrics: Record<string, JsonValue>): Array<[string, JsonValue]> {
  return Object.entries(summaryMetrics || {}).slice(0, 8);
}

export function getCompletionRatio(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}
