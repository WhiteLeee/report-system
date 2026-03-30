import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { RequestContext } from "@/backend/auth/request-context";
import { createAuthService } from "@/backend/auth/auth.module";
import type { PermissionCode, SessionUser } from "@/backend/auth/auth.types";

export const SESSION_COOKIE_NAME = "report_system_session";

const authService = createAuthService();

function readTokenFromCookieHeader(cookieHeader: string): string {
  const pairs = cookieHeader.split(";").map((item) => item.trim());
  const target = pairs.find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!target) {
    return "";
  }
  return decodeURIComponent(target.slice(`${SESSION_COOKIE_NAME}=`.length));
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!sessionToken) {
    return null;
  }
  return authService.getSessionUser(sessionToken);
}

export function getSessionUserFromRequest(request: Request): SessionUser | null {
  const sessionToken = readTokenFromCookieHeader(request.headers.get("cookie") || "");
  if (!sessionToken) {
    return null;
  }
  return authService.getSessionUser(sessionToken);
}

export async function requireSessionUser(nextPath = "/reports"): Promise<SessionUser> {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requirePermission(permissionCode: PermissionCode, nextPath = "/reports"): Promise<SessionUser> {
  const user = await requireSessionUser(nextPath);
  if (!authService.hasPermission(user, permissionCode)) {
    redirect("/reports");
  }
  return user;
}

export function hasPermission(user: SessionUser | null, permissionCode: PermissionCode): boolean {
  return authService.hasPermission(user, permissionCode);
}

export function buildRequestContext(user: SessionUser | null): RequestContext {
  if (!user) {
    return {};
  }
  return {
    userId: String(user.id),
    roleCodes: user.roles,
    enterpriseScopeIds: user.enterpriseScopeIds,
    organizationScopeIds: user.organizationScopeIds,
    storeScopeIds: user.storeScopeIds
  };
}
