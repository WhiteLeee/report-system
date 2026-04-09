import { NextResponse } from "next/server";

import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createAnalyticsJobService } from "@/backend/analytics/analytics.module";

const analyticsJobService = createAnalyticsJobService();

export async function POST(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "analytics:job:manage")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => new FormData());
  const jobType = String(formData.get("jobType") || "").trim();
  const retryJobKey = String(formData.get("retryJobKey") || "").trim();

  if (retryJobKey) {
    analyticsJobService.retryJob(retryJobKey);
    return NextResponse.redirect(new URL("/analytics/jobs", request.url), 303);
  }

  if (jobType === "result_fact_rebuild") {
    analyticsJobService.runResultFactRebuild();
  } else if (jobType === "daily_snapshot_rebuild") {
    analyticsJobService.runDailySnapshotRebuild();
  } else {
    return Response.json({ success: false, error: "Unsupported job type" }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/analytics/jobs", request.url), 303);
}
