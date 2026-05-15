import type { RequestContext } from "@/backend/auth/request-context";
import {
  normalizeSupportedPayloadVersions,
  UnsupportedPayloadVersionError
} from "@/backend/report/payload-version";
import type { ReportRepository } from "@/backend/report/report.repository";
import type {
  PublishReceipt,
  PublishStatusReceipt,
  ReportDetail,
  ReportFilters,
  ReportPublishPayload,
  ReportSummary
} from "@/backend/report/report.types";

export class ReportService {
  private readonly supportedPayloadVersions: number[];

  constructor(
    private readonly repository: ReportRepository,
    options: { supportedPayloadVersions?: number[] } = {}
  ) {
    this.supportedPayloadVersions = normalizeSupportedPayloadVersions(options.supportedPayloadVersions || [2]);
  }

  async publishReport(payload: ReportPublishPayload, context: RequestContext = {}): Promise<any> {
    if (!this.supportedPayloadVersions.includes(payload.payload_version)) {
      throw new UnsupportedPayloadVersionError(payload.payload_version, this.supportedPayloadVersions);
    }
    return await this.repository.publishReport(payload, context);
  }

  async getPublishStatus(publishId: string, context: RequestContext = {}): Promise<any> {
    const normalizedPublishId = publishId.trim();
    if (!normalizedPublishId) {
      return {
        success: true,
        exists: false,
        status: "missing",
        publishId: "",
        receivedAt: new Date().toISOString()
      };
    }
    return await this.repository.getPublishStatus(normalizedPublishId, context);
  }

  async listReports(filters: ReportFilters = {}, context: RequestContext = {}): Promise<any> {
    return await this.repository.listReports(
      {
        enterprise: filters.enterprise?.trim() ?? "",
        publishId: filters.publishId?.trim() ?? "",
        reportType: filters.reportType?.trim() ?? "",
        reviewStatus: filters.reviewStatus ?? "",
        startDate: filters.startDate?.trim() ?? "",
        endDate: filters.endDate?.trim() ?? ""
      },
      context
    );
  }

  async getReportDetail(reportId: number, context: RequestContext = {}): Promise<any> {
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return null;
    }

    return await this.repository.getReportDetail(reportId, context);
  }
}
