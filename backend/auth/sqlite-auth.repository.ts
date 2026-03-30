import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/backend/auth/password";
import type { AuthRepository } from "@/backend/auth/auth.repository";
import type { CreateUserInput, PermissionCode, RoleCode, SessionUser, UserAccount } from "@/backend/auth/auth.types";
import { db } from "@/backend/database/client";
import {
  reportPermissionTable,
  reportRolePermissionTable,
  reportRoleTable,
  reportSessionTable,
  reportUserRoleTable,
  reportUserScopeTable,
  reportUserTable
} from "@/backend/database/schema";

const roleDefinitions: Array<{ code: RoleCode; name: string; description: string }> = [
  { code: "admin", name: "管理员", description: "可管理用户、查看报告、执行复检。" },
  { code: "viewer", name: "普通查看者", description: "只读查看报告。" },
  { code: "reviewer", name: "复检员", description: "查看报告并执行复检。" }
];

const permissionDefinitions: Array<{ code: PermissionCode; name: string; description: string }> = [
  { code: "report:read", name: "查看报告", description: "访问报告列表、详情和日志。" },
  { code: "review:write", name: "执行复检", description: "修改图片复检状态并写日志。" },
  { code: "user:manage", name: "用户管理", description: "创建用户并分配角色。" }
];

