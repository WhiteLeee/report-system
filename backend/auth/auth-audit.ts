import type { SessionUser, UserAccount } from "@/backend/auth/auth.types";

export interface AuditRequestMeta {
  requestId: string;
  ipAddress: string;
  userAgent: string;
}

export function readAuditRequestMeta(request: Request): AuditRequestMeta {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ipAddress = forwardedFor
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0] || request.headers.get("x-real-ip") || "";

  return {
    requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
    ipAddress,
    userAgent: request.headers.get("user-agent") || ""
  };
}

export function toUserAuditSnapshot(user: UserAccount | null | undefined): Record<string, unknown> {
  if (!user) {
    return {};
  }
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
    roles: user.roles,
    permissions: user.permissions,
    enterpriseScopeIds: user.enterpriseScopeIds,
    organizationScopeIds: user.organizationScopeIds,
    storeScopeIds: user.storeScopeIds,
    updatedAt: user.updatedAt
  };
}

export function toAuditActor(user: SessionUser | null): { operatorUserId: number | null; operatorUsername: string } {
  if (!user) {
    return { operatorUserId: null, operatorUsername: "" };
  }
  return {
    operatorUserId: user.id,
    operatorUsername: user.username
  };
}

export function stringifyAuditPayload(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}
