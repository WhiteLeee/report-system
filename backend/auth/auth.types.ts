export const roleCodes = ["admin", "viewer", "reviewer"] as const;
export type RoleCode = (typeof roleCodes)[number];

export const permissionCodes = ["report:read", "review:write", "user:manage"] as const;
export type PermissionCode = (typeof permissionCodes)[number];

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
