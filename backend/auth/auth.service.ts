import { getReportSystemConfig } from "@/backend/config/report-system-config";
import type { AuthRepository } from "@/backend/auth/auth.repository";
import type { CreateUserInput, PermissionCode, RoleCode, SessionUser, UserAccount } from "@/backend/auth/auth.types";

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  ensureBootstrap(): void {
    const config = getReportSystemConfig();
    this.repository.ensureBootstrap(config.adminUsername, config.adminPassword, config.adminDisplayName);
  }

  authenticate(username: string, password: string): { sessionToken: string; expiresAt: string; user: SessionUser } | null {
    this.ensureBootstrap();
    const user = this.repository.authenticate(username, password);
    if (!user) {
      return null;
    }
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
    const sessionToken = this.repository.createSession(user.id, expiresAt);
    return { sessionToken, expiresAt, user };
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

  listUsers(): UserAccount[] {
    this.ensureBootstrap();
    return this.repository.listUsers();
  }

  createUser(input: CreateUserInput): UserAccount {
    this.ensureBootstrap();
    return this.repository.createUser(input);
  }

  updateUserRole(userId: number, roleCode: RoleCode): void {
    this.ensureBootstrap();
    this.repository.updateUserRole(userId, roleCode);
  }

  replaceUserScopes(userId: number, enterpriseScopeIds: string[], organizationScopeIds: string[], storeScopeIds: string[]): void {
    this.ensureBootstrap();
    this.repository.replaceUserScopes(userId, enterpriseScopeIds, organizationScopeIds, storeScopeIds);
  }

  updateUserPassword(userId: number, nextPassword: string): void {
    this.ensureBootstrap();
    this.repository.updateUserPassword(userId, nextPassword);
  }

  updateUserStatus(userId: number, status: "active" | "disabled"): void {
    this.ensureBootstrap();
    this.repository.updateUserStatus(userId, status);
  }

  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): boolean {
    return this.repository.hasPermission(user, permissionCode);
  }
}
