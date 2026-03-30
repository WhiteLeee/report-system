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

  publishReport(payload: ReportPublishPayload, context: RequestContext = {}): PublishReceipt {
    if (!this.supportedPayloadVersions.includes(payload.payload_version)) {
      throw new UnsupportedPayloadVersionError(payload.payload_version, this.supportedPayloadVersions);
    }
    return this.repository.publishReport(payload, context);
  }

  getPublishStatus(publishId: string, context: RequestContext = {}): PublishStatusReceipt {
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
    return this.repository.getPublishStatus(normalizedPublishId, context);
  }

  listReports(filters: ReportFilters = {}, context: RequestContext = {}): ReportSummary[] {
    return this.repository.listReports(
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

  getReportDetail(reportId: number, context: RequestContext = {}): ReportDetail | null {
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return null;
    }

    return this.repository.getReportDetail(reportId, context);
  }
}
