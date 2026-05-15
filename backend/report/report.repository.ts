import type { RequestContext } from "@/backend/auth/request-context";
import type {
  PublishReceipt,
  PublishStatusReceipt,
  CreateManualReportIssueInput,
  ReportDetail,
  ReportFilters,
  ReportIssue,
  ReportPublishPayload,
  ReportReviewLog,
  ReportSummary,
  ReviewSelectedIssue,
  ReviewStatusUpdateInput,
  ReviewResultUpdateResult,
  ResultReviewState
} from "@/backend/report/report.types";

export interface ReportRepository {
  publishReport(payload: ReportPublishPayload, context?: RequestContext): Promise<any>;
  getPublishStatus(publishId: string, context?: RequestContext): Promise<any>;
  listReports(filters?: ReportFilters, context?: RequestContext): Promise<any>;
  getReportDetail(reportId: number, context?: RequestContext): Promise<any>;
  updateImageReviewStatus(
    reportId: number,
    imageId: number,
    input: ReviewStatusUpdateInput,
    context?: RequestContext
  ): Promise<any>;
  createManualIssue(input: CreateManualReportIssueInput, context?: RequestContext): Promise<any>;
  listReviewLogs(
    reportId: number,
    limit?: number,
    imageId?: number,
    context?: RequestContext
  ): Promise<any>;
}
