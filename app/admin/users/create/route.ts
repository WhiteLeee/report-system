import { NextResponse } from "next/server";

import { readAuditRequestMeta, stringifyAuditPayload, toAuditActor, toUserAuditSnapshot } from "@/backend/auth/auth-audit";
import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import type { RoleCode } from "@/backend/auth/auth.types";
import { getCurrentDeliveryMode, isProtectedPlatformUser } from "@/backend/auth/user-management-policy";

const authService = createAuthService();

function roleCodeFromForm(value: string): RoleCode | null {
  if (value === "manage" || value === "reviewer") {
    return value;
  }
  if (value === "viewer") {
    return "viewer";
  }
  return null;
}

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

function redirectToUserList(request: Request, errorMessage?: string): Response {
  const url = new URL("/admin/users", request.url);
  if (errorMessage) {
    url.searchParams.set("error", encodeURIComponent(errorMessage));
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "user:write")) {
    return redirectToUserList(request, "Forbidden");
  }
  const auditMeta = readAuditRequestMeta(request);
  const auditActor = toAuditActor(currentUser);
  const deliveryMode = getCurrentDeliveryMode();

  const formData = await request.formData().catch(() => new FormData());
  const username = String(formData.get("username") || "").trim();
  if (isProtectedPlatformUser(username, deliveryMode, currentUser)) {
    return redirectToUserList(request, "Username is protected.");
  }

  try {
    const roleCode = roleCodeFromForm(String(formData.get("roleCode") || "viewer").trim());
    if (!roleCode) {
      return redirectToUserList(request, "Invalid role code.");
    }
    const createdUser = authService.createUser({
      username,
      displayName: String(formData.get("displayName") || "").trim(),
      password: String(formData.get("password") || "").trim(),
      roleCode,
      enterpriseScopeIds: readScopeList(formData, "enterpriseScopeIds"),
      organizationScopeIds: readScopeList(formData, "organizationScopeIds"),
      storeScopeIds: readScopeList(formData, "storeScopeIds")
    });
    authService.createAuditLog({
      ...auditActor,
      targetUserId: createdUser.id,
      targetUsername: createdUser.username,
      action: "user.create",
      beforeJson: stringifyAuditPayload({}),
      afterJson: stringifyAuditPayload(toUserAuditSnapshot(createdUser)),
      requestId: auditMeta.requestId,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    });
  } catch (error) {
    return redirectToUserList(request, error instanceof Error ? error.message : "Failed to create user.");
  }

  return redirectToUserList(request);
}
