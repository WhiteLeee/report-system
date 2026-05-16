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

  async ensureBootstrap(): Promise<any> {
    const config = getReportSystemConfig();
    await this.repository.ensureBootstrap(config.adminUsername, config.adminPassword, config.adminDisplayName);
  }

  async authenticate(
    username: string,
    password: string
  ): Promise<any> {
    await this.ensureBootstrap();
    const securityPolicy = await this.systemSettingsService.getAuthSecurityPolicy();
    const authResult = await this.repository.authenticate(username, password, securityPolicy);
    if (!authResult.ok) {
      return authResult;
    }
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
    const sessionToken = await this.repository.createSession(authResult.user.id, expiresAt);
    return { ok: true, sessionToken, expiresAt, user: authResult.user };
  }

  async getSessionUser(sessionToken: string): Promise<any> {
    await this.ensureBootstrap();
    const user = await this.repository.findSessionUser(sessionToken);
    if (user) {
      await this.repository.touchSession(sessionToken);
    }
    return user;
  }

  async logout(sessionToken: string): Promise<any> {
    if (!sessionToken.trim()) {
      return;
    }
    await this.repository.deleteSession(sessionToken);
  }

  async revokeUserSessions(userId: number): Promise<any> {
    await this.ensureBootstrap();
    await this.repository.deleteSessionsByUserId(userId);
  }

  async listUsers(): Promise<any> {
    await this.ensureBootstrap();
    return await this.repository.listUsers();
  }

  async createUser(input: CreateUserInput): Promise<any> {
    await this.ensureBootstrap();
    if (input.roleCode === "admin") {
      throw new Error("Admin role is reserved for bootstrap admin user.");
    }
    assertPasswordWithPolicy(input.password, await this.systemSettingsService.getAuthSecurityPolicy());
    return await this.repository.createUser(input);
  }

  async updateUserProfile(input: UpdateUserProfileInput): Promise<any> {
    await this.ensureBootstrap();
    const targetUser = (await this.listUsers()).find((item): any => item.id === input.userId);
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
      assertPasswordWithPolicy(normalizedPassword, await this.systemSettingsService.getAuthSecurityPolicy());
    }

    await this.repository.updateUserProfile({
      ...input,
      roleCode: normalizedRoleCode,
      password: normalizedPassword || undefined
    });
  }

  async updateUserRole(userId: number, roleCode: RoleCode): Promise<any> {
    await this.ensureBootstrap();
    const targetUser = (await this.listUsers()).find((item): any => item.id === userId);
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
    await this.repository.updateUserRole(userId, roleCode);
  }

  async replaceUserScopes(
    userId: number,
    enterpriseScopeIds: string[],
    organizationScopeIds: string[],
    storeScopeIds: string[]
  ): Promise<any> {
    await this.ensureBootstrap();
    await this.repository.replaceUserScopes(userId, enterpriseScopeIds, organizationScopeIds, storeScopeIds);
  }

  async updateUserPassword(userId: number, nextPassword: string): Promise<any> {
    await this.ensureBootstrap();
    assertPasswordWithPolicy(nextPassword, await this.systemSettingsService.getAuthSecurityPolicy());
    await this.repository.updateUserPassword(userId, nextPassword);
  }

  async updateUserStatus(userId: number, status: "active" | "disabled"): Promise<any> {
    await this.ensureBootstrap();
    await this.repository.updateUserStatus(userId, status);
  }

  async listRolePermissionMatrix(): Promise<any> {
    await this.ensureBootstrap();
    return await this.repository.listRolePermissionMatrix();
  }

  async replaceRolePermissions(roleCode: RoleCode, permissionCodes: PermissionCode[]): Promise<any> {
    await this.ensureBootstrap();
    await this.repository.replaceRolePermissions(roleCode, permissionCodes);
  }

  async listManagedNavigationMenus(): Promise<any> {
    await this.ensureBootstrap();
    return await this.repository.listManagedNavigationMenus();
  }

  async saveManagedNavigationMenus(items: ManagedNavigationMenuItem[]): Promise<any> {
    await this.ensureBootstrap();
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
    await this.repository.saveManagedNavigationMenus(normalizedItems);
  }

  async createAuditLog(input: AuthAuditLogInput): Promise<any> {
    await this.ensureBootstrap();
    await this.repository.createAuditLog(input);
  }

  async listAuditLogs(limit = 100): Promise<any> {
    await this.ensureBootstrap();
    return await this.repository.listAuditLogs(limit);
  }

  async queryAuditLogs(query: AuthAuditLogQuery): Promise<any> {
    await this.ensureBootstrap();
    return await this.repository.queryAuditLogs(query);
  }

  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): any {
    return this.repository.hasPermission(user, permissionCode);
  }
}
