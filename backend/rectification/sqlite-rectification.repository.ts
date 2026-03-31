import { and, desc, eq, inArray, or } from "drizzle-orm";

import type { RequestContext } from "@/backend/auth/request-context";
import { db } from "@/backend/database/client";
import {
  organizationMasterTable,
  reportRectificationOrderTable,
  reportTable,
  storeMasterProfileTable
} from "@/backend/database/schema";
import type { RectificationOrderRepository } from "@/backend/rectification/rectification.repository";
import type {
  CreateRectificationOrderInput,
  RectificationOrderFilters,
  RectificationOrderRecord
} from "@/backend/rectification/rectification.types";
import type { JsonValue } from "@/backend/shared/json";

function safeStringify(value: unknown, fallback: unknown): string {
  return JSON.stringify(value ?? fallback);
}

function safeParse<T extends JsonValue>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toRectificationOrderRecord(
  row: typeof reportRectificationOrderTable.$inferSelect,
  reportRow?: typeof reportTable.$inferSelect | null
): RectificationOrderRecord {
  return {
    id: row.id,
    report_id: row.reportId,
    result_id: row.resultId,
    source_enterprise_id: reportRow?.sourceEnterpriseId ?? null,
    enterprise_name: reportRow?.enterpriseName ?? null,
    report_type: reportRow?.reportType ?? null,
    report_version: reportRow?.reportVersion ?? null,
    published_at: reportRow?.publishedAt ?? null,
    source_review_log_id: row.sourceReviewLogId,
    store_id: row.storeId,
    store_code: row.storeCode,
    store_name: row.storeName,
    huiyunying_order_id: row.huiYunYingOrderId,
    request_description: row.requestDescription,
    selected_issues: safeParse(row.selectedIssuesJson, []),
    image_urls: safeParse(row.imageUrlsJson, []),
    request_payload: safeParse(row.requestPayloadJson, {}),
    response_payload: safeParse(row.responsePayloadJson, {}),
    status: row.status as RectificationOrderRecord["status"],
    if_corrected: row.ifCorrected,
    should_corrected: row.shouldCorrected,
    real_corrected_time: row.realCorrectedTime,
    last_synced_at: row.lastSyncedAt,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function normalizeScopeIds(values?: string[]): string[] {
  return Array.from(
    new Set(
      (values || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function canAccessEnterprise(context: RequestContext, enterpriseId: string): boolean {
  const enterpriseScopeIds = normalizeScopeIds(context.enterpriseScopeIds);
  if (enterpriseScopeIds.length === 0) {
    return true;
  }
  return enterpriseScopeIds.includes(enterpriseId);
}

function resolveScopedStoreIds(context: RequestContext, enterpriseId?: string): string[] | null {
  const storeScopeIds = normalizeScopeIds(context.storeScopeIds);
  if (storeScopeIds.length > 0) {
    return storeScopeIds;
  }

  const organizationScopeIds = normalizeScopeIds(context.organizationScopeIds);
  if (organizationScopeIds.length === 0) {
    return null;
  }

  const organizationWhere = [eq(organizationMasterTable.isActive, 1)];
  if (enterpriseId) {
    organizationWhere.push(eq(organizationMasterTable.enterpriseId, enterpriseId));
  }

  const organizationRows = db
    .select({
      enterpriseId: organizationMasterTable.enterpriseId,
      organizeCode: organizationMasterTable.organizeCode,
      parentCode: organizationMasterTable.parentCode
    })
    .from(organizationMasterTable)
    .where(and(...organizationWhere))
    .all()
    .filter((row) => canAccessEnterprise(context, row.enterpriseId));

  const childrenMap = new Map<string, string[]>();
  organizationRows.forEach((row) => {
    const parentCode = String(row.parentCode || "").trim();
    if (!childrenMap.has(parentCode)) {
      childrenMap.set(parentCode, []);
    }
    childrenMap.get(parentCode)?.push(row.organizeCode);
  });

  const allowedOrganizationCodes = new Set<string>();
  const queue = [...organizationScopeIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allowedOrganizationCodes.has(current)) {
      continue;
    }
    allowedOrganizationCodes.add(current);
    (childrenMap.get(current) || []).forEach((childCode) => queue.push(childCode));
  }

  if (allowedOrganizationCodes.size === 0) {
    return [];
  }

  const storeWhere = [eq(storeMasterProfileTable.isActive, 1)];
  if (enterpriseId) {
    storeWhere.push(eq(storeMasterProfileTable.enterpriseId, enterpriseId));
  }

  return Array.from(
    new Set(
      db
        .select({
          enterpriseId: storeMasterProfileTable.enterpriseId,
          storeId: storeMasterProfileTable.storeId,
          organizeCode: storeMasterProfileTable.organizeCode
        })
        .from(storeMasterProfileTable)
        .where(and(...storeWhere))
        .all()
        .filter(
          (row) =>
            canAccessEnterprise(context, row.enterpriseId) &&
            allowedOrganizationCodes.has(String(row.organizeCode || "").trim())
        )
        .map((row) => row.storeId)
    )
  );
}

function matchesKeyword(order: RectificationOrderRecord, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }
  return [
    order.huiyunying_order_id,
    order.store_code,
    order.store_name,
    order.store_id,
    order.enterprise_name,
    order.report_type,
    order.report_version,
    String(order.report_id),
    String(order.result_id),
    order.created_by
  ]
    .map((value) => String(value || "").toLowerCase())
    .some((value) => value.includes(normalizedKeyword));
}

function matchesDateRange(order: RectificationOrderRecord, startDate: string, endDate: string): boolean {
  const createdDate = String(order.created_at || "").slice(0, 10);
  if (startDate && createdDate < startDate) {
    return false;
  }
  if (endDate && createdDate > endDate) {
    return false;
  }
  return true;
}

export class SqliteRectificationOrderRepository implements RectificationOrderRepository {
  create(input: CreateRectificationOrderInput): RectificationOrderRecord {
    const now = new Date().toISOString();
    const inserted = db
      .insert(reportRectificationOrderTable)
      .values({
        reportId: input.report_id,
        resultId: input.result_id,
        sourceReviewLogId: input.source_review_log_id ?? null,
        storeId: input.store_id ?? null,
        storeCode: input.store_code ?? null,
        storeName: input.store_name ?? null,
        huiYunYingOrderId: input.huiyunying_order_id ?? null,
        requestDescription: input.request_description,
        selectedIssuesJson: safeStringify(input.selected_issues, []),
        imageUrlsJson: safeStringify(input.image_urls, []),
        requestPayloadJson: safeStringify(input.request_payload, {}),
        responsePayloadJson: safeStringify(input.response_payload, {}),
        status: input.status,
        ifCorrected: input.if_corrected ?? null,
        shouldCorrected: input.should_corrected ?? null,
        realCorrectedTime: input.real_corrected_time ?? null,
        lastSyncedAt: input.last_synced_at ?? null,
        createdBy: input.created_by,
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .get();
    return toRectificationOrderRecord(inserted);
  }

  listAll(filters: RectificationOrderFilters = {}, context: RequestContext = {}): RectificationOrderRecord[] {
    const rows = db
      .select({
        rectification: reportRectificationOrderTable,
        report: reportTable
      })
      .from(reportRectificationOrderTable)
      .leftJoin(reportTable, eq(reportRectificationOrderTable.reportId, reportTable.id))
      .orderBy(desc(reportRectificationOrderTable.createdAt), desc(reportRectificationOrderTable.id))
      .all()
      .map(({ rectification, report }) => toRectificationOrderRecord(rectification, report));

    return rows.filter((order) => {
      const enterpriseId = String(order.source_enterprise_id || "").trim();
      if (enterpriseId && !canAccessEnterprise(context, enterpriseId)) {
        return false;
      }

      const scopedStoreIds = resolveScopedStoreIds(context, enterpriseId || undefined);
      if (scopedStoreIds && !scopedStoreIds.includes(String(order.store_id || "").trim())) {
        return false;
      }

      if (filters.status && order.status !== filters.status) {
        return false;
      }
      if (filters.ifCorrected && String(order.if_corrected || "") !== filters.ifCorrected) {
        return false;
      }
      if (!matchesDateRange(order, String(filters.startDate || ""), String(filters.endDate || ""))) {
        return false;
      }
      if (!matchesKeyword(order, String(filters.keyword || ""))) {
        return false;
      }
      return true;
    });
  }

  listByResultId(resultId: number): RectificationOrderRecord[] {
    return db
      .select()
      .from(reportRectificationOrderTable)
      .where(eq(reportRectificationOrderTable.resultId, resultId))
      .orderBy(desc(reportRectificationOrderTable.createdAt), desc(reportRectificationOrderTable.id))
      .all()
      .map((row) => toRectificationOrderRecord(row));
  }

  listPendingSync(limit = 50): RectificationOrderRecord[] {
    return db
      .select()
      .from(reportRectificationOrderTable)
      .where(
        or(
          eq(reportRectificationOrderTable.status, "created"),
          eq(reportRectificationOrderTable.status, "pending_review")
        )
      )
      .orderBy(desc(reportRectificationOrderTable.updatedAt), desc(reportRectificationOrderTable.id))
      .limit(limit)
      .all()
      .map((row) => toRectificationOrderRecord(row));
  }

  attachSourceReviewLog(orderIds: number[], sourceReviewLogId: number): void {
    const normalizedOrderIds = Array.from(
      new Set(orderIds.filter((orderId) => Number.isInteger(orderId) && orderId > 0))
    );
    if (!Number.isInteger(sourceReviewLogId) || sourceReviewLogId <= 0 || normalizedOrderIds.length === 0) {
      return;
    }

    db.update(reportRectificationOrderTable)
      .set({
        sourceReviewLogId,
        updatedAt: new Date().toISOString()
      })
      .where(inArray(reportRectificationOrderTable.id, normalizedOrderIds))
      .run();
  }

  updateSyncState(
    orderId: number,
    patch: Partial<
      Pick<
        RectificationOrderRecord,
        "huiyunying_order_id" | "status" | "if_corrected" | "real_corrected_time" | "last_synced_at" | "response_payload"
      >
    >
  ): void {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return;
    }

    db.update(reportRectificationOrderTable)
      .set({
        huiYunYingOrderId:
          patch.huiyunying_order_id === undefined ? undefined : patch.huiyunying_order_id ?? null,
        status: patch.status,
        ifCorrected: patch.if_corrected === undefined ? undefined : patch.if_corrected ?? null,
        realCorrectedTime:
          patch.real_corrected_time === undefined ? undefined : patch.real_corrected_time ?? null,
        lastSyncedAt: patch.last_synced_at === undefined ? undefined : patch.last_synced_at ?? null,
        responsePayloadJson:
          patch.response_payload === undefined ? undefined : safeStringify(patch.response_payload, {}),
        updatedAt: new Date().toISOString()
      })
      .where(eq(reportRectificationOrderTable.id, orderId))
      .run();
  }
}
