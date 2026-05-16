import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/backend/auth/password";
import type { AuthRepository } from "@/backend/auth/auth.repository";
import type {
  AuthAuditLogPage,
  AuthAuditLogQuery,
  AuthAuditLogInput,
  AuthAuthenticateResult,
  AuthAuditLogRecord,
  CreateUserInput,
  ManagedNavigationMenuItem,
  NavigationMenuItem,
  PermissionCode,
  RoleCode,
  RolePermissionMatrixItem,
  SessionUser,
  UpdateUserProfileInput,
  UserAccount
} from "@/backend/auth/auth.types";
import type { AuthSecurityPolicy } from "@/backend/system-settings/system-settings.types";
import { db } from "@/backend/database/client";
import {
  authAuditLogTable,
  authLoginGuardTable,
  reportMenuTable,
  reportPermissionTable,
  reportRoleMenuTable,
  reportRolePermissionTable,
  reportRoleTable,
  reportSessionTable,
  reportUserRoleTable,
  reportUserScopeTable,
  reportUserTable
} from "@/backend/database/schema";

const roleDefinitions: Array<{ code: RoleCode; name: string; description: string }> = [
  { code: "admin", name: "管理员", description: "可管理用户、查看报告、执行复检。" },
  { code: "manage", name: "业务管理员", description: "可管理用户、角色和业务操作，但不包含平台专属权限。" },
  { code: "viewer", name: "普通查看者", description: "只读查看报告。" },
  { code: "reviewer", name: "复检员", description: "查看报告并执行复检。" }
];

const permissionDefinitions: Array<{ code: PermissionCode; name: string; description: string }> = [
  { code: "report:read", name: "查看报告", description: "访问报告列表、详情和日志。" },
  { code: "review:write", name: "执行复检", description: "修改图片复检状态并写日志。" },
  { code: "rectification:read", name: "查看整改单", description: "访问整改单列表与状态。" },
  { code: "analytics:read", name: "查看数据分析", description: "访问数据分析页面与统计结果。" },
  { code: "analytics:job:manage", name: "管理分析任务", description: "手动触发分析任务与重建。" },
  { code: "master-data:read", name: "查看门店主数据", description: "访问组织树与门店主数据。" },
  { code: "user:read", name: "查看用户", description: "查看用户列表和账号信息。" },
  { code: "user:write", name: "管理用户", description: "新增、启停和重置用户账号。" },
  { code: "role:read", name: "查看角色权限", description: "查看角色与权限矩阵。" },
  { code: "role:write", name: "管理角色权限", description: "修改用户角色与权限矩阵。" },
  { code: "scope:write", name: "管理范围授权", description: "修改用户企业/组织/门店授权范围。" },
  { code: "system:settings:read", name: "查看系统设置", description: "访问系统设置页面。" },
  { code: "system:settings:write", name: "管理系统设置", description: "修改系统配置项。" }
];

const navigationMenuDefinitions: Array<{
  code: string;
  name: string;
  path: string;
  icon: string;
  sortOrder: number;
}> = [
  { code: "reports", name: "报告列表", path: "/reports", icon: "file-text", sortOrder: 10 },
  { code: "rectifications", name: "整改单", path: "/rectifications", icon: "wrench", sortOrder: 20 },
  { code: "analytics", name: "数据分析", path: "/analytics", icon: "bar-chart-3", sortOrder: 30 },
  { code: "users", name: "用户管理", path: "/admin/users", icon: "shield-user", sortOrder: 40 },
  { code: "system", name: "系统管理", path: "/master-data", icon: "settings-2", sortOrder: 50 }
];

const rolePermissionMatrix: Record<RoleCode, PermissionCode[]> = {
  admin: [...permissionDefinitions.map((item) => item.code)],
  manage: [
    "report:read",
    "review:write",
    "rectification:read",
    "analytics:read",
    "analytics:job:manage",
    "user:read",
    "user:write",
    "role:read",
    "role:write",
    "scope:write"
  ],
  viewer: ["report:read", "rectification:read", "analytics:read"],
  reviewer: ["report:read", "review:write", "rectification:read", "analytics:read"]
};

const roleMenuMatrix: Record<RoleCode, string[]> = {
  admin: navigationMenuDefinitions.map((item) => item.code),
  manage: ["reports", "rectifications", "analytics", "users"],
  viewer: ["reports", "rectifications", "analytics"],
  reviewer: ["reports", "rectifications", "analytics"]
};

type JoinedUserRow = {
  id: number;
  username: string;
  displayName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  roleCode: string | null;
  permissionCode: string | null;
};

type JoinedNavigationMenuRow = {
  userId: number;
  code: string;
  name: string;
  path: string;
  icon: string;
  sortOrder: number;
};

type JoinedManagedMenuRow = {
  code: string;
  name: string;
  path: string;
  icon: string;
  sortOrder: number;
  visible: number;
  roleCode: string | null;
};

function nowIso(): any {
  return new Date().toISOString();
}

