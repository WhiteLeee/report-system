export const roleCodes = ["admin", "manage", "viewer", "reviewer"] as const;
export type RoleCode = (typeof roleCodes)[number];

export const permissionCodes = [
  "report:read",
  "review:write",
  "rectification:read",
  "analytics:read",
  "analytics:job:manage",
  "master-data:read",
  "user:read",
  "user:write",
  "role:read",
  "role:write",
  "scope:write",
  "system:settings:read",
  "system:settings:write"
] as const;
export type PermissionCode = (typeof permissionCodes)[number];

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
}

export interface PermissionDefinition {
  code: PermissionCode;
  name: string;
  description: string;
}

export interface RolePermissionMatrixItem {
  roleCode: RoleCode;
  roleName: string;
  roleDescription: string;
  permissionCodes: PermissionCode[];
}

export interface NavigationMenuItem {
  code: string;
  label: string;
  href: string;
  icon: string;
  sortOrder: number;
}

export interface ManagedNavigationMenuItem extends NavigationMenuItem {
  visible: boolean;
  roleCodes: RoleCode[];
}

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  status: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
  enterpriseScopeIds: string[];
  organizationScopeIds: string[];
  storeScopeIds: string[];
  navigationMenus?: NavigationMenuItem[];
}

export interface UserAccount extends SessionUser {
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  displayName: string;
  roleCode: RoleCode;
  enterpriseScopeIds: string[];
  organizationScopeIds: string[];
  storeScopeIds: string[];
}

export interface UpdateUserProfileInput {
  userId: number;
  roleCode?: RoleCode;
  status?: "active" | "disabled";
  password?: string;
  scopeUpdate?: {
    enterpriseScopeIds: string[];
    organizationScopeIds: string[];
    storeScopeIds: string[];
  };
  revokeSessionsWhenDisabled?: boolean;
}

export type AuthFailureReason = "invalid_credentials" | "locked";

export type AuthAuthenticateResult =
  | {
      ok: true;
      user: SessionUser;
    }
  | {
      ok: false;
      reason: AuthFailureReason;
      lockedUntil?: string;
    };

export interface AuthAuditLogInput {
  operatorUserId: number | null;
  operatorUsername: string;
  targetUserId: number | null;
  targetUsername: string;
  action: string;
  beforeJson: string;
  afterJson: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
}

export interface AuthAuditLogRecord extends AuthAuditLogInput {
  id: number;
  createdAt: string;
}

export interface AuthAuditLogQuery {
  action?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

export interface AuthAuditLogPage {
  page: number;
  pageSize: number;
  total: number;
  items: AuthAuditLogRecord[];
}
