import type {
  AuthAuditLogPage,
  AuthAuditLogQuery,
  AuthAuditLogInput,
  AuthAuthenticateResult,
  AuthAuditLogRecord,
  CreateUserInput,
  ManagedNavigationMenuItem,
  PermissionCode,
  RoleCode,
  RolePermissionMatrixItem,
  SessionUser,
  UpdateUserProfileInput,
  UserAccount
} from "@/backend/auth/auth.types";
import type { AuthSecurityPolicy } from "@/backend/system-settings/system-settings.types";

export interface AuthRepository {
  ensureBootstrap(adminUsername: string, adminPassword: string, adminDisplayName: string): any;
  authenticate(username: string, password: string, policy: AuthSecurityPolicy): any;
  createSession(userId: number, expiresAt: string): any;
  findSessionUser(sessionToken: string): any;
  touchSession(sessionToken: string): any;
  deleteSession(sessionToken: string): any;
  deleteSessionsByUserId(userId: number): any;
  listUsers(): any;
  createUser(input: CreateUserInput): any;
  updateUserProfile(input: UpdateUserProfileInput): any;
  updateUserRole(userId: number, roleCode: RoleCode): any;
  replaceUserScopes(userId: number, enterpriseScopeIds: string[], organizationScopeIds: string[], storeScopeIds: string[]): any;
  updateUserPassword(userId: number, nextPassword: string): any;
  updateUserStatus(userId: number, status: "active" | "disabled"): any;
  listRolePermissionMatrix(): any;
  replaceRolePermissions(roleCode: RoleCode, permissionCodes: PermissionCode[]): any;
  listManagedNavigationMenus(): any;
  saveManagedNavigationMenus(items: ManagedNavigationMenuItem[]): any;
  createAuditLog(input: AuthAuditLogInput): any;
  listAuditLogs(limit: number): any;
  queryAuditLogs(query: AuthAuditLogQuery): any;
  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): any;
}
