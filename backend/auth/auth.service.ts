import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { assertPasswordWithPolicy } from "@/backend/auth/password-policy";
import type { AuthRepository } from "@/backend/auth/auth.repository";
import type {
  AuthAuditLogPage,
  AuthAuditLogQuery,
  AuthAuditLogInput,
  AuthFailureReason,
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
import type { SystemSettingsService } from "@/backend/system-settings/system-settings.service";

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  ensureBootstrap(): void {
    const config = getReportSystemConfig();
    this.repository.ensureBootstrap(config.adminUsername, config.adminPassword, config.adminDisplayName);
  }

  authenticate(
    username: string,
    password: string
  ):
    | { ok: true; sessionToken: string; expiresAt: string; user: SessionUser }
    | { ok: false; reason: AuthFailureReason; lockedUntil?: string } {
    this.ensureBootstrap();
    const securityPolicy = this.systemSettingsService.getAuthSecurityPolicy();
    const authResult = this.repository.authenticate(username, password, securityPolicy);
    if (!authResult.ok) {
      return authResult;
    }
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
    const sessionToken = this.repository.createSession(authResult.user.id, expiresAt);
    return { ok: true, sessionToken, expiresAt, user: authResult.user };
  }

  getSessionUser(sessionToken: string): SessionUser | null {
    this.ensureBootstrap();
    const user = this.repository.findSessionUser(sessionToken);
    if (user) {
      this.repository.touchSession(sessionToken);
    }
    return user;
  }

  logout(sessionToken: string): void {
    if (!sessionToken.trim()) {
      return;
    }
    this.repository.deleteSession(sessionToken);
  }

  revokeUserSessions(userId: number): void {
    this.ensureBootstrap();
    this.repository.deleteSessionsByUserId(userId);
  }

  listUsers(): UserAccount[] {
    this.ensureBootstrap();
    return this.repository.listUsers();
  }

  createUser(input: CreateUserInput): UserAccount {
    this.ensureBootstrap();
    if (input.roleCode === "admin") {
      throw new Error("Admin role is reserved for bootstrap admin user.");
    }
    assertPasswordWithPolicy(input.password, this.systemSettingsService.getAuthSecurityPolicy());
    return this.repository.createUser(input);
  }

  updateUserProfile(input: UpdateUserProfileInput): void {
    this.ensureBootstrap();
    const targetUser = this.listUsers().find((item) => item.id === input.userId);
    if (!targetUser) {
      throw new Error("User not found.");
    }

    const normalizedRoleCode = input.roleCode;
    if (normalizedRoleCode) {
      const adminUsername = getReportSystemConfig().adminUsername;
      const isBootstrapAdminUser = targetUser.username === adminUsername;
      if (normalizedRoleCode === "admin" && !isBootstrapAdminUser) {
        throw new Error("Admin role is reserved for bootstrap admin user.");
      }
      if (isBootstrapAdminUser && normalizedRoleCode !== "admin") {
        throw new Error("Bootstrap admin user role cannot be changed.");
      }
    }

    const normalizedPassword = (input.password || "").trim();
    if (normalizedPassword) {
      assertPasswordWithPolicy(normalizedPassword, this.systemSettingsService.getAuthSecurityPolicy());
    }

    this.repository.updateUserProfile({
      ...input,
      roleCode: normalizedRoleCode,
      password: normalizedPassword || undefined
    });
  }

  updateUserRole(userId: number, roleCode: RoleCode): void {
    this.ensureBootstrap();
    const targetUser = this.listUsers().find((item) => item.id === userId);
    if (!targetUser) {
      throw new Error("User not found.");
    }
    const adminUsername = getReportSystemConfig().adminUsername;
    const isBootstrapAdminUser = targetUser.username === adminUsername;
    if (roleCode === "admin" && !isBootstrapAdminUser) {
      throw new Error("Admin role is reserved for bootstrap admin user.");
    }
    if (isBootstrapAdminUser && roleCode !== "admin") {
      throw new Error("Bootstrap admin user role cannot be changed.");
    }
    this.repository.updateUserRole(userId, roleCode);
  }

  replaceUserScopes(userId: number, enterpriseScopeIds: string[], organizationScopeIds: string[], storeScopeIds: string[]): void {
    this.ensureBootstrap();
    this.repository.replaceUserScopes(userId, enterpriseScopeIds, organizationScopeIds, storeScopeIds);
  }

  updateUserPassword(userId: number, nextPassword: string): void {
    this.ensureBootstrap();
    assertPasswordWithPolicy(nextPassword, this.systemSettingsService.getAuthSecurityPolicy());
    this.repository.updateUserPassword(userId, nextPassword);
  }

  updateUserStatus(userId: number, status: "active" | "disabled"): void {
    this.ensureBootstrap();
    this.repository.updateUserStatus(userId, status);
  }

  listRolePermissionMatrix(): RolePermissionMatrixItem[] {
    this.ensureBootstrap();
    return this.repository.listRolePermissionMatrix();
  }

  replaceRolePermissions(roleCode: RoleCode, permissionCodes: PermissionCode[]): void {
    this.ensureBootstrap();
    this.repository.replaceRolePermissions(roleCode, permissionCodes);
  }

  listManagedNavigationMenus(): ManagedNavigationMenuItem[] {
    this.ensureBootstrap();
    return this.repository.listManagedNavigationMenus();
  }

  saveManagedNavigationMenus(items: ManagedNavigationMenuItem[]): void {
    this.ensureBootstrap();
    const blockedMenus = new Set(["system"]);
    const normalizedItems = items.map((item) => {
      const nextRoleCodes = Array.from(new Set(item.roleCodes))
        .filter((roleCode) => roleCode === "admin" || roleCode === "manage" || roleCode === "reviewer" || roleCode === "viewer")
        .filter((roleCode) => roleCode === "admin" || !blockedMenus.has(item.code));
      return {
        ...item,
        roleCodes: nextRoleCodes
      };
    });
    this.repository.saveManagedNavigationMenus(normalizedItems);
  }

  createAuditLog(input: AuthAuditLogInput): void {
    this.ensureBootstrap();
    this.repository.createAuditLog(input);
  }

  listAuditLogs(limit = 100): AuthAuditLogRecord[] {
    this.ensureBootstrap();
    return this.repository.listAuditLogs(limit);
  }

  queryAuditLogs(query: AuthAuditLogQuery): AuthAuditLogPage {
    this.ensureBootstrap();
    return this.repository.queryAuditLogs(query);
  }

  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): boolean {
    return this.repository.hasPermission(user, permissionCode);
  }
}
