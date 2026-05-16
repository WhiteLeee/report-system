import type { RequestContext } from "@/backend/auth/request-context";
import type {
  CreateManualReportIssueInput,
  ReportIssue,
  ReviewResultUpdateResult,
  ResultReviewState,
  ReportReviewLog,
  ReviewSelectedIssue,
  ReviewAction,
  ReviewDisposition
} from "@/backend/report/report.types";
import type { ReportRepository } from "@/backend/report/report.repository";

export class ReportReviewService {
  constructor(private readonly repository: ReportRepository) {}

  async createManualIssue(
    input: CreateManualReportIssueInput,
    context: RequestContext = {}
  ): Promise<any> {
    const title = input.title.trim();
    const operatorName = input.operator_name.trim();
    if (
      !Number.isInteger(input.report_id) ||
      input.report_id <= 0 ||
      !Number.isInteger(input.result_id) ||
      input.result_id <= 0 ||
      !title ||
      !operatorName
    ) {
      return null;
    }
    return await this.repository.createManualIssue(
      {
        ...input,
        title,
        description: input.description?.trim() ?? "",
        inspection_id: input.inspection_id?.trim() ?? "",
        operator_name: operatorName
      },
      context
    );
  }

  async updateImageReviewStatus(
    reportId: number,
    imageId: number,
    reviewStatus: ResultReviewState,
    operatorName: string,
    note = "",
    context: RequestContext = {},
    selectedIssues: ReviewSelectedIssue[] = [],
    reviewAction: ReviewAction = "transition",
    reviewDisposition: ReviewDisposition = ""
  ): Promise<any> {
    if (!Number.isInteger(reportId) || reportId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
      return null;
    }
    const normalizedOperator = operatorName.trim();
    if (!normalizedOperator) {
      return null;
    }
    return await this.repository.updateImageReviewStatus(reportId, imageId, {
      review_status: reviewStatus,
      operator_name: normalizedOperator,
      note: note.trim(),
      selected_issues: selectedIssues,
      review_action: reviewAction,
      review_disposition: reviewDisposition
    }, context);
  }

  async listRecentReviewLogs(
    reportId: number,
    limit = 20,
    imageId = 0,
    context: RequestContext = {}
  ): Promise<any> {
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return [];
    }
    const normalizedLimit = Math.min(Math.max(1, Math.trunc(Number.isFinite(limit) ? limit : 20)), 100);
    const normalizedImageId = Number.isInteger(imageId) && imageId > 0 ? imageId : 0;
    return await this.repository.listReviewLogs(reportId, normalizedLimit, normalizedImageId || undefined, context);
  }
}
