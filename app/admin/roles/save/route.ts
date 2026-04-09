import { NextResponse } from "next/server";

import { readAuditRequestMeta, stringifyAuditPayload, toAuditActor } from "@/backend/auth/auth-audit";
import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { permissionCodes } from "@/backend/auth/auth.types";
import type { PermissionCode, RoleCode } from "@/backend/auth/auth.types";

const authService = createAuthService();
const editableRoleCodes: RoleCode[] = ["manage", "viewer", "reviewer"];

function readPermissionCodes(formData: FormData, roleCode: RoleCode): PermissionCode[] {
  const allowed = new Set<PermissionCode>(permissionCodes);
  return formData
    .getAll(`permissions_${roleCode}`)
    .map((item) => String(item || "").trim())
    .filter((item): item is PermissionCode => allowed.has(item as PermissionCode));
}

export async function POST(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "role:write")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const auditMeta = readAuditRequestMeta(request);
  const actor = toAuditActor(currentUser);
  const formData = await request.formData().catch(() => new FormData());
  const beforeMatrix = authService.listRolePermissionMatrix();

  editableRoleCodes.forEach((roleCode) => {
    authService.replaceRolePermissions(roleCode, readPermissionCodes(formData, roleCode));
  });

  const afterMatrix = authService.listRolePermissionMatrix();
  authService.createAuditLog({
    ...actor,
    targetUserId: null,
    targetUsername: "role_permission_matrix",
    action: "role.permission.update",
    beforeJson: stringifyAuditPayload(beforeMatrix),
    afterJson: stringifyAuditPayload(afterMatrix),
    requestId: auditMeta.requestId,
    ipAddress: auditMeta.ipAddress,
    userAgent: auditMeta.userAgent
  });

  return NextResponse.redirect(new URL("/admin/roles?saved=1", request.url), 303);
}