function hashToken(token: string): any {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeRoleCode(value: string): any {
  return value === "admin" || value === "manage" || value === "reviewer" ? value : "viewer";
}

function normalizeScopeValues(values: string[]): any {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function normalizePermissionCodes(values: PermissionCode[]): any {
  const allowed = new Set(permissionDefinitions.map((item) => item.code));
  return Array.from(new Set(values)).filter((item): any => allowed.has(item));
}

function normalizeSecurityPolicy(policy: AuthSecurityPolicy): any {
  return {
    passwordMinLength: Math.max(8, Math.floor(policy.passwordMinLength)),
    requireUppercase: Boolean(policy.requireUppercase),
    requireLowercase: Boolean(policy.requireLowercase),
    requireNumber: Boolean(policy.requireNumber),
    requireSpecialCharacter: Boolean(policy.requireSpecialCharacter),
    loginMaxFailures: Math.max(1, Math.floor(policy.loginMaxFailures)),
    loginLockDurationMs: Math.max(1000, Math.floor(policy.loginLockDurationMs))
  };
}

async function loadScopeMap(
  userIds: number[]
): Promise<any> {
  const normalizedUserIds = Array.from(new Set(userIds.filter((item) => Number.isInteger(item) && item > 0)));
  if (normalizedUserIds.length === 0) {
    return new Map();
  }

  const rows = await db
      .select({
        userId: reportUserScopeTable.userId,
        scopeType: reportUserScopeTable.scopeType,
        scopeValue: reportUserScopeTable.scopeValue
      })
      .from(reportUserScopeTable)
      .where(inArray(reportUserScopeTable.userId, normalizedUserIds));

  const scopeMap = new Map<number, { enterpriseScopeIds: string[]; organizationScopeIds: string[]; storeScopeIds: string[] }>();
  rows.forEach((row) => {
    const bucket = scopeMap.get(row.userId) || { enterpriseScopeIds: [], organizationScopeIds: [], storeScopeIds: [] };
    if (row.scopeType === "enterprise") {
      bucket.enterpriseScopeIds.push(row.scopeValue);
    }
    if (row.scopeType === "organization") {
      bucket.organizationScopeIds.push(row.scopeValue);
    }
    if (row.scopeType === "store") {
      bucket.storeScopeIds.push(row.scopeValue);
    }
    scopeMap.set(row.userId, bucket);
  });

  scopeMap.forEach((value, key) => {
    scopeMap.set(key, {
      enterpriseScopeIds: normalizeScopeValues(value.enterpriseScopeIds),
      organizationScopeIds: normalizeScopeValues(value.organizationScopeIds),
      storeScopeIds: normalizeScopeValues(value.storeScopeIds)
    });
  });

  return scopeMap;
}

async function loadNavigationMenuMap(userIds: number[]): Promise<any> {
  const normalizedUserIds = Array.from(new Set(userIds.filter((item) => Number.isInteger(item) && item > 0)));
  if (normalizedUserIds.length === 0) {
    return new Map();
  }

  const rows = await db
      .select({
        userId: reportUserRoleTable.userId,
        code: reportMenuTable.code,
        name: reportMenuTable.name,
        path: reportMenuTable.path,
        icon: reportMenuTable.icon,
        sortOrder: reportMenuTable.sortOrder
      })
      .from(reportUserRoleTable)
      .innerJoin(reportRoleMenuTable, eq(reportRoleMenuTable.roleId, reportUserRoleTable.roleId))
      .innerJoin(reportMenuTable, eq(reportMenuTable.id, reportRoleMenuTable.menuId))
      .where(and(inArray(reportUserRoleTable.userId, normalizedUserIds), eq(reportMenuTable.visible, 1)))
      .orderBy(reportUserRoleTable.userId, reportMenuTable.sortOrder, reportMenuTable.id) as JoinedNavigationMenuRow[];

  const menuMap = new Map<number, NavigationMenuItem[]>();
  rows.forEach((row) => {
    const bucket = menuMap.get(row.userId) || [];
    if (!bucket.some((item) => item.code === row.code)) {
      bucket.push({
        code: row.code,
        label: row.name,
        href: row.path,
        icon: row.icon,
        sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : 0
      });
    }
    menuMap.set(row.userId, bucket);
  });

  return menuMap;
}

function mapUsers(
  rows: JoinedUserRow[],
  scopeMap: Map<number, { enterpriseScopeIds: string[]; organizationScopeIds: string[]; storeScopeIds: string[] }>,
  menuMap: Map<number, NavigationMenuItem[]>
): any {
  const bucket = new Map<number, UserAccount>();
  rows.forEach((row) => {
    const existing = bucket.get(row.id);
    if (!existing) {
      const scopes = scopeMap.get(row.id) || { enterpriseScopeIds: [], organizationScopeIds: [], storeScopeIds: [] };
      bucket.set(row.id, {
        id: row.id,
        username: row.username,
        displayName: row.displayName,
        status: row.status,
        roles: row.roleCode ? [normalizeRoleCode(row.roleCode)] : [],
        permissions: row.permissionCode ? [row.permissionCode as PermissionCode] : [],
        enterpriseScopeIds: scopes.enterpriseScopeIds,
        organizationScopeIds: scopes.organizationScopeIds,
        storeScopeIds: scopes.storeScopeIds,
        navigationMenus: menuMap.get(row.id) || [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      });
      return;
    }
    if (row.roleCode) {
      const roleCode = normalizeRoleCode(row.roleCode);
      if (!existing.roles.includes(roleCode)) {
        existing.roles.push(roleCode);
      }
    }
    if (row.permissionCode) {
      const permissionCode = row.permissionCode as PermissionCode;
      if (!existing.permissions.includes(permissionCode)) {
        existing.permissions.push(permissionCode);
      }
    }
  });
  return Array.from(bucket.values()).sort((left, right) => left.id - right.id);
}

export class PgAuthRepository implements AuthRepository {
  async ensureBootstrap(adminUsername: string, adminPassword: string, adminDisplayName: string): Promise<any> {
    await db.transaction(async (tx): Promise<any> => {
      for (const permission of permissionDefinitions) {
        await tx
                    .insert(reportPermissionTable)
                    .values({
                      code: permission.code,
                      name: permission.name,
                      description: permission.description
                    })
                    .onConflictDoNothing({ target: reportPermissionTable.code });
      }

      const allowedPermissionCodes = new Set(permissionDefinitions.map((item) => item.code));
      const existingPermissionRows = await tx
              .select({
                id: reportPermissionTable.id,
                code: reportPermissionTable.code
              })
              .from(reportPermissionTable);
      for (const row of existingPermissionRows) {
        if (!allowedPermissionCodes.has(row.code as PermissionCode)) {
          await tx.delete(reportPermissionTable).where(eq(reportPermissionTable.id, row.id));
        }
      }

      for (const role of roleDefinitions) {
        await tx
                    .insert(reportRoleTable)
                    .values({
                      code: role.code,
                      name: role.name,
                      description: role.description
                    })
                    .onConflictDoNothing({ target: reportRoleTable.code });
      }

      const permissionRows = await tx.select().from(reportPermissionTable);
      const permissionMap = new Map(permissionRows.map((item) => [item.code, item.id]));
      const roleRows = await tx.select().from(reportRoleTable);
      const roleMap = new Map(roleRows.map((item) => [item.code, item.id]));

      for (const menu of navigationMenuDefinitions) {
        await tx
                    .insert(reportMenuTable)
                    .values({
                      code: menu.code,
                      name: menu.name,
                      path: menu.path,
                      icon: menu.icon,
                      sortOrder: menu.sortOrder,
                      visible: 1,
                      updatedAt: nowIso()
                    })
                    .onConflictDoUpdate({
                      target: reportMenuTable.code,
                      set: {
                        name: menu.name,
                        path: menu.path,
                        icon: menu.icon,
                        sortOrder: menu.sortOrder,
                        visible: 1,
                        updatedAt: nowIso()
                      }
                    });
      }

      const menuRows = await tx.select().from(reportMenuTable);
      const menuMap = new Map(menuRows.map((item) => [item.code, item.id]));

      for (const role of roleDefinitions) {
        const roleId = roleMap.get(role.code);
        if (!roleId) {
          continue;
        }
        for (const menuCode of roleMenuMatrix[role.code]) {
          const menuId = menuMap.get(menuCode);
          if (!menuId) {
            continue;
          }
          await tx
                        .insert(reportRoleMenuTable)
                        .values({ roleId, menuId })
                        .onConflictDoNothing({
                          target: [reportRoleMenuTable.roleId, reportRoleMenuTable.menuId]
                        });
        }
      }

      for (const role of roleDefinitions) {
        const roleId = roleMap.get(role.code);
        if (!roleId) {
          continue;
        }

        const existingRolePermissionRows = await tx
                  .select({ roleId: reportRolePermissionTable.roleId })
                  .from(reportRolePermissionTable)
                  .where(eq(reportRolePermissionTable.roleId, roleId));

        if (existingRolePermissionRows.length > 0 && role.code !== "admin") {
          continue;
        }

        for (const permissionCode of rolePermissionMatrix[role.code]) {
          const permissionId = permissionMap.get(permissionCode);
          if (!permissionId) {
            continue;
          }
          await tx
                        .insert(reportRolePermissionTable)
                        .values({ roleId, permissionId })
                        .onConflictDoNothing({
                          target: [reportRolePermissionTable.roleId, reportRolePermissionTable.permissionId]
                        });
        }
      }

      const adminUser = (await tx
              .select()
              .from(reportUserTable)
              .where(eq(reportUserTable.username, adminUsername)))[0];

      if (!adminUser) {
        const createdAt = nowIso();
        const inserted = (await tx
                  .insert(reportUserTable)
                  .values({
                    username: adminUsername,
                    passwordHash: hashPassword(adminPassword),
                    displayName: adminDisplayName,
                    status: "active",
                    createdAt,
                    updatedAt: createdAt
                  })
                  .returning({ id: reportUserTable.id }))[0];
        const adminRoleId = roleMap.get("admin");
        if (adminRoleId) {
          await tx
                        .insert(reportUserRoleTable)
                        .values({ userId: inserted.id, roleId: adminRoleId })
                        .onConflictDoNothing({ target: [reportUserRoleTable.userId, reportUserRoleTable.roleId] });
        }
      }
    });
  }

  async authenticate(username: string, password: string, policy: AuthSecurityPolicy): Promise<any> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      return { ok: false, reason: "invalid_credentials" };
    }
    const normalizedPolicy = normalizeSecurityPolicy(policy);
    const currentGuard = (await db
          .select()
          .from(authLoginGuardTable)
          .where(eq(authLoginGuardTable.username, normalizedUsername)))[0];
    const now = Date.now();
    const lockedUntil = String(currentGuard?.lockedUntil || "").trim();
    if (lockedUntil) {
      const lockedUntilTimestamp = Date.parse(lockedUntil);
      if (Number.isFinite(lockedUntilTimestamp) && lockedUntilTimestamp > now) {
        return { ok: false, reason: "locked", lockedUntil };
      }
      await db.update(authLoginGuardTable)
                .set({
                  failedCount: 0,
                  lockedUntil: null,
                  updatedAt: nowIso()
                })
                .where(eq(authLoginGuardTable.username, normalizedUsername));
    }
    const user = (await db
          .select()
          .from(reportUserTable)
          .where(and(eq(reportUserTable.username, normalizedUsername), eq(reportUserTable.status, "active"))))[0];

    if (!user || !verifyPassword(password, user.passwordHash)) {
      const nextFailedCount = (currentGuard?.failedCount || 0) + 1;
      const hasReachedThreshold = nextFailedCount >= normalizedPolicy.loginMaxFailures;
      const nextLockedUntil = hasReachedThreshold ? new Date(now + normalizedPolicy.loginLockDurationMs).toISOString() : null;
      await db.insert(authLoginGuardTable)
                .values({
                  username: normalizedUsername,
                  failedCount: nextFailedCount,
                  lockedUntil: nextLockedUntil,
                  lastFailedAt: nowIso(),
                  createdAt: nowIso(),
                  updatedAt: nowIso()
                })
                .onConflictDoUpdate({
                  target: authLoginGuardTable.username,
                  set: {
                    failedCount: nextFailedCount,
                    lockedUntil: nextLockedUntil,
                    lastFailedAt: nowIso(),
                    updatedAt: nowIso()
                  }
                });
      if (nextLockedUntil) {
        return { ok: false, reason: "locked", lockedUntil: nextLockedUntil };
      }
      return { ok: false, reason: "invalid_credentials" };
    }

    await db.delete(authLoginGuardTable).where(eq(authLoginGuardTable.username, normalizedUsername));
    await db.update(reportUserTable).set({ updatedAt: nowIso() }).where(eq(reportUserTable.id, user.id));
    const sessionUser = await this.findUserById(user.id);
    if (!sessionUser) {
      return { ok: false, reason: "invalid_credentials" };
    }
    return { ok: true, user: sessionUser };
  }

  async createSession(userId: number, expiresAt: string): Promise<any> {
    const token = randomBytes(32).toString("hex");
    await db.insert(reportSessionTable)
            .values({
              userId,
              sessionTokenHash: hashToken(token),
              expiresAt,
              createdAt: nowIso(),
              lastSeenAt: nowIso()
            });
    return token;
  }

  async findSessionUser(sessionToken: string): Promise<any> {
    const normalizedToken = sessionToken.trim();
    if (!normalizedToken) {
      return null;
    }
    const session = (await db
          .select({
            userId: reportSessionTable.userId
          })
          .from(reportSessionTable)
          .where(
            and(
              eq(reportSessionTable.sessionTokenHash, hashToken(normalizedToken)),
              gt(reportSessionTable.expiresAt, nowIso())
            )
          ))[0];
    if (!session) {
      return null;
    }
    return this.findUserById(session.userId);
  }

  async touchSession(sessionToken: string): Promise<any> {
    const normalizedToken = sessionToken.trim();
    if (!normalizedToken) {
      return;
    }
    await db.update(reportSessionTable)
            .set({ lastSeenAt: nowIso() })
            .where(eq(reportSessionTable.sessionTokenHash, hashToken(normalizedToken)));
  }

  async deleteSession(sessionToken: string): Promise<any> {
    const normalizedToken = sessionToken.trim();
    if (!normalizedToken) {
      return;
    }
    await db.delete(reportSessionTable)
            .where(eq(reportSessionTable.sessionTokenHash, hashToken(normalizedToken)));
  }

  async deleteSessionsByUserId(userId: number): Promise<any> {
    if (!Number.isInteger(userId) || userId <= 0) {
      return;
    }
    await db.delete(reportSessionTable).where(eq(reportSessionTable.userId, userId));
  }

  async listUsers(): Promise<any> {
    const rows = await db
          .select({
            id: reportUserTable.id,
            username: reportUserTable.username,
            displayName: reportUserTable.displayName,
            status: reportUserTable.status,
            createdAt: reportUserTable.createdAt,
            updatedAt: reportUserTable.updatedAt,
            roleCode: reportRoleTable.code,
            permissionCode: reportPermissionTable.code
          })
          .from(reportUserTable)
          .leftJoin(reportUserRoleTable, eq(reportUserRoleTable.userId, reportUserTable.id))
          .leftJoin(reportRoleTable, eq(reportRoleTable.id, reportUserRoleTable.roleId))
          .leftJoin(reportRolePermissionTable, eq(reportRolePermissionTable.roleId, reportRoleTable.id))
          .leftJoin(reportPermissionTable, eq(reportPermissionTable.id, reportRolePermissionTable.permissionId))
          .orderBy(reportUserTable.id) as JoinedUserRow[];

    const userIds = rows.map((row) => row.id);
    return mapUsers(rows, await loadScopeMap(userIds), await loadNavigationMenuMap(userIds));
  }

  async createUser(input: CreateUserInput): Promise<any> {
    const normalizedUsername = input.username.trim();
    const normalizedPassword = input.password.trim();
    const normalizedDisplayName = input.displayName.trim() || normalizedUsername;
    const normalizedRole = input.roleCode;

    if (!normalizedUsername || !normalizedPassword) {
      throw new Error("Username and password are required.");
    }

    const createdAt = nowIso();
    const userId = await db.transaction(async (tx): Promise<any> => {
      const existing = (await tx
              .select({ id: reportUserTable.id })
              .from(reportUserTable)
              .where(eq(reportUserTable.username, normalizedUsername)))[0];
      if (existing) {
        throw new Error("Username already exists.");
      }

      const inserted = (await tx
              .insert(reportUserTable)
              .values({
                username: normalizedUsername,
                passwordHash: hashPassword(normalizedPassword),
                displayName: normalizedDisplayName,
                status: "active",
                createdAt,
                updatedAt: createdAt
              })
              .returning({ id: reportUserTable.id }))[0];

      const role = (await tx
              .select({ id: reportRoleTable.id })
              .from(reportRoleTable)
              .where(eq(reportRoleTable.code, normalizedRole)))[0];
      if (!role) {
        throw new Error("Role not found.");
      }

      await tx.insert(reportUserRoleTable)
                .values({ userId: inserted.id, roleId: role.id });

      for (const scopeValue of normalizeScopeValues(input.enterpriseScopeIds)) {
        await tx
                    .insert(reportUserScopeTable)
                    .values({ userId: inserted.id, scopeType: "enterprise", scopeValue })
                    .onConflictDoNothing({
                      target: [reportUserScopeTable.userId, reportUserScopeTable.scopeType, reportUserScopeTable.scopeValue]
                    });
      }

      for (const scopeValue of normalizeScopeValues(input.organizationScopeIds)) {
        await tx
                    .insert(reportUserScopeTable)
                    .values({ userId: inserted.id, scopeType: "organization", scopeValue })
                    .onConflictDoNothing({
                      target: [reportUserScopeTable.userId, reportUserScopeTable.scopeType, reportUserScopeTable.scopeValue]
                    });
      }

      for (const scopeValue of normalizeScopeValues(input.storeScopeIds)) {
        await tx
                    .insert(reportUserScopeTable)
                    .values({ userId: inserted.id, scopeType: "store", scopeValue })
                    .onConflictDoNothing({
                      target: [reportUserScopeTable.userId, reportUserScopeTable.scopeType, reportUserScopeTable.scopeValue]
                    });
      }

      return inserted.id;
    });

    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error("Failed to create user.");
    }
    return {
      ...user,
      createdAt,
      updatedAt: createdAt
    };
  }

  async updateUserProfile(input: UpdateUserProfileInput): Promise<any> {
    if (!Number.isInteger(input.userId) || input.userId <= 0) {
      throw new Error("Invalid user id.");
    }

    await db.transaction(async (tx): Promise<any> => {
      const existingUser = (await tx
              .select({ id: reportUserTable.id })
              .from(reportUserTable)
              .where(eq(reportUserTable.id, input.userId)))[0];
      if (!existingUser) {
        throw new Error("User not found.");
      }

      if (input.roleCode) {
        const role = (await tx
                  .select({ id: reportRoleTable.id })
                  .from(reportRoleTable)
                  .where(eq(reportRoleTable.code, input.roleCode)))[0];
        if (!role) {
          throw new Error("Role not found.");
        }
        await tx.delete(reportUserRoleTable).where(eq(reportUserRoleTable.userId, input.userId));
        await tx.insert(reportUserRoleTable).values({ userId: input.userId, roleId: role.id });
      }

      if (input.scopeUpdate) {
        await tx.delete(reportUserScopeTable).where(eq(reportUserScopeTable.userId, input.userId));

        for (const scopeValue of normalizeScopeValues(input.scopeUpdate.enterpriseScopeIds)) {
          await tx.insert(reportUserScopeTable).values({ userId: input.userId, scopeType: "enterprise", scopeValue });
        }

        for (const scopeValue of normalizeScopeValues(input.scopeUpdate.organizationScopeIds)) {
          await tx.insert(reportUserScopeTable).values({ userId: input.userId, scopeType: "organization", scopeValue });
        }

        for (const scopeValue of normalizeScopeValues(input.scopeUpdate.storeScopeIds)) {
          await tx.insert(reportUserScopeTable).values({ userId: input.userId, scopeType: "store", scopeValue });
        }
      }

      const normalizedPassword = (input.password || "").trim();
      const shouldTouchUserRecord = Boolean(
        input.roleCode || input.scopeUpdate || normalizedPassword || input.status
      );
      if (shouldTouchUserRecord) {
        const userPatch: Partial<{
          status: "active" | "disabled";
          passwordHash: string;
          updatedAt: string;
        }> = {
          updatedAt: nowIso()
        };
        if (normalizedPassword) {
          if (normalizedPassword.length < 8) {
            throw new Error("Password must be at least 8 characters.");
          }
          userPatch.passwordHash = hashPassword(normalizedPassword);
        }
        if (input.status) {
          userPatch.status = input.status;
        }
        await tx.update(reportUserTable).set(userPatch).where(eq(reportUserTable.id, input.userId));
      }

      if (input.status === "disabled" && input.revokeSessionsWhenDisabled !== false) {
        await tx.delete(reportSessionTable).where(eq(reportSessionTable.userId, input.userId));
      }
    });
  }

  async updateUserRole(userId: number, roleCode: RoleCode): Promise<any> {
    await db.transaction(async (tx): Promise<any> => {
      const role = (await tx
              .select({ id: reportRoleTable.id })
              .from(reportRoleTable)
              .where(eq(reportRoleTable.code, roleCode)))[0];
      if (!role) {
        throw new Error("Role not found.");
      }
      await tx.delete(reportUserRoleTable).where(eq(reportUserRoleTable.userId, userId));
      await tx.insert(reportUserRoleTable).values({ userId, roleId: role.id });
      await tx.update(reportUserTable).set({ updatedAt: nowIso() }).where(eq(reportUserTable.id, userId));
    });
  }

  async replaceUserScopes(userId: number, enterpriseScopeIds: string[], organizationScopeIds: string[], storeScopeIds: string[]): Promise<any> {
    await db.transaction(async (tx): Promise<any> => {
      await tx.delete(reportUserScopeTable).where(eq(reportUserScopeTable.userId, userId));

      for (const scopeValue of normalizeScopeValues(enterpriseScopeIds)) {
        await tx.insert(reportUserScopeTable).values({ userId, scopeType: "enterprise", scopeValue });
      }

      for (const scopeValue of normalizeScopeValues(organizationScopeIds)) {
        await tx.insert(reportUserScopeTable).values({ userId, scopeType: "organization", scopeValue });
      }

      for (const scopeValue of normalizeScopeValues(storeScopeIds)) {
        await tx.insert(reportUserScopeTable).values({ userId, scopeType: "store", scopeValue });
      }

      await tx.update(reportUserTable).set({ updatedAt: nowIso() }).where(eq(reportUserTable.id, userId));
    });
  }

  async updateUserPassword(userId: number, nextPassword: string): Promise<any> {
    const normalizedPassword = nextPassword.trim();
    if (!normalizedPassword || normalizedPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    await db.update(reportUserTable)
            .set({ passwordHash: hashPassword(normalizedPassword), updatedAt: nowIso() })
            .where(eq(reportUserTable.id, userId));
  }

  async updateUserStatus(userId: number, status: "active" | "disabled"): Promise<any> {
    await db.update(reportUserTable)
            .set({ status, updatedAt: nowIso() })
            .where(eq(reportUserTable.id, userId));
  }

  async listRolePermissionMatrix(): Promise<any> {
    const roleRows = await db.select().from(reportRoleTable);
    const rolePermissionRows = await db
          .select({
            roleCode: reportRoleTable.code,
            permissionCode: reportPermissionTable.code
          })
          .from(reportRolePermissionTable)
          .innerJoin(reportRoleTable, eq(reportRoleTable.id, reportRolePermissionTable.roleId))
          .innerJoin(reportPermissionTable, eq(reportPermissionTable.id, reportRolePermissionTable.permissionId));

    const permissionMap = new Map(
      rolePermissionRows.map((row) => [String(row.roleCode), [] as PermissionCode[]])
    );
    roleRows.forEach((role) => {
      if (!permissionMap.has(role.code)) {
        permissionMap.set(role.code, []);
      }
    });
    rolePermissionRows.forEach((row) => {
      const roleCode = String(row.roleCode);
      const permissionCode = String(row.permissionCode) as PermissionCode;
      const bucket = permissionMap.get(roleCode) || [];
      if (!bucket.includes(permissionCode)) {
        bucket.push(permissionCode);
      }
      permissionMap.set(roleCode, bucket);
    });

    const roleOrder = new Map(roleDefinitions.map((item, index) => [item.code, index]));
    const permissionOrder = new Map(permissionDefinitions.map((item, index) => [item.code, index]));

    return roleRows
      .map((role) => ({
        roleCode: normalizeRoleCode(role.code),
        roleName: role.name,
        roleDescription: role.description || "",
        permissionCodes: (permissionMap.get(role.code) || [])
          .slice()
          .sort((left, right) => (permissionOrder.get(left) ?? 99) - (permissionOrder.get(right) ?? 99))
      }))
      .sort((left, right) => (roleOrder.get(left.roleCode) ?? 99) - (roleOrder.get(right.roleCode) ?? 99));
  }

  async replaceRolePermissions(roleCode: RoleCode, permissionCodes: PermissionCode[]): Promise<any> {
    const normalizedRoleCode = normalizeRoleCode(roleCode);
    const restrictedForNonAdmin = new Set<PermissionCode>(["master-data:read", "system:settings:read", "system:settings:write"]);
    const nextPermissions =
      normalizedRoleCode === "admin"
        ? [...rolePermissionMatrix.admin]
        : normalizePermissionCodes(permissionCodes).filter((code) => !restrictedForNonAdmin.has(code));

    await db.transaction(async (tx): Promise<any> => {
      const role = (await tx
              .select({ id: reportRoleTable.id })
              .from(reportRoleTable)
              .where(eq(reportRoleTable.code, normalizedRoleCode)))[0];
      if (!role) {
        throw new Error("Role not found.");
      }

      await tx.delete(reportRolePermissionTable).where(eq(reportRolePermissionTable.roleId, role.id));

      if (nextPermissions.length > 0) {
        const permissionRows = await tx
                  .select({
                    code: reportPermissionTable.code,
                    id: reportPermissionTable.id
                  })
                  .from(reportPermissionTable)
                  .where(inArray(reportPermissionTable.code, nextPermissions));
        const permissionMap = new Map(permissionRows.map((item) => [item.code, item.id]));
        for (const permissionCode of nextPermissions) {
          const permissionId = permissionMap.get(permissionCode);
          if (!permissionId) {
            continue;
          }
          await tx
                        .insert(reportRolePermissionTable)
                        .values({ roleId: role.id, permissionId })
                        .onConflictDoNothing({
                          target: [reportRolePermissionTable.roleId, reportRolePermissionTable.permissionId]
                        });
        }
      }
    });
  }

  async listManagedNavigationMenus(): Promise<any> {
    const rows = await db
          .select({
            code: reportMenuTable.code,
            name: reportMenuTable.name,
            path: reportMenuTable.path,
            icon: reportMenuTable.icon,
            sortOrder: reportMenuTable.sortOrder,
            visible: reportMenuTable.visible,
            roleCode: reportRoleTable.code
          })
          .from(reportMenuTable)
          .leftJoin(reportRoleMenuTable, eq(reportRoleMenuTable.menuId, reportMenuTable.id))
          .leftJoin(reportRoleTable, eq(reportRoleTable.id, reportRoleMenuTable.roleId))
          .orderBy(reportMenuTable.sortOrder, reportMenuTable.id) as JoinedManagedMenuRow[];

    const bucket = new Map<string, ManagedNavigationMenuItem>();
    rows.forEach((row) => {
      const existing = bucket.get(row.code);
      if (!existing) {
        bucket.set(row.code, {
          code: row.code,
          label: row.name,
          href: row.path,
          icon: row.icon,
          sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : 0,
          visible: Number(row.visible) === 1,
          roleCodes: row.roleCode ? [normalizeRoleCode(row.roleCode)] : []
        });
        return;
      }
      if (row.roleCode) {
        const roleCode = normalizeRoleCode(row.roleCode);
        if (!existing.roleCodes.includes(roleCode)) {
          existing.roleCodes.push(roleCode);
        }
      }
    });
    return Array.from(bucket.values()).sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async saveManagedNavigationMenus(items: ManagedNavigationMenuItem[]): Promise<any> {
    const normalizedItems = Array.from(
      new Map(
        items.map((item) => [
          item.code,
          {
            ...item,
            code: String(item.code || "").trim(),
            label: String(item.label || "").trim(),
            href: String(item.href || "").trim(),
            icon: String(item.icon || "").trim(),
            sortOrder: Number.isFinite(item.sortOrder) ? Math.max(0, Math.floor(item.sortOrder)) : 0,
            visible: Boolean(item.visible),
            roleCodes: Array.from(new Set(item.roleCodes))
          }
        ])
      ).values()
    ).filter((item) => item.code);

    await db.transaction(async (tx): Promise<any> => {
      for (const item of normalizedItems) {
        await tx.update(reportMenuTable)
                    .set({
                      name: item.label,
                      path: item.href,
                      icon: item.icon,
                      sortOrder: item.sortOrder,
                      visible: item.visible ? 1 : 0,
                      updatedAt: nowIso()
                    })
                    .where(eq(reportMenuTable.code, item.code));
      }

      const roleRows = await tx.select().from(reportRoleTable);
      const roleMap = new Map(roleRows.map((item) => [item.code, item.id]));
      const menuRows = await tx.select().from(reportMenuTable);
      const menuMap = new Map(menuRows.map((item) => [item.code, item.id]));
      const mutableRoles: RoleCode[] = ["manage", "viewer", "reviewer"];

      for (const roleCode of mutableRoles) {
        const roleId = roleMap.get(roleCode);
        if (!roleId) {
          continue;
        }
        await tx.delete(reportRoleMenuTable).where(eq(reportRoleMenuTable.roleId, roleId));
      }

      const adminRoleId = roleMap.get("admin");
      if (adminRoleId) {
        await tx.delete(reportRoleMenuTable).where(eq(reportRoleMenuTable.roleId, adminRoleId));
        for (const menu of menuRows) {
          await tx
                        .insert(reportRoleMenuTable)
                        .values({ roleId: adminRoleId, menuId: menu.id })
                        .onConflictDoNothing({
                          target: [reportRoleMenuTable.roleId, reportRoleMenuTable.menuId]
                        });
        }
      }

      for (const roleCode of mutableRoles) {
        const roleId = roleMap.get(roleCode);
        if (!roleId) {
          continue;
        }
        for (const item of normalizedItems) {
          if (!item.roleCodes.includes(roleCode)) {
            continue;
          }
          const menuId = menuMap.get(item.code);
          if (!menuId) {
            continue;
          }
          await tx
                        .insert(reportRoleMenuTable)
                        .values({ roleId, menuId })
                        .onConflictDoNothing({
                          target: [reportRoleMenuTable.roleId, reportRoleMenuTable.menuId]
                        });
        }
      }
    });
  }

  async createAuditLog(input: AuthAuditLogInput): Promise<any> {
    await db.insert(authAuditLogTable)
            .values({
              operatorUserId: input.operatorUserId,
              operatorUsername: input.operatorUsername.trim(),
              targetUserId: input.targetUserId,
              targetUsername: input.targetUsername.trim(),
              action: input.action.trim(),
              beforeJson: input.beforeJson.trim() || "{}",
              afterJson: input.afterJson.trim() || "{}",
              requestId: input.requestId.trim(),
              ipAddress: input.ipAddress.trim(),
              userAgent: input.userAgent.trim(),
              createdAt: nowIso()
            });
  }

  async listAuditLogs(limit: number): Promise<any> {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 100;
    return await db
          .select({
            id: authAuditLogTable.id,
            operatorUserId: authAuditLogTable.operatorUserId,
            operatorUsername: authAuditLogTable.operatorUsername,
            targetUserId: authAuditLogTable.targetUserId,
            targetUsername: authAuditLogTable.targetUsername,
            action: authAuditLogTable.action,
            beforeJson: authAuditLogTable.beforeJson,
            afterJson: authAuditLogTable.afterJson,
            requestId: authAuditLogTable.requestId,
            ipAddress: authAuditLogTable.ipAddress,
            userAgent: authAuditLogTable.userAgent,
            createdAt: authAuditLogTable.createdAt
          })
          .from(authAuditLogTable)
          .orderBy(desc(authAuditLogTable.id))
          .limit(normalizedLimit);
  }

  async queryAuditLogs(query: AuthAuditLogQuery): Promise<any> {
    const pageSize = Number.isFinite(query.pageSize) ? Math.max(1, Math.min(200, Math.floor(query.pageSize))) : 20;
    const page = Number.isFinite(query.page) ? Math.max(1, Math.floor(query.page)) : 1;
    const action = String(query.action || "").trim();
    const keyword = String(query.keyword || "").trim();
    const whereClauses: SQL[] = [];
    if (action) {
      whereClauses.push(eq(authAuditLogTable.action, action));
    }
    if (keyword) {
      const pattern = `%${keyword}%`;
      const keywordCondition = or(
        ilike(authAuditLogTable.operatorUsername, pattern),
        ilike(authAuditLogTable.targetUsername, pattern),
        ilike(authAuditLogTable.action, pattern),
        ilike(authAuditLogTable.requestId, pattern),
        ilike(authAuditLogTable.ipAddress, pattern),
        ilike(authAuditLogTable.beforeJson, pattern),
        ilike(authAuditLogTable.afterJson, pattern)
      );
      if (keywordCondition) {
        whereClauses.push(keywordCondition);
      }
    }

    const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
    const countRow = where
      ? (await db
                  .select({ count: sql<number>`count(*)` })
                  .from(authAuditLogTable)
                  .where(where))[0]
      : (await db.select({ count: sql<number>`count(*)` }).from(authAuditLogTable))[0];
    const total = Number(countRow?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const baseQuery = db
      .select({
        id: authAuditLogTable.id,
        operatorUserId: authAuditLogTable.operatorUserId,
        operatorUsername: authAuditLogTable.operatorUsername,
        targetUserId: authAuditLogTable.targetUserId,
        targetUsername: authAuditLogTable.targetUsername,
        action: authAuditLogTable.action,
        beforeJson: authAuditLogTable.beforeJson,
        afterJson: authAuditLogTable.afterJson,
        requestId: authAuditLogTable.requestId,
        ipAddress: authAuditLogTable.ipAddress,
        userAgent: authAuditLogTable.userAgent,
        createdAt: authAuditLogTable.createdAt
      })
      .from(authAuditLogTable);
    const filteredQuery = where ? baseQuery.where(where) : baseQuery;
    const items = await filteredQuery.orderBy(desc(authAuditLogTable.id)).limit(pageSize).offset(offset);

    return {
      page: safePage,
      pageSize,
      total,
      items
    };
  }

  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): any {
    if (!user) {
      return false;
    }
    return user.permissions.includes(permissionCode);
  }

  private async findUserById(userId: number): Promise<any> {
    const rows = await db
          .select({
            id: reportUserTable.id,
            username: reportUserTable.username,
            displayName: reportUserTable.displayName,
            status: reportUserTable.status,
            createdAt: reportUserTable.createdAt,
            updatedAt: reportUserTable.updatedAt,
            roleCode: reportRoleTable.code,
            permissionCode: reportPermissionTable.code
          })
          .from(reportUserTable)
          .leftJoin(reportUserRoleTable, eq(reportUserRoleTable.userId, reportUserTable.id))
          .leftJoin(reportRoleTable, eq(reportRoleTable.id, reportUserRoleTable.roleId))
          .leftJoin(reportRolePermissionTable, eq(reportRolePermissionTable.roleId, reportRoleTable.id))
          .leftJoin(reportPermissionTable, eq(reportPermissionTable.id, reportRolePermissionTable.permissionId))
          .where(eq(reportUserTable.id, userId)) as JoinedUserRow[];

    return mapUsers(rows, await loadScopeMap([userId]), await loadNavigationMenuMap([userId]))[0] ?? null;
  }
}
