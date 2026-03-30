import { NextRequest } from "next/server";

import { createReportService } from "@/backend/report/report.module";

export const dynamic = "force-dynamic";

const reportService = createReportService();

export async function GET(request: NextRequest): Promise<Response> {
  const publishId = request.nextUrl.searchParams.get("idempotency_key") ?? "";

  if (!publishId.trim()) {
    return Response.json(
      {
        success: false,
        error: "idempotency_key is required."
      },
      { status: 400 }
    );
  }

  const result = reportService.getPublishStatus(publishId);

  return Response.json({
    ok: true,
    exists: result.exists,
    status: result.status,
    report_id: result.reportId ?? null,
    publish_id: result.publishId,
    report_version: result.reportVersion ?? null,
    received_at: result.receivedAt
  });
}
