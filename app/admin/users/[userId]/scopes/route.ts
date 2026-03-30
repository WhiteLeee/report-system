import { NextResponse } from "next/server";

import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";

const authService = createAuthService();

function readScopeList(value: FormDataEntryValue | null): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "user:manage")) {
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
    readScopeList(formData.get("enterpriseScopeIds")),
    readScopeList(formData.get("organizationScopeIds")),
    readScopeList(formData.get("storeScopeIds"))
  );

  return NextResponse.redirect(new URL("/admin/users", request.url), 303);
}
