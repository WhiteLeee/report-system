import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { ReportService } from "@/backend/report/report.service";
import { ReportReviewService } from "@/backend/report/report-review.service";
import { SqliteReportRepository } from "@/backend/report/sqlite-report.repository";

export function createReportService(): ReportService {
  const config = getReportSystemConfig();
  return new ReportService(new SqliteReportRepository(), {
    supportedPayloadVersions: config.supportedPayloadVersions
  });
}

export function createReportReviewService(): ReportReviewService {
  return new ReportReviewService(new SqliteReportRepository());
}
