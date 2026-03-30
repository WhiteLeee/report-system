import { NextResponse } from "next/server";

import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import type { RoleCode } from "@/backend/auth/auth.types";

const authService = createAuthService();

function roleCodeFromForm(value: string): RoleCode {
  return value === "admin" || value === "reviewer" ? value : "viewer";
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
  try {
    authService.updateUserRole(numericUserId, roleCodeFromForm(String(formData.get("roleCode") || "viewer").trim()));
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update role." },
      { status: 400 }
    );
  }

  return NextResponse.redirect(new URL("/admin/users", request.url), 303);
}
