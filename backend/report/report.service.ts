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
  ReportListOverview,
  ReportListPage,
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

  async queryReportsPage(
    filters: ReportFilters = {},
    page = 1,
    pageSize = 20,
    context: RequestContext = {}
  ): Promise<any> {
    const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const normalizedPageSize = Number.isFinite(pageSize) ? Math.max(1, Math.min(200, Math.floor(pageSize))) : 20;
    return await this.repository.queryReportsPage(
      {
        enterprise: filters.enterprise?.trim() ?? "",
        publishId: filters.publishId?.trim() ?? "",
        reportType: filters.reportType?.trim() ?? "",
        reviewStatus: filters.reviewStatus ?? "",
        startDate: filters.startDate?.trim() ?? "",
        endDate: filters.endDate?.trim() ?? ""
      },
      normalizedPage,
      normalizedPageSize,
      context
    );
  }

  async getReportListOverview(context: RequestContext = {}): Promise<any> {
    return await this.repository.getReportListOverview(context);
  }

  async getReportDetail(reportId: number, context: RequestContext = {}): Promise<any> {
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return null;
    }

    return await this.repository.getReportDetail(reportId, context);
  }

  async getReportDetailPage(
    reportId: number,
    input: {
      organization?: string;
      storeId?: string;
      reviewStatus?: string;
      semanticState?: string;
      page?: number;
      pageSize?: number;
    },
    context: RequestContext = {}
  ): Promise<any> {
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return null;
    }
    const normalizedPage = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page || 1)) : 1;
    const normalizedPageSize = Number.isFinite(input.pageSize) ? Math.max(1, Math.min(200, Math.floor(input.pageSize || 30))) : 30;
    return await this.repository.getReportDetailPage(
      reportId,
      {
        organization: String(input.organization || "").trim(),
        storeId: String(input.storeId || "").trim(),
        reviewStatus: String(input.reviewStatus || "").trim(),
        semanticState: String(input.semanticState || "").trim(),
        page: normalizedPage,
        pageSize: normalizedPageSize
      },
      context
    );
  }

  async getReportResultDetail(reportId: number, resultId: number, context: RequestContext = {}): Promise<any> {
    if (!Number.isInteger(reportId) || reportId <= 0 || !Number.isInteger(resultId) || resultId <= 0) {
      return null;
    }
    return await this.repository.getReportResultDetail(reportId, resultId, context);
  }
}
