import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";

import type { RequestContext } from "@/backend/auth/request-context";
import { db } from "@/backend/database/client";
import {
  organizationMasterTable,
  reportRectificationSyncBatchTable,
  reportRectificationSyncLogTable,
  reportRectificationOrderTable,
  reportTable,
  storeMasterProfileTable
} from "@/backend/database/schema";
import type { RectificationOrderRepository } from "@/backend/rectification/rectification.repository";
import type {
  CreateRectificationSyncBatchInput,
  CreateRectificationSyncLogInput,
  CreateRectificationOrderInput,
  RectificationSyncBatchRecord,
  RectificationSyncDailyStat,
  RectificationOrderFilters,
  RectificationOrderRecord
} from "@/backend/rectification/rectification.types";
import type { JsonValue } from "@/backend/shared/json";

function safeStringify(value: unknown, fallback: unknown): any {
  return JSON.stringify(value ?? fallback);
}

function safeParse<T extends JsonValue>(value: string, fallback: T): any {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toRectificationOrderRecord(
  row: typeof reportRectificationOrderTable.$inferSelect,
  reportRow?: typeof reportTable.$inferSelect | null
): any {
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
    rectification_reply_content: row.rectificationReplyContent,
    last_synced_at: row.lastSyncedAt,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function toRectificationSyncBatchRecord(
  row: typeof reportRectificationSyncBatchTable.$inferSelect
): any {
  return {
    id: row.id,
    sync_batch_id: row.syncBatchId,
    trigger_source: row.triggerSource,
    status: row.status as RectificationSyncBatchRecord["status"],
    scanned_count: row.scannedCount,
    success_count: row.successCount,
    failed_count: row.failedCount,
    not_found_count: row.notFoundCount,
    skipped_count: row.skippedCount,
    average_response_time_ms: row.averageResponseTimeMs,
    max_response_time_ms: row.maxResponseTimeMs,
    config: safeParse(row.configJson, {}),
    summary: safeParse(row.summaryJson, {}),
    started_at: row.startedAt,
    finished_at: row.finishedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function normalizeScopeIds(values?: string[]): any {
  return Array.from(
    new Set(
      (values || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function canAccessEnterprise(context: RequestContext, enterpriseId: string): any {
  const enterpriseScopeIds = normalizeScopeIds(context.enterpriseScopeIds);
  if (enterpriseScopeIds.length === 0) {
    return true;
  }
  return enterpriseScopeIds.includes(enterpriseId);
}

async function resolveScopedStoreIds(context: RequestContext, enterpriseId?: string): Promise<any> {
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

  const organizationRows = (await db
      .select({
        enterpriseId: organizationMasterTable.enterpriseId,
        organizeCode: organizationMasterTable.organizeCode,
        parentCode: organizationMasterTable.parentCode
      })
      .from(organizationMasterTable)
      .where(and(...organizationWhere)))
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
      (await db
                .select({
                  enterpriseId: storeMasterProfileTable.enterpriseId,
                  storeId: storeMasterProfileTable.storeId,
                  organizeCode: storeMasterProfileTable.organizeCode
                })
                .from(storeMasterProfileTable)
                .where(and(...storeWhere)))
        .filter(
          (row) =>
            canAccessEnterprise(context, row.enterpriseId) &&
            allowedOrganizationCodes.has(String(row.organizeCode || "").trim())
        )
        .map((row) => row.storeId)
    )
  );
}

function matchesKeyword(order: RectificationOrderRecord, keyword: string): any {
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

function matchesDateRange(order: RectificationOrderRecord, startDate: string, endDate: string): any {
  const createdDate = String(order.created_at || "").slice(0, 10);
  if (startDate && createdDate < startDate) {
    return false;
  }
  if (endDate && createdDate > endDate) {
    return false;
  }
  return true;
}

export class PgRectificationOrderRepository implements RectificationOrderRepository {
  async create(input: CreateRectificationOrderInput): Promise<any> {
    const now = new Date().toISOString();
    const inserted = (await db
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
            rectificationReplyContent: input.rectification_reply_content ?? null,
            lastSyncedAt: input.last_synced_at ?? null,
            createdBy: input.created_by,
            createdAt: now,
            updatedAt: now
          })
          .returning())[0];
    return toRectificationOrderRecord(inserted);
  }

  async listAll(filters: RectificationOrderFilters = {}, context: RequestContext = {}): Promise<any> {
    const rows = (await db
          .select({
            rectification: reportRectificationOrderTable,
            report: reportTable
          })
          .from(reportRectificationOrderTable)
          .leftJoin(reportTable, eq(reportRectificationOrderTable.reportId, reportTable.id))
          .orderBy(desc(reportRectificationOrderTable.createdAt), desc(reportRectificationOrderTable.id)))
      .map(({ rectification, report }) => toRectificationOrderRecord(rectification, report));
    const scopedStoreIds = await resolveScopedStoreIds(context);

    return rows.filter((order) => {
      const enterpriseId = String(order.source_enterprise_id || "").trim();
      if (enterpriseId && !canAccessEnterprise(context, enterpriseId)) {
        return false;
      }

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

  async queryPage(
    filters: RectificationOrderFilters = {},
    page: number,
    pageSize: number,
    context: RequestContext = {}
  ): Promise<any> {
    const normalizedPageSize = Math.max(1, Math.min(200, Math.trunc(pageSize || 20)));
    const enterpriseScopeIds = normalizeScopeIds(context.enterpriseScopeIds);
    const scopedStoreIds = await resolveScopedStoreIds(context);
    if (scopedStoreIds && scopedStoreIds.length === 0) {
      return {
        page: 1,
        page_size: normalizedPageSize,
        total: 0,
        items: [],
        metrics: {
          corrected_count: 0,
          pending_review_count: 0,
          issued_count: 0
        }
      };
    }

    const whereClauses = [];
    if (enterpriseScopeIds.length > 0) {
      whereClauses.push(inArray(reportTable.sourceEnterpriseId, enterpriseScopeIds));
    }
    if (scopedStoreIds) {
      whereClauses.push(inArray(reportRectificationOrderTable.storeId, scopedStoreIds));
    }
    if (filters.status) {
      whereClauses.push(eq(reportRectificationOrderTable.status, filters.status));
    }
    if (filters.ifCorrected) {
      whereClauses.push(eq(reportRectificationOrderTable.ifCorrected, filters.ifCorrected));
    }
    if (filters.startDate) {
      whereClauses.push(sql`left(${reportRectificationOrderTable.createdAt}, 10) >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      whereClauses.push(sql`left(${reportRectificationOrderTable.createdAt}, 10) <= ${filters.endDate}`);
    }
    if (filters.keyword) {
      const keywordPattern = `%${filters.keyword.toLowerCase()}%`;
      whereClauses.push(
        or(
          ilike(reportRectificationOrderTable.huiYunYingOrderId, keywordPattern),
          ilike(reportRectificationOrderTable.storeCode, keywordPattern),
          ilike(reportRectificationOrderTable.storeName, keywordPattern),
          ilike(reportRectificationOrderTable.storeId, keywordPattern),
          ilike(reportTable.enterpriseName, keywordPattern),
          ilike(reportTable.reportType, keywordPattern),
          ilike(reportTable.reportVersion, keywordPattern),
          ilike(reportRectificationOrderTable.createdBy, keywordPattern),
          sql`${reportRectificationOrderTable.reportId}::text ilike ${keywordPattern}`,
          sql`${reportRectificationOrderTable.resultId}::text ilike ${keywordPattern}`
        )
      );
    }

    const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    const totalRow = (await db
      .select({ count: sql<number>`count(*)` })
      .from(reportRectificationOrderTable)
      .leftJoin(reportTable, eq(reportRectificationOrderTable.reportId, reportTable.id))
      .where(where))[0];
    const total = Number(totalRow?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
    const currentPage = Math.min(Math.max(1, Math.trunc(page || 1)), totalPages);
    const offset = (currentPage - 1) * normalizedPageSize;

    const rows = await db
      .select({
        rectification: reportRectificationOrderTable,
        report: reportTable
      })
      .from(reportRectificationOrderTable)
      .leftJoin(reportTable, eq(reportRectificationOrderTable.reportId, reportTable.id))
      .where(where)
      .orderBy(desc(reportRectificationOrderTable.createdAt), desc(reportRectificationOrderTable.id))
      .limit(normalizedPageSize)
      .offset(offset);

    const metricsRow = (await db
      .select({
        correctedCount: sql<number>`sum(case when (coalesce(${reportRectificationOrderTable.ifCorrected}, '') = '1' or ${reportRectificationOrderTable.status} = 'corrected') then 1 else 0 end)`,
        pendingReviewCount: sql<number>`sum(case when (coalesce(${reportRectificationOrderTable.ifCorrected}, '') = '2' or ${reportRectificationOrderTable.status} = 'pending_review') then 1 else 0 end)`,
        issuedCount: sql<number>`sum(case when (coalesce(${reportRectificationOrderTable.ifCorrected}, '') not in ('1', '2') and ${reportRectificationOrderTable.status} <> 'sync_failed') then 1 else 0 end)`
      })
      .from(reportRectificationOrderTable)
      .leftJoin(reportTable, eq(reportRectificationOrderTable.reportId, reportTable.id))
      .where(where))[0];

    return {
      page: currentPage,
      page_size: normalizedPageSize,
      total,
      items: rows.map(({ rectification, report }) => toRectificationOrderRecord(rectification, report)),
      metrics: {
        corrected_count: Number(metricsRow?.correctedCount || 0),
        pending_review_count: Number(metricsRow?.pendingReviewCount || 0),
        issued_count: Number(metricsRow?.issuedCount || 0)
      }
    };
  }

  async listByResultId(resultId: number): Promise<any> {
    return (await db
          .select()
          .from(reportRectificationOrderTable)
          .where(eq(reportRectificationOrderTable.resultId, resultId))
          .orderBy(desc(reportRectificationOrderTable.createdAt), desc(reportRectificationOrderTable.id)))
      .map((row) => toRectificationOrderRecord(row));
  }

  async listPendingSync(limit = 50): Promise<any> {
    return (await db
          .select()
          .from(reportRectificationOrderTable)
          .where(
            or(
              eq(reportRectificationOrderTable.status, "created"),
              eq(reportRectificationOrderTable.status, "pending_review"),
              eq(reportRectificationOrderTable.status, "sync_failed")
            )
          )
          .orderBy(
            asc(reportRectificationOrderTable.lastSyncedAt),
            asc(reportRectificationOrderTable.updatedAt),
            asc(reportRectificationOrderTable.id)
          )
          .limit(limit))
      .map((row) => toRectificationOrderRecord(row));
  }

  async createSyncBatch(input: CreateRectificationSyncBatchInput): Promise<any> {
    const now = new Date().toISOString();
    const inserted = (await db
          .insert(reportRectificationSyncBatchTable)
          .values({
            syncBatchId: input.sync_batch_id,
            triggerSource: input.trigger_source,
            status: input.status,
            scannedCount: input.scanned_count,
            configJson: safeStringify(input.config, {}),
            summaryJson: safeStringify(input.summary ?? {}, {}),
            startedAt: input.started_at,
            createdAt: now,
            updatedAt: now
          })
          .returning())[0];
    return toRectificationSyncBatchRecord(inserted);
  }

  async finalizeSyncBatch(
    syncBatchId: string,
    patch: Partial<
      Pick<
        RectificationSyncBatchRecord,
        | "status"
        | "success_count"
        | "failed_count"
        | "not_found_count"
        | "skipped_count"
        | "average_response_time_ms"
        | "max_response_time_ms"
        | "summary"
        | "finished_at"
      >
    >
  ): Promise<any> {
    if (!String(syncBatchId || "").trim()) {
      return;
    }

    await db.update(reportRectificationSyncBatchTable)
            .set({
              status: patch.status,
              successCount: patch.success_count,
              failedCount: patch.failed_count,
              notFoundCount: patch.not_found_count,
              skippedCount: patch.skipped_count,
              averageResponseTimeMs:
                patch.average_response_time_ms === undefined ? undefined : patch.average_response_time_ms,
              maxResponseTimeMs: patch.max_response_time_ms === undefined ? undefined : patch.max_response_time_ms,
              summaryJson: patch.summary === undefined ? undefined : safeStringify(patch.summary, {}),
              finishedAt: patch.finished_at === undefined ? undefined : patch.finished_at ?? null,
              updatedAt: new Date().toISOString()
            })
            .where(eq(reportRectificationSyncBatchTable.syncBatchId, syncBatchId));
  }

  async createSyncLog(input: CreateRectificationSyncLogInput): Promise<any> {
    await db.insert(reportRectificationSyncLogTable)
            .values({
              syncBatchId: input.sync_batch_id,
              orderId: input.order_id,
              huiYunYingOrderId: input.huiyunying_order_id ?? null,
              status: input.status,
              errorType: input.error_type ?? null,
              errorMessage: input.error_message || "",
              attemptCount: input.attempt_count,
              responseTimeMs: input.response_time_ms ?? null,
              remoteStatus: input.remote_status ?? null,
              remoteIfCorrected: input.remote_if_corrected ?? null,
              requestPayloadJson: safeStringify(input.request_payload, {}),
              responsePayloadJson: safeStringify(input.response_payload, {}),
              syncedAt: input.synced_at,
              createdAt: input.synced_at
            });
  }

  async listRecentSyncBatches(limit = 10): Promise<any> {
    return (await db
          .select()
          .from(reportRectificationSyncBatchTable)
          .orderBy(desc(reportRectificationSyncBatchTable.startedAt), desc(reportRectificationSyncBatchTable.id))
          .limit(limit))
      .map((row) => toRectificationSyncBatchRecord(row));
  }

  async listDailySyncStats(days = 7): Promise<any> {
    const safeDays = Math.max(1, Math.floor(days));
    const startBoundary = new Date();
    startBoundary.setHours(0, 0, 0, 0);
    startBoundary.setDate(startBoundary.getDate() - safeDays + 1);
    const startIso = startBoundary.toISOString();

    const batches = await db
          .select()
          .from(reportRectificationSyncBatchTable)
          .where(gte(reportRectificationSyncBatchTable.startedAt, startIso));
    const logs = await db
          .select()
          .from(reportRectificationSyncLogTable)
          .where(gte(reportRectificationSyncLogTable.syncedAt, startIso));

    const statsMap = new Map<string, RectificationSyncDailyStat>();

    for (const batch of batches) {
      const syncDate = String(batch.startedAt || "").slice(0, 10);
      if (!syncDate) {
        continue;
      }
      const current = statsMap.get(syncDate) || {
        sync_date: syncDate,
        batch_count: 0,
        scanned_count: 0,
        success_count: 0,
        failed_count: 0,
        not_found_count: 0,
        skipped_count: 0,
        average_response_time_ms: null,
        max_response_time_ms: null
      };
      current.batch_count += 1;
      current.scanned_count += batch.scannedCount;
      statsMap.set(syncDate, current);
    }

    const responseAccumulator = new Map<string, { total: number; count: number; max: number }>();

    for (const log of logs) {
      const syncDate = String(log.syncedAt || "").slice(0, 10);
      if (!syncDate) {
        continue;
      }
      const current = statsMap.get(syncDate) || {
        sync_date: syncDate,
        batch_count: 0,
        scanned_count: 0,
        success_count: 0,
        failed_count: 0,
        not_found_count: 0,
        skipped_count: 0,
        average_response_time_ms: null,
        max_response_time_ms: null
      };

      if (log.status === "success") {
        current.success_count += 1;
      } else if (log.status === "failed") {
        current.failed_count += 1;
      } else if (log.status === "not_found") {
        current.not_found_count += 1;
      } else if (log.status === "skipped") {
        current.skipped_count += 1;
      }

      if (typeof log.responseTimeMs === "number" && Number.isFinite(log.responseTimeMs)) {
        const accumulator = responseAccumulator.get(syncDate) || { total: 0, count: 0, max: 0 };
        accumulator.total += log.responseTimeMs;
        accumulator.count += 1;
        accumulator.max = Math.max(accumulator.max, log.responseTimeMs);
        responseAccumulator.set(syncDate, accumulator);
      }

      statsMap.set(syncDate, current);
    }

    return Array.from(statsMap.values())
      .map((item) => {
        const accumulator = responseAccumulator.get(item.sync_date);
        return {
          ...item,
          average_response_time_ms:
            accumulator && accumulator.count > 0 ? Math.round(accumulator.total / accumulator.count) : null,
          max_response_time_ms: accumulator && accumulator.count > 0 ? accumulator.max : null
        };
      })
      .sort((left, right) => right.sync_date.localeCompare(left.sync_date));
  }

  async attachSourceReviewLog(orderIds: number[], sourceReviewLogId: number): Promise<any> {
    const normalizedOrderIds = Array.from(
      new Set(orderIds.filter((orderId) => Number.isInteger(orderId) && orderId > 0))
    );
    if (!Number.isInteger(sourceReviewLogId) || sourceReviewLogId <= 0 || normalizedOrderIds.length === 0) {
      return;
    }

    await db.update(reportRectificationOrderTable)
            .set({
              sourceReviewLogId,
              updatedAt: new Date().toISOString()
            })
            .where(inArray(reportRectificationOrderTable.id, normalizedOrderIds));
  }

  async updateSyncState(
    orderId: number,
    patch: Partial<
      Pick<
        RectificationOrderRecord,
        | "huiyunying_order_id"
        | "status"
        | "if_corrected"
        | "real_corrected_time"
        | "rectification_reply_content"
        | "last_synced_at"
        | "response_payload"
      >
    >
  ): Promise<any> {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return;
    }

    await db.update(reportRectificationOrderTable)
            .set({
              huiYunYingOrderId:
                patch.huiyunying_order_id === undefined ? undefined : patch.huiyunying_order_id ?? null,
              status: patch.status,
              ifCorrected: patch.if_corrected === undefined ? undefined : patch.if_corrected ?? null,
              realCorrectedTime:
                patch.real_corrected_time === undefined ? undefined : patch.real_corrected_time ?? null,
              rectificationReplyContent:
                patch.rectification_reply_content === undefined ? undefined : patch.rectification_reply_content ?? null,
              lastSyncedAt: patch.last_synced_at === undefined ? undefined : patch.last_synced_at ?? null,
              responsePayloadJson:
                patch.response_payload === undefined ? undefined : safeStringify(patch.response_payload, {}),
              updatedAt: new Date().toISOString()
            })
            .where(eq(reportRectificationOrderTable.id, orderId));
  }
}
