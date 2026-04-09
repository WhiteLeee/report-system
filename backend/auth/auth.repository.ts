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
  ensureBootstrap(adminUsername: string, adminPassword: string, adminDisplayName: string): void;
  authenticate(username: string, password: string, policy: AuthSecurityPolicy): AuthAuthenticateResult;
  createSession(userId: number, expiresAt: string): string;
  findSessionUser(sessionToken: string): SessionUser | null;
  touchSession(sessionToken: string): void;
  deleteSession(sessionToken: string): void;
  deleteSessionsByUserId(userId: number): void;
  listUsers(): UserAccount[];
  createUser(input: CreateUserInput): UserAccount;
  updateUserProfile(input: UpdateUserProfileInput): void;
  updateUserRole(userId: number, roleCode: RoleCode): void;
  replaceUserScopes(userId: number, enterpriseScopeIds: string[], organizationScopeIds: string[], storeScopeIds: string[]): void;
  updateUserPassword(userId: number, nextPassword: string): void;
  updateUserStatus(userId: number, status: "active" | "disabled"): void;
  listRolePermissionMatrix(): RolePermissionMatrixItem[];
  replaceRolePermissions(roleCode: RoleCode, permissionCodes: PermissionCode[]): void;
  listManagedNavigationMenus(): ManagedNavigationMenuItem[];
  saveManagedNavigationMenus(items: ManagedNavigationMenuItem[]): void;
  createAuditLog(input: AuthAuditLogInput): void;
  listAuditLogs(limit: number): AuthAuditLogRecord[];
  queryAuditLogs(query: AuthAuditLogQuery): AuthAuditLogPage;
  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): boolean;
}