const rolePermissionMatrix: Record<RoleCode, PermissionCode[]> = {
  admin: ["report:read", "review:write", "user:manage"],
  viewer: ["report:read"],
  reviewer: ["report:read", "review:write"]
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

function nowIso(): string {
  return new Date().toISOString();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeRoleCode(value: string): RoleCode {
  return value === "admin" || value === "reviewer" ? value : "viewer";
}

function normalizeScopeValues(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function loadScopeMap(
  userIds: number[]
): Map<number, { enterpriseScopeIds: string[]; organizationScopeIds: string[]; storeScopeIds: string[] }> {
  const normalizedUserIds = Array.from(new Set(userIds.filter((item) => Number.isInteger(item) && item > 0)));
  if (normalizedUserIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      userId: reportUserScopeTable.userId,
      scopeType: reportUserScopeTable.scopeType,
      scopeValue: reportUserScopeTable.scopeValue
    })
    .from(reportUserScopeTable)
    .where(inArray(reportUserScopeTable.userId, normalizedUserIds))
    .all();

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

function mapUsers(
  rows: JoinedUserRow[],
  scopeMap: Map<number, { enterpriseScopeIds: string[]; organizationScopeIds: string[]; storeScopeIds: string[] }>
): UserAccount[] {
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

export class SqliteAuthRepository implements AuthRepository {
  ensureBootstrap(adminUsername: string, adminPassword: string, adminDisplayName: string): void {
    db.transaction((tx) => {
      permissionDefinitions.forEach((permission) => {
        tx
          .insert(reportPermissionTable)
          .values({
            code: permission.code,
            name: permission.name,
            description: permission.description
          })
          .onConflictDoNothing({ target: reportPermissionTable.code })
          .run();
      });

      roleDefinitions.forEach((role) => {
        tx
          .insert(reportRoleTable)
          .values({
            code: role.code,
            name: role.name,
            description: role.description
          })
          .onConflictDoNothing({ target: reportRoleTable.code })
          .run();
      });

      const permissionRows = tx.select().from(reportPermissionTable).all();
      const permissionMap = new Map(permissionRows.map((item) => [item.code, item.id]));
      const roleRows = tx.select().from(reportRoleTable).all();
      const roleMap = new Map(roleRows.map((item) => [item.code, item.id]));

      roleDefinitions.forEach((role) => {
        const roleId = roleMap.get(role.code);
        if (!roleId) {
          return;
        }
        rolePermissionMatrix[role.code].forEach((permissionCode) => {
          const permissionId = permissionMap.get(permissionCode);
          if (!permissionId) {
            return;
          }
          tx
            .insert(reportRolePermissionTable)
            .values({ roleId, permissionId })
            .onConflictDoNothing({
              target: [reportRolePermissionTable.roleId, reportRolePermissionTable.permissionId]
            })
            .run();
        });
      });

      const adminUser = tx
        .select()
        .from(reportUserTable)
        .where(eq(reportUserTable.username, adminUsername))
        .get();

      if (!adminUser) {
        const createdAt = nowIso();
        const inserted = tx
          .insert(reportUserTable)
          .values({
            username: adminUsername,
            passwordHash: hashPassword(adminPassword),
            displayName: adminDisplayName,
            status: "active",
            createdAt,
            updatedAt: createdAt
          })
          .returning({ id: reportUserTable.id })
          .get();
        const adminRoleId = roleMap.get("admin");
        if (adminRoleId) {
          tx
            .insert(reportUserRoleTable)
            .values({ userId: inserted.id, roleId: adminRoleId })
            .onConflictDoNothing({ target: [reportUserRoleTable.userId, reportUserRoleTable.roleId] })
            .run();
        }
      }
    });
  }

  authenticate(username: string, password: string): SessionUser | null {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      return null;
    }
    const user = db
      .select()
      .from(reportUserTable)
      .where(and(eq(reportUserTable.username, normalizedUsername), eq(reportUserTable.status, "active")))
      .get();

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return null;
    }

    db.update(reportUserTable).set({ updatedAt: nowIso() }).where(eq(reportUserTable.id, user.id)).run();
    return this.findUserById(user.id);
  }

  createSession(userId: number, expiresAt: string): string {
    const token = randomBytes(32).toString("hex");
    db.insert(reportSessionTable)
      .values({
        userId,
        sessionTokenHash: hashToken(token),
        expiresAt,
        createdAt: nowIso(),
        lastSeenAt: nowIso()
      })
      .run();
    return token;
  }

  findSessionUser(sessionToken: string): SessionUser | null {
    const normalizedToken = sessionToken.trim();
    if (!normalizedToken) {
      return null;
    }
    const session = db
      .select({
        userId: reportSessionTable.userId
      })
      .from(reportSessionTable)
      .where(
        and(
          eq(reportSessionTable.sessionTokenHash, hashToken(normalizedToken)),
          gt(reportSessionTable.expiresAt, nowIso())
        )
      )
      .get();
    if (!session) {
      return null;
    }
    return this.findUserById(session.userId);
  }

  touchSession(sessionToken: string): void {
    const normalizedToken = sessionToken.trim();
    if (!normalizedToken) {
      return;
    }
    db.update(reportSessionTable)
      .set({ lastSeenAt: nowIso() })
      .where(eq(reportSessionTable.sessionTokenHash, hashToken(normalizedToken)))
      .run();
  }

  deleteSession(sessionToken: string): void {
    const normalizedToken = sessionToken.trim();
    if (!normalizedToken) {
      return;
    }
    db.delete(reportSessionTable)
      .where(eq(reportSessionTable.sessionTokenHash, hashToken(normalizedToken)))
      .run();
  }

  listUsers(): UserAccount[] {
    const rows = db
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
      .orderBy(reportUserTable.id)
      .all() as JoinedUserRow[];

    return mapUsers(rows, loadScopeMap(rows.map((row) => row.id)));
  }

  createUser(input: CreateUserInput): UserAccount {
    const normalizedUsername = input.username.trim();
    const normalizedPassword = input.password.trim();
    const normalizedDisplayName = input.displayName.trim() || normalizedUsername;
    const normalizedRole = input.roleCode;

    if (!normalizedUsername || !normalizedPassword) {
      throw new Error("Username and password are required.");
    }

    const createdAt = nowIso();
    const userId = db.transaction((tx) => {
      const existing = tx
        .select({ id: reportUserTable.id })
        .from(reportUserTable)
        .where(eq(reportUserTable.username, normalizedUsername))
        .get();
      if (existing) {
        throw new Error("Username already exists.");
      }

      const inserted = tx
        .insert(reportUserTable)
        .values({
          username: normalizedUsername,
          passwordHash: hashPassword(normalizedPassword),
          displayName: normalizedDisplayName,
          status: "active",
          createdAt,
          updatedAt: createdAt
        })
        .returning({ id: reportUserTable.id })
        .get();

      const role = tx
        .select({ id: reportRoleTable.id })
        .from(reportRoleTable)
        .where(eq(reportRoleTable.code, normalizedRole))
        .get();
      if (!role) {
        throw new Error("Role not found.");
      }

      tx.insert(reportUserRoleTable)
        .values({ userId: inserted.id, roleId: role.id })
        .run();

      normalizeScopeValues(input.enterpriseScopeIds).forEach((scopeValue) => {
        tx
          .insert(reportUserScopeTable)
          .values({ userId: inserted.id, scopeType: "enterprise", scopeValue })
          .onConflictDoNothing({
            target: [reportUserScopeTable.userId, reportUserScopeTable.scopeType, reportUserScopeTable.scopeValue]
          })
          .run();
      });

      normalizeScopeValues(input.organizationScopeIds).forEach((scopeValue) => {
        tx
          .insert(reportUserScopeTable)
          .values({ userId: inserted.id, scopeType: "organization", scopeValue })
          .onConflictDoNothing({
            target: [reportUserScopeTable.userId, reportUserScopeTable.scopeType, reportUserScopeTable.scopeValue]
          })
          .run();
      });

      normalizeScopeValues(input.storeScopeIds).forEach((scopeValue) => {
        tx
          .insert(reportUserScopeTable)
          .values({ userId: inserted.id, scopeType: "store", scopeValue })
          .onConflictDoNothing({
            target: [reportUserScopeTable.userId, reportUserScopeTable.scopeType, reportUserScopeTable.scopeValue]
          })
          .run();
      });

      return inserted.id;
    });

    const user = this.findUserById(userId);
    if (!user) {
      throw new Error("Failed to create user.");
    }
    return {
      ...user,
      createdAt,
      updatedAt: createdAt
    };
  }

  updateUserRole(userId: number, roleCode: RoleCode): void {
    db.transaction((tx) => {
      const role = tx
        .select({ id: reportRoleTable.id })
        .from(reportRoleTable)
        .where(eq(reportRoleTable.code, roleCode))
        .get();
      if (!role) {
        throw new Error("Role not found.");
      }
      tx.delete(reportUserRoleTable).where(eq(reportUserRoleTable.userId, userId)).run();
      tx.insert(reportUserRoleTable).values({ userId, roleId: role.id }).run();
      tx.update(reportUserTable).set({ updatedAt: nowIso() }).where(eq(reportUserTable.id, userId)).run();
    });
  }

  replaceUserScopes(userId: number, enterpriseScopeIds: string[], organizationScopeIds: string[], storeScopeIds: string[]): void {
    db.transaction((tx) => {
      tx.delete(reportUserScopeTable).where(eq(reportUserScopeTable.userId, userId)).run();

      normalizeScopeValues(enterpriseScopeIds).forEach((scopeValue) => {
        tx.insert(reportUserScopeTable).values({ userId, scopeType: "enterprise", scopeValue }).run();
      });

      normalizeScopeValues(organizationScopeIds).forEach((scopeValue) => {
        tx.insert(reportUserScopeTable).values({ userId, scopeType: "organization", scopeValue }).run();
      });

      normalizeScopeValues(storeScopeIds).forEach((scopeValue) => {
        tx.insert(reportUserScopeTable).values({ userId, scopeType: "store", scopeValue }).run();
      });

      tx.update(reportUserTable).set({ updatedAt: nowIso() }).where(eq(reportUserTable.id, userId)).run();
    });
  }

  updateUserPassword(userId: number, nextPassword: string): void {
    const normalizedPassword = nextPassword.trim();
    if (!normalizedPassword || normalizedPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    db.update(reportUserTable)
      .set({ passwordHash: hashPassword(normalizedPassword), updatedAt: nowIso() })
      .where(eq(reportUserTable.id, userId))
      .run();
  }

  updateUserStatus(userId: number, status: "active" | "disabled"): void {
    db.update(reportUserTable)
      .set({ status, updatedAt: nowIso() })
      .where(eq(reportUserTable.id, userId))
      .run();
  }

  hasPermission(user: SessionUser | null, permissionCode: PermissionCode): boolean {
    if (!user) {
      return false;
    }
    return user.permissions.includes(permissionCode);
  }

  private findUserById(userId: number): SessionUser | null {
    const rows = db
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
      .where(eq(reportUserTable.id, userId))
      .all() as JoinedUserRow[];

    return mapUsers(rows, loadScopeMap([userId]))[0] ?? null;
  }
}
