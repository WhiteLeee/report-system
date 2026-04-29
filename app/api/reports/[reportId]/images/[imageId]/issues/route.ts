import { buildRequestContext, getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createReportReviewService } from "@/backend/report/report.module";

const reviewService = createReportReviewService();

type ManualIssuePayload = {
  title: string;
  description: string;
  inspection_id: string;
};

async function readPayload(request: Request): Promise<ManualIssuePayload> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      title: typeof json.title === "string" ? json.title : "",
      description: typeof json.description === "string" ? json.description : "",
      inspection_id: typeof json.inspection_id === "string" ? json.inspection_id : ""
    };
  }
  const formData = await request.formData().catch(() => new FormData());
  return {
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    inspection_id: String(formData.get("inspection_id") || "")
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string; imageId: string }> }
): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "review:write")) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const reportId = Number(params.reportId);
  const imageId = Number(params.imageId);
  if (!Number.isInteger(reportId) || reportId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
    return Response.json({ success: false, error: "Invalid report id or image id." }, { status: 400 });
  }

  const payload = await readPayload(request);
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const inspectionId = String(payload.inspection_id || "").trim();
  if (!title) {
    return Response.json({ success: false, error: "问题项名称不能为空。" }, { status: 400 });
  }
  if (title.length > 120) {
    return Response.json({ success: false, error: "问题项名称不能超过 120 个字。" }, { status: 400 });
  }
  if (description.length > 500) {
    return Response.json({ success: false, error: "问题项描述不能超过 500 个字。" }, { status: 400 });
  }

  const operatorName = currentUser?.displayName || "report-system";
  const issue = reviewService.createManualIssue(
    {
      report_id: reportId,
      result_id: imageId,
      title,
      description,
      inspection_id: inspectionId,
      operator_name: operatorName
    },
    buildRequestContext(currentUser)
  );
  if (!issue) {
    return Response.json({ success: false, error: "创建问题项失败，请刷新页面后重试。" }, { status: 404 });
  }

  return Response.json({
    success: true,
    issue: {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      image_url: issue.image_url,
      image_urls: issue.image_url ? [issue.image_url] : []
    }
  });
}
