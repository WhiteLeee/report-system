import { NextResponse } from "next/server";

import { readAuditRequestMeta, stringifyAuditPayload, toAuditActor, toUserAuditSnapshot } from "@/backend/auth/auth-audit";
import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import type { RoleCode } from "@/backend/auth/auth.types";
import { assertTargetUserManageable, filterVisibleUsers, getCurrentDeliveryMode } from "@/backend/auth/user-management-policy";

const authService = createAuthService();

function roleCodeFromForm(value: string): RoleCode | null {
  if (value === "manage" || value === "reviewer" || value === "viewer") {
    return value;
  }
  return null;
}

function readScopeList(formData: FormData, fieldName: string): string[] {
  return formData
    .getAll(fieldName)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function redirectToUsers(request: Request, errorMessage?: string): Response {
  const url = new URL("/admin/users", request.url);
  if (errorMessage) {
    url.searchParams.set("error", encodeURIComponent(errorMessage));
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  const canWriteUsers = hasPermission(currentUser, "user:write");
  const canWriteRoles = hasPermission(currentUser, "role:write");
  const canWriteScopes = hasPermission(currentUser, "scope:write");
  if (!canWriteUsers && !canWriteRoles && !canWriteScopes) {
    return redirectToUsers(request, "Forbidden");
  }

  const auditMeta = readAuditRequestMeta(request);
  const auditActor = toAuditActor(currentUser);
  const deliveryMode = getCurrentDeliveryMode();

  const { userId } = await context.params;
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    return redirectToUsers(request, "Invalid user id.");
  }

  const formData = await request.formData().catch(() => new FormData());
  try {
    const beforeUser = assertTargetUserManageable(
      filterVisibleUsers(authService.listUsers(), deliveryMode, currentUser).find((user) => user.id === numericUserId),
      deliveryMode,
      currentUser
    );

    const roleCode =
      canWriteRoles && !beforeUser.roles.includes("admin")
        ? roleCodeFromForm(String(formData.get("roleCode") || "").trim()) || undefined
        : undefined;
    const nextStatus = canWriteUsers ? String(formData.get("status") || "").trim() : "";
    const normalizedStatus = nextStatus === "active" || nextStatus === "disabled" ? nextStatus : undefined;
    const nextPassword = canWriteUsers ? String(formData.get("password") || "").trim() : "";

    authService.updateUserProfile({
      userId: numericUserId,
      roleCode: roleCode && roleCode !== beforeUser.roles[0] ? roleCode : undefined,
      status: normalizedStatus && normalizedStatus !== beforeUser.status ? normalizedStatus : undefined,
      password: nextPassword || undefined,
      scopeUpdate: canWriteScopes
        ? {
            enterpriseScopeIds: [],
            organizationScopeIds: readScopeList(formData, "organizationScopeIds"),
            storeScopeIds: []
          }
        : undefined,
      revokeSessionsWhenDisabled: normalizedStatus === "disabled"
    });

    const afterUser = assertTargetUserManageable(
      filterVisibleUsers(authService.listUsers(), deliveryMode, currentUser).find((user) => user.id === numericUserId),
      deliveryMode,
      currentUser
    );
    authService.createAuditLog({
      ...auditActor,
      targetUserId: afterUser.id,
      targetUsername: afterUser.username,
      action: "user.profile.update",
      beforeJson: stringifyAuditPayload(toUserAuditSnapshot(beforeUser)),
      afterJson: stringifyAuditPayload(toUserAuditSnapshot(afterUser)),
      requestId: auditMeta.requestId,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    });
  } catch (error) {
    return redirectToUsers(request, error instanceof Error ? error.message : "Failed to update user.");
  }

  return redirectToUsers(request);
}
