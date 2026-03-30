import { NextResponse } from "next/server";

import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import type { RoleCode } from "@/backend/auth/auth.types";

const authService = createAuthService();

function roleCodeFromForm(value: string): RoleCode {
  return value === "admin" || value === "reviewer" ? value : "viewer";
}

function readScopeList(value: FormDataEntryValue | null): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "user:manage")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => new FormData());
  try {
    authService.createUser({
      username: String(formData.get("username") || "").trim(),
      displayName: String(formData.get("displayName") || "").trim(),
      password: String(formData.get("password") || "").trim(),
      roleCode: roleCodeFromForm(String(formData.get("roleCode") || "viewer").trim()),
      enterpriseScopeIds: readScopeList(formData.get("enterpriseScopeIds")),
      organizationScopeIds: readScopeList(formData.get("organizationScopeIds")),
      storeScopeIds: readScopeList(formData.get("storeScopeIds"))
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create user." },
      { status: 400 }
    );
  }

  return NextResponse.redirect(new URL("/admin/users", request.url), 303);
}
