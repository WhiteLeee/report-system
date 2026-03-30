import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { UnsupportedPayloadVersionError } from "@/backend/report/payload-version";
import { createReportService } from "@/backend/report/report.module";
import { reportPublishSchema } from "@/backend/report/report.schema";

const reportService = createReportService();
const reportSystemConfig = getReportSystemConfig();

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: "Request body must be valid JSON."
      },
      { status: 400 }
    );
  }

  const parsed = reportPublishSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: "Invalid report publish payload.",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  try {
    const result = reportService.publishReport(parsed.data);

    return Response.json(
      {
        ok: true,
        report_id: result.reportId,
        action: result.action,
        publish_id: result.publishId,
        report_version: result.reportVersion,
        received_at: result.receivedAt
      },
      { status: result.action === "created" ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof UnsupportedPayloadVersionError) {
      return Response.json(
        {
          success: false,
          error: "Unsupported payload_version.",
          received_payload_version: error.receivedVersion,
          supported_payload_versions: error.supportedVersions
        },
        { status: 422 }
      );
    }

    return Response.json(
      {
        success: false,
        error: "Failed to persist report snapshot.",
        detail: error instanceof Error ? error.message : "Unknown error",
        supported_payload_versions: reportSystemConfig.supportedPayloadVersions
      },
      { status: 500 }
    );
  }
}
