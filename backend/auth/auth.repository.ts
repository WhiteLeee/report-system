import type { CreateUserInput, PermissionCode, RoleCode, SessionUser, UserAccount } from "@/backend/auth/auth.types";

export interface AuthRepository {
  ensureBootstrap(adminUsername: string, adminPassword: string, adminDisplayName: string): void;
  authenticate(username: string, password: string): SessionUser | null;
  createSession(userId: number, expiresAt: string): string;
  findSessionUser(sessionToken: string): SessionUser | null;
  touchSession(sessionToken: string): void;
  deleteSession(sessionToken: string): void;
  listUsers(): UserAccount[];
  createUser(input: CreateUserInput): UserAccount;
  updateUserRole(userId: number, roleCode: RoleCode): void;
  replaceUserScopes(userId: number, enterpriseScopeIds: string[], organizationScopeIds: string[], storeScopeIds: string[]): void;
  updateUserPassword(userId: number, nextPassword: string): void;
  updateUserStatus(userId: number, status: "active" | "disabled"): void;
  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): boolean;
}
