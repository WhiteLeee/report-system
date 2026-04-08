import { NextResponse } from "next/server";

import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";

const authService = createAuthService();

function readScopeList(formData: FormData, fieldName: string): string[] {
  const values = formData
    .getAll(fieldName)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (values.length > 0) {
    return values;
  }

  return String(formData.get(fieldName) || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "user:manage") || !currentUser?.roles.includes("admin")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    return Response.json({ success: false, error: "Invalid user id." }, { status: 400 });
  }

  const formData = await request.formData().catch(() => new FormData());
  authService.replaceUserScopes(
    numericUserId,
    readScopeList(formData, "enterpriseScopeIds"),
    readScopeList(formData, "organizationScopeIds"),
    readScopeList(formData, "storeScopeIds")
  );

  return NextResponse.redirect(new URL("/admin/users", request.url), 303);
}
