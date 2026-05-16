import { and, asc, desc, eq, notInArray } from "drizzle-orm";

import type { RequestContext } from "@/backend/auth/request-context";
import { db } from "@/backend/database/client";
import {
  masterDataSyncLogTable,
  organizationMasterTable,
  storeMasterProfileTable
} from "@/backend/database/schema";
import type {
  MasterDataEnterpriseSummary,
  MasterDataOrganization,
  MasterDataPublishPayload,
  MasterDataPublishReceipt,
  MasterDataRepository,
  MasterDataStore,
  MasterDataStoreFilters,
  MasterDataSyncLog
} from "@/backend/master-data/master-data.types";

function nowIso(): any {
  return new Date().toISOString();
}

function safeParseJson(text: string): any {
  try {
    const parsed = JSON.parse(text || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeScopeIds(values: string[] | undefined): any {
  return Array.from(new Set((values || []).map((item) => item.trim()).filter(Boolean)));
}

function resolveStoreOrganizeCode(
  explicitCode: string | undefined,
  rawJson: Record<string, unknown>
): any {
  return String(
    explicitCode ||
      rawJson.parentOrgCode ||
      rawJson.organizeCode ||
      ""
  ).trim();
}

function resolveStoreOrganizeName(
  explicitName: string | undefined,
  rawJson: Record<string, unknown>
): any {
  return String(
    explicitName ||
      rawJson.parentOrgName ||
      rawJson.organizeName ||
      ""
  ).trim();
}

function canAccessEnterprise(context: RequestContext, enterpriseId: string): any {
  const enterpriseScopeIds = normalizeScopeIds(context.enterpriseScopeIds);
  if (enterpriseScopeIds.length === 0) {
    return true;
  }
  return enterpriseScopeIds.includes(enterpriseId);
}

function applyOrganizationScope<T extends { organize_code: string }>(rows: T[], context: RequestContext): any {
  const organizationScopeIds = normalizeScopeIds(context.organizationScopeIds);
  if (organizationScopeIds.length === 0) {
    return rows;
  }
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();
  rows.forEach((row) => {
    const parentCode =
      "parent_code" in row && typeof row.parent_code === "string"
        ? row.parent_code
        : "";
    parentMap.set(row.organize_code, parentCode);
    if (!childrenMap.has(parentCode)) {
      childrenMap.set(parentCode, []);
    }
    childrenMap.get(parentCode)?.push(row.organize_code);
  });

  const allowedCodes = new Set<string>();
  const queue = [...organizationScopeIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allowedCodes.has(current)) {
      continue;
    }
    allowedCodes.add(current);
    (childrenMap.get(current) || []).forEach((childCode) => queue.push(childCode));
  }

  return rows.filter((row) => allowedCodes.has(row.organize_code));
}

function applyStoreScope<T extends { store_id: string }>(rows: T[], context: RequestContext): any {
  const storeScopeIds = normalizeScopeIds(context.storeScopeIds);
  if (storeScopeIds.length === 0) {
    return rows;
  }
  return rows.filter((row) => storeScopeIds.includes(row.store_id));
}

async function resolveOrganizationScopeCodes(enterpriseId: string, context: RequestContext): Promise<any> {
  const organizationScopeIds = normalizeScopeIds(context.organizationScopeIds);
  if (organizationScopeIds.length === 0) {
    return null;
  }

  const rows = await db
      .select({
        organizeCode: organizationMasterTable.organizeCode,
        parentCode: organizationMasterTable.parentCode
      })
      .from(organizationMasterTable)
      .where(and(eq(organizationMasterTable.enterpriseId, enterpriseId), eq(organizationMasterTable.isActive, 1)));

  const childrenMap = new Map<string, string[]>();
  rows.forEach((row) => {
    const parentCode = String(row.parentCode || "").trim();
    if (!childrenMap.has(parentCode)) {
      childrenMap.set(parentCode, []);
    }
    childrenMap.get(parentCode)?.push(row.organizeCode);
  });

  const allowedCodes = new Set<string>();
  const queue = [...organizationScopeIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allowedCodes.has(current)) {
      continue;
    }
    allowedCodes.add(current);
    (childrenMap.get(current) || []).forEach((childCode) => queue.push(childCode));
  }

  return allowedCodes;
}

function toOrganizationTree(rows: Array<typeof organizationMasterTable.$inferSelect>): any {
  const nodeMap = new Map<string, MasterDataOrganization>();
  const order: string[] = [];

  rows.forEach((row) => {
    const rawJson = safeParseJson(row.rawJson);
    nodeMap.set(row.organizeCode, {
      organize_code: row.organizeCode,
      organize_name: row.organizeName,
      parent_code: row.parentCode,
      level: row.level,
      is_active: Boolean(row.isActive),
      current_store_count: Number(rawJson.currentStoreCount || 0),
      raw_json: rawJson,
      child: []
    });
    order.push(row.organizeCode);
  });

  const roots: MasterDataOrganization[] = [];
  order.forEach((code) => {
    const node = nodeMap.get(code);
    if (!node) {
      return;
    }
    if (node.parent_code && nodeMap.has(node.parent_code)) {
      nodeMap.get(node.parent_code)?.child.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export class PgMasterDataRepository implements MasterDataRepository {
  async publishSnapshot(payload: MasterDataPublishPayload, _context: RequestContext = {}): Promise<any> {
    const receivedAt = nowIso();
    const existing = (await db
          .select()
          .from(masterDataSyncLogTable)
          .where(eq(masterDataSyncLogTable.idempotencyKey, payload.idempotency_key)))[0];

    if (existing) {
      return {
        ok: true,
        action: "duplicate",
        syncBatchId: existing.syncBatchId,
        enterpriseId: existing.enterpriseId,
        snapshotVersion: existing.snapshotVersion,
        organizeCount: existing.organizeCount,
        storeCount: existing.storeCount,
        receivedAt
      };
    }

    const syncBatchId = `md-${Date.now()}`;
    const enterpriseId = payload.enterprise.enterprise_id.trim();
    const enterpriseName = payload.enterprise.enterprise_name.trim();
    const snapshotVersion = payload.snapshot_meta.snapshot_version.trim();
    const updatedAt = receivedAt;
    const organizationCodes = payload.organizations.map((item) => item.organize_code.trim()).filter(Boolean);
    const storeIds = payload.stores.map((item) => item.store_id.trim()).filter(Boolean);

    return await db.transaction(async (tx): Promise<any> => {
      for (const item of payload.organizations) {
        await tx
                    .insert(organizationMasterTable)
                    .values({
                      enterpriseId,
                      enterpriseName,
                      organizeCode: item.organize_code.trim(),
                      organizeName: item.organize_name.trim(),
                      parentCode: item.parent_code?.trim() || "",
                      level: item.level ?? 0,
                      rawJson: JSON.stringify(item.raw_json ?? {}),
                      isActive: 1,
                      snapshotVersion,
                      updatedAt
                    })
                    .onConflictDoUpdate({
                      target: [organizationMasterTable.enterpriseId, organizationMasterTable.organizeCode],
                      set: {
                        enterpriseName,
                        organizeName: item.organize_name.trim(),
                        parentCode: item.parent_code?.trim() || "",
                        level: item.level ?? 0,
                        rawJson: JSON.stringify(item.raw_json ?? {}),
                        isActive: 1,
                        snapshotVersion,
                        updatedAt
                      }
                    });
      }

      if (organizationCodes.length > 0) {
        await tx
                    .update(organizationMasterTable)
                    .set({ isActive: 0, snapshotVersion, updatedAt })
                    .where(
                      and(
                        eq(organizationMasterTable.enterpriseId, enterpriseId),
                        notInArray(organizationMasterTable.organizeCode, organizationCodes)
                      )
                    );
      } else {
        await tx
                    .update(organizationMasterTable)
                    .set({ isActive: 0, snapshotVersion, updatedAt })
                    .where(eq(organizationMasterTable.enterpriseId, enterpriseId));
      }

      for (const item of payload.stores) {
        const rawJson = item.raw_json ?? {};
        const organizeCode = resolveStoreOrganizeCode(item.organize_code, rawJson);
        const organizeName = resolveStoreOrganizeName(item.organize_name, rawJson);
        await tx
                    .insert(storeMasterProfileTable)
                    .values({
                      enterpriseId,
                      enterpriseName,
                      storeId: item.store_id.trim(),
                      storeCode: item.store_code?.trim() || "",
                      storeName: item.store_name.trim(),
                      organizeCode,
                      organizeName,
                      storeType: item.store_type?.trim() || "",
                      franchiseeName: item.franchisee_name?.trim() || "",
                      supervisor: item.supervisor?.trim() || "",
                      status: item.status?.trim() || "",
                      rawJson: JSON.stringify(rawJson),
                      isActive: 1,
                      snapshotVersion,
                      updatedAt
                    })
                    .onConflictDoUpdate({
                      target: [storeMasterProfileTable.enterpriseId, storeMasterProfileTable.storeId],
                      set: {
                        enterpriseName,
                        storeCode: item.store_code?.trim() || "",
                        storeName: item.store_name.trim(),
                        organizeCode,
                        organizeName,
                        storeType: item.store_type?.trim() || "",
                        franchiseeName: item.franchisee_name?.trim() || "",
                        supervisor: item.supervisor?.trim() || "",
                        status: item.status?.trim() || "",
                        rawJson: JSON.stringify(rawJson),
                        isActive: 1,
                        snapshotVersion,
                        updatedAt
                      }
                    });
      }

      if (storeIds.length > 0) {
        await tx
                    .update(storeMasterProfileTable)
                    .set({ isActive: 0, snapshotVersion, updatedAt })
                    .where(and(eq(storeMasterProfileTable.enterpriseId, enterpriseId), notInArray(storeMasterProfileTable.storeId, storeIds)));
      } else {
        await tx
                    .update(storeMasterProfileTable)
                    .set({ isActive: 0, snapshotVersion, updatedAt })
                    .where(eq(storeMasterProfileTable.enterpriseId, enterpriseId));
      }

      await tx.insert(masterDataSyncLogTable)
                .values({
                  syncBatchId,
                  idempotencyKey: payload.idempotency_key.trim(),
                  sourceSystem: payload.source_system.trim(),
                  enterpriseId,
                  enterpriseName,
                  dataType: payload.data_type,
                  snapshotVersion,
                  snapshotMode: payload.snapshot_mode,
                  organizeCount: payload.snapshot_meta.organize_count,
                  storeCount: payload.snapshot_meta.store_count,
                  status: "published",
                  requestPayloadJson: JSON.stringify(payload),
                  errorMessage: "",
                  publishedAt: payload.published_at.trim(),
                  createdAt: updatedAt,
                  updatedAt
                });
      return {
        ok: true,
        action: "created",
        syncBatchId,
        enterpriseId,
        snapshotVersion,
        organizeCount: payload.snapshot_meta.organize_count,
        storeCount: payload.snapshot_meta.store_count,
        receivedAt
      };
    });
  }

  async listEnterprises(context: RequestContext = {}): Promise<any> {
    const rows = await db
          .select()
          .from(masterDataSyncLogTable)
          .orderBy(desc(masterDataSyncLogTable.createdAt));

    const summaryMap = new Map<string, MasterDataEnterpriseSummary>();
    rows.forEach((row) => {
      if (!canAccessEnterprise(context, row.enterpriseId) || summaryMap.has(row.enterpriseId)) {
        return;
      }
      summaryMap.set(row.enterpriseId, {
        enterprise_id: row.enterpriseId,
        enterprise_name: row.enterpriseName,
        latest_snapshot_version: row.snapshotVersion,
        latest_published_at: row.publishedAt,
        organize_count: row.organizeCount,
        store_count: row.storeCount
      });
    });

    return Array.from(summaryMap.values());
  }

  async listOrganizations(enterpriseId: string, context: RequestContext = {}): Promise<any> {
    if (!enterpriseId || !canAccessEnterprise(context, enterpriseId)) {
      return [];
    }
    const rows = await db
          .select()
          .from(organizationMasterTable)
          .where(and(eq(organizationMasterTable.enterpriseId, enterpriseId), eq(organizationMasterTable.isActive, 1)))
          .orderBy(asc(organizationMasterTable.level), asc(organizationMasterTable.organizeName));
    const scopedRows = applyOrganizationScope(
      rows.map((row) => ({
        organize_code: row.organizeCode,
        organize_name: row.organizeName,
        parent_code: row.parentCode,
        level: row.level,
        is_active: Boolean(row.isActive),
        current_store_count: Number(safeParseJson(row.rawJson).currentStoreCount || 0),
        raw_json: safeParseJson(row.rawJson)
      })),
      context
    );
    if (scopedRows.length === rows.length) {
      return toOrganizationTree(rows);
    }
    return toOrganizationTree(
      rows.filter((row) => scopedRows.some((item) => item.organize_code === row.organizeCode))
    );
  }

  async listStores(filters: MasterDataStoreFilters, context: RequestContext = {}): Promise<any> {
    if (!filters.enterpriseId || !canAccessEnterprise(context, filters.enterpriseId)) {
      return [];
    }
    const where = [eq(storeMasterProfileTable.enterpriseId, filters.enterpriseId), eq(storeMasterProfileTable.isActive, 1)];
    if (filters.status) {
      where.push(eq(storeMasterProfileTable.status, filters.status));
    }
    let rows = (await db
          .select()
          .from(storeMasterProfileTable)
          .where(and(...where))
          .orderBy(asc(storeMasterProfileTable.organizeName), asc(storeMasterProfileTable.storeName)))
      .map(
        (row): any => {
          const rawJson = safeParseJson(row.rawJson);
          const organizeCode = resolveStoreOrganizeCode(row.organizeCode, rawJson);
          const organizeName = resolveStoreOrganizeName(row.organizeName, rawJson);
          return {
            store_id: row.storeId,
            store_code: row.storeCode,
            store_name: row.storeName,
            organize_code: organizeCode,
            organize_name: organizeName,
            store_type: row.storeType,
            franchisee_name: row.franchiseeName,
            supervisor: row.supervisor,
            status: row.status,
            is_active: Boolean(row.isActive),
            snapshot_version: row.snapshotVersion,
            employee_name: String(rawJson.employeeName || rawJson.supervisorName || row.supervisor || ""),
            employee_code: String(rawJson.employeeCode || ""),
            emp_count: Number(rawJson.empCount || 0),
            business_status: String(rawJson.businessStatus || ""),
            food_status: String(rawJson.foodStatus || ""),
            store_address: String(rawJson.storeAddress || ""),
            raw_json: rawJson
          };
        }
      );

    const allowedOrganizationCodes = await resolveOrganizationScopeCodes(filters.enterpriseId, context);
    if (allowedOrganizationCodes) {
      rows = rows.filter((row) => allowedOrganizationCodes.has(row.organize_code));
    }
    rows = applyStoreScope(rows, context);
    if (filters.organizeCode) {
      rows = rows.filter((row) => row.organize_code === filters.organizeCode);
    }
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      rows = rows.filter((row) => row.store_name.toLowerCase().includes(keyword) || row.store_code.toLowerCase().includes(keyword));
    }
    return rows;
  }

  async listSyncLogs(enterpriseId: string, limit = 10, context: RequestContext = {}): Promise<any> {
    if (!enterpriseId || !canAccessEnterprise(context, enterpriseId)) {
      return [];
    }
    return (await db
          .select()
          .from(masterDataSyncLogTable)
          .where(eq(masterDataSyncLogTable.enterpriseId, enterpriseId))
          .orderBy(desc(masterDataSyncLogTable.createdAt))
          .limit(Math.max(1, limit)))
      .map((row) => ({
        sync_batch_id: row.syncBatchId,
        idempotency_key: row.idempotencyKey,
        enterprise_id: row.enterpriseId,
        enterprise_name: row.enterpriseName,
        snapshot_version: row.snapshotVersion,
        organize_count: row.organizeCount,
        store_count: row.storeCount,
        status: row.status,
        published_at: row.publishedAt,
        created_at: row.createdAt
      }));
  }
}
