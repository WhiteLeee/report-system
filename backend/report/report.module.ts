import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { ReportService } from "@/backend/report/report.service";
import { ReportReviewService } from "@/backend/report/report-review.service";
import { PgReportRepository } from "@/backend/report/pg-report.repository";

export function createReportService(): any {
  const config = getReportSystemConfig();
  return new ReportService(new PgReportRepository(), {
    supportedPayloadVersions: config.supportedPayloadVersions
  });
}

export function createReportReviewService(): any {
  return new ReportReviewService(new PgReportRepository());
}
