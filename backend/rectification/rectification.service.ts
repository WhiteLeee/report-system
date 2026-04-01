import { randomUUID } from "node:crypto";

import type { RequestContext } from "@/backend/auth/request-context";
import { createHuiYunYingRectificationService } from "@/backend/integrations/huiyunying/huiyunying.module";
import type {
  HuiYunYingCreateRectificationInput,
  HuiYunYingListRectificationInput,
  HuiYunYingRectificationOrderItem
} from "@/backend/integrations/huiyunying/huiyunying.types";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import type { ReviewSelectedIssue } from "@/backend/report/report.types";
import {
  buildRectificationSyncPatch,
  isRemoteRectificationSnapshotUnchanged
} from "@/backend/rectification/rectification-sync";
import type {
  CreateRectificationOrderInput,
  RectificationSyncBatchRecord,
  RectificationSyncDashboard,
  RectificationSyncLogStatus,
  RectificationOrderFilters,
  RectificationOrderRecord
} from "@/backend/rectification/rectification.types";
import type { RectificationOrderRepository } from "@/backend/rectification/rectification.repository";
import type { JsonValue } from "@/backend/shared/json";
import { buildRectificationPreviewOrders, RectificationPreviewError } from "@/lib/rectification-preview";

export class RectificationSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RectificationSplitError";
  }
}

type CreateOrdersInput = {
  reportId: number;
  resultId: number;
  storeId?: string | null;
  storeCode?: string | null;
  storeName?: string | null;
  imageUrls: string[];
  selectedIssues: ReviewSelectedIssue[];
  shouldCorrected: string;
  note: string;
  createdBy: string;
  context?: RequestContext;
};

type SyncTriggerSource = "scheduler" | "detail_view";

type SyncExecutionResult = {
  status: RectificationSyncLogStatus;
  orderId: number;
  huiYunYingOrderId: string | null;
  remoteStatus: RectificationOrderRecord["status"] | null;
  remoteIfCorrected: string | null;
  requestPayload: JsonValue;
  responsePayload: JsonValue;
  responseTimeMs: number | null;
  attemptCount: number;
  errorType: string | null;
  errorMessage: string;
};

function formatDateOnly(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export class RectificationService {
  constructor(private readonly repository: RectificationOrderRepository) {}

  private buildSyncRequest(order: RectificationOrderRecord): HuiYunYingListRectificationInput {
    const today = formatDateOnly(new Date());
    const createdDate = formatDateOnly(order.created_at) || today;
    return {
      searchName: order.store_code || order.store_name || order.store_id || "",
      pageNumber: 1,
      pageSize: 50,
      startDate: createdDate,
      endDate: today,
      modifyStartDate: createdDate,
      modifyEndDate: today
    };
  }

  private findMatchedRemoteOrder(
    order: RectificationOrderRecord,
    items: HuiYunYingRectificationOrderItem[]
  ): HuiYunYingRectificationOrderItem | null {
    return (
      items.find((item) => String(item.disqualifiedId || "").trim() === String(order.huiyunying_order_id || "").trim()) ||
      items.find(
        (item) =>
          String(item.storeCode || "").trim() === String(order.store_code || "").trim() &&
          String(item.description || "").trim() === order.request_description
      ) ||
      null
    );
  }

  private async executeSyncAttempt(order: RectificationOrderRecord): Promise<SyncExecutionResult> {
    const startedAt = Date.now();
    const requestPayload = this.buildSyncRequest(order);
    const huiYunYingService = createHuiYunYingRectificationService();
    const items = await huiYunYingService.listRectificationOrders(requestPayload);
    const responseTimeMs = Math.max(0, Date.now() - startedAt);
    const matched = this.findMatchedRemoteOrder(order, items);
    const syncedAt = new Date().toISOString();

    if (!matched) {
      this.repository.updateSyncState(order.id, {
        last_synced_at: syncedAt,
        response_payload: {
          status: "not_found",
          items_count: items.length,
          request: requestPayload as unknown as JsonValue
        }
      });
      return {
        status: "not_found",
        orderId: order.id,
        huiYunYingOrderId: order.huiyunying_order_id,
        remoteStatus: order.status,
        remoteIfCorrected: order.if_corrected,
        requestPayload: requestPayload as unknown as JsonValue,
        responsePayload: {
          status: "not_found",
          items_count: items.length
        },
        responseTimeMs,
        attemptCount: 1,
        errorType: null,
        errorMessage: ""
      };
    }

    const patch = buildRectificationSyncPatch(order, matched);
    const nextSyncedAt = new Date().toISOString();
    const unchanged = isRemoteRectificationSnapshotUnchanged(order, matched);

    this.repository.updateSyncState(order.id, {
      ...(unchanged ? {} : patch),
      last_synced_at: nextSyncedAt
    });

    return {
      status: unchanged ? "skipped" : "success",
      orderId: order.id,
      huiYunYingOrderId: patch.huiyunying_order_id,
      remoteStatus: patch.status,
      remoteIfCorrected: patch.if_corrected,
      requestPayload: requestPayload as unknown as JsonValue,
      responsePayload: patch.response_payload,
      responseTimeMs,
      attemptCount: 1,
      errorType: null,
      errorMessage: ""
    };
  }

  private async syncOrderWithRetry(
    order: RectificationOrderRecord,
    retryCount: number
  ): Promise<SyncExecutionResult> {
    let lastError: unknown = null;
    let lastResponseTimeMs: number | null = null;

    for (let attemptIndex = 0; attemptIndex <= retryCount; attemptIndex += 1) {
      try {
        const result = await this.executeSyncAttempt(order);
        return {
          ...result,
          attemptCount: attemptIndex + 1
        };
      } catch (error) {
        lastError = error;
        lastResponseTimeMs = lastResponseTimeMs ?? 0;
        if (attemptIndex === retryCount) {
          break;
        }
      }
    }

    const syncedAt = new Date().toISOString();
    const errorMessage = lastError instanceof Error ? lastError.message : "未知同步异常";
    const errorType =
      lastError instanceof Error && lastError.name ? lastError.name : typeof lastError === "string" ? "Error" : "UnknownError";

    this.repository.updateSyncState(order.id, {
      status: "sync_failed",
      last_synced_at: syncedAt
    });

    return {
      status: "failed",
      orderId: order.id,
      huiYunYingOrderId: order.huiyunying_order_id,
      remoteStatus: null,
      remoteIfCorrected: null,
      requestPayload: this.buildSyncRequest(order) as unknown as JsonValue,
      responsePayload: {
        error_type: errorType,
        error_message: errorMessage
      },
      responseTimeMs: lastResponseTimeMs,
      attemptCount: retryCount + 1,
      errorType,
      errorMessage
    };
  }

  private logSyncBatchStart(batchId: string, triggerSource: SyncTriggerSource, scannedCount: number): void {
    console.info(
      `[rectification-sync][batch:start] ${JSON.stringify({
        sync_batch_id: batchId,
        trigger_source: triggerSource,
        scanned_count: scannedCount,
        started_at: new Date().toISOString()
      })}`
    );
  }

  private logSyncBatchResult(batch: RectificationSyncBatchRecord): void {
    console.info(
      `[rectification-sync][batch:finish] ${JSON.stringify({
        sync_batch_id: batch.sync_batch_id,
        status: batch.status,
        scanned_count: batch.scanned_count,
        success_count: batch.success_count,
        failed_count: batch.failed_count,
        not_found_count: batch.not_found_count,
        skipped_count: batch.skipped_count,
        average_response_time_ms: batch.average_response_time_ms,
        max_response_time_ms: batch.max_response_time_ms,
        started_at: batch.started_at,
        finished_at: batch.finished_at
      })}`
    );
  }

  async createOrdersForReview(input: CreateOrdersInput): Promise<RectificationOrderRecord[]> {
    const settings = createSystemSettingsService().getHuiYunYingApiSettings();
    const huiYunYingService = createHuiYunYingRectificationService();
    const normalizedImageUrls = Array.from(
      new Set(input.imageUrls.map((url) => String(url || "").trim()).filter(Boolean))
    ).slice(0, 9);
    let previewOrders;
    try {
      previewOrders = buildRectificationPreviewOrders({
        selectedIssues: input.selectedIssues,
        note: input.note,
        shouldCorrected: input.shouldCorrected,
        imageUrls: normalizedImageUrls,
        maxLength: settings.rectificationDescriptionMaxLength
      });
    } catch (error) {
      if (error instanceof RectificationPreviewError) {
        throw new RectificationSplitError(error.message);
      }
      throw error;
    }
    const createdOrders: RectificationOrderRecord[] = [];

    for (const previewOrder of previewOrders) {
      const description = previewOrder.description;
      const remotePayload: HuiYunYingCreateRectificationInput = {
        storeCode: input.storeCode || undefined,
        description,
        shouldCorrected: input.shouldCorrected,
        imageUrls: normalizedImageUrls
      };

      if (input.storeId && /^\d+$/.test(String(input.storeId))) {
        remotePayload.storeId = Number(input.storeId);
      }

      const remoteResponse = await huiYunYingService.createRectificationOrder(remotePayload);
      const remoteOrderId = (() => {
        if (!remoteResponse || typeof remoteResponse !== "object" || Array.isArray(remoteResponse)) {
          return "";
        }
        const candidate = (remoteResponse as Record<string, unknown>).disqualifiedId
          ?? (remoteResponse as Record<string, unknown>).itemId
          ?? (remoteResponse as Record<string, unknown>).id
          ?? ((remoteResponse as Record<string, unknown>).data as Record<string, unknown> | undefined)?.disqualifiedId;
        return String(candidate || "").trim();
      })();

      createdOrders.push(
        this.repository.create({
          report_id: input.reportId,
          result_id: input.resultId,
          store_id: input.storeId ?? null,
          store_code: input.storeCode ?? null,
          store_name: input.storeName ?? null,
          huiyunying_order_id: remoteOrderId || null,
          request_description: description,
          selected_issues: previewOrder.selectedIssues,
          image_urls: normalizedImageUrls,
          request_payload: remotePayload as unknown as JsonValue,
          response_payload: remoteResponse as JsonValue,
          status: "created",
          should_corrected: input.shouldCorrected,
          rectification_reply_content: null,
          last_synced_at: new Date().toISOString(),
          created_by: input.createdBy
        })
      );
    }

    return createdOrders;
  }

  attachReviewLog(orderIds: number[], reviewLogId: number): void {
    this.repository.attachSourceReviewLog(orderIds, reviewLogId);
  }

  listOrders(filters: RectificationOrderFilters, context?: RequestContext): RectificationOrderRecord[] {
    return this.repository.listAll(filters, context);
  }

  listByResultId(resultId: number): RectificationOrderRecord[] {
    return this.repository.listByResultId(resultId);
  }

  getSyncDashboard(days = 7, recentBatchLimit = 10): RectificationSyncDashboard {
    return {
      recent_batches: this.repository.listRecentSyncBatches(recentBatchLimit),
      daily_stats: this.repository.listDailySyncStats(days)
    };
  }

  async syncOrderStatus(order: RectificationOrderRecord): Promise<RectificationOrderRecord> {
    const settings = createSystemSettingsService().getHuiYunYingApiSettings();
    await this.syncOrderWithRetry(order, settings.rectificationSyncRetryCount);
    return this.repository.listByResultId(order.result_id).find((item) => item.id === order.id) || order;
  }

  async syncOrdersByResultId(resultId: number): Promise<RectificationOrderRecord[]> {
    const orders = this.repository.listByResultId(resultId);
    for (const order of orders) {
      if (order.status === "corrected") {
        continue;
      }
      await this.syncOrderStatus(order);
    }
    return this.repository.listByResultId(resultId);
  }

  async syncPendingOrders(limit?: number, triggerSource: SyncTriggerSource = "scheduler"): Promise<RectificationSyncBatchRecord> {
    const settings = createSystemSettingsService().getHuiYunYingApiSettings();
    const batchLimit = limit ?? settings.rectificationSyncBatchSize;
    const orders = this.repository.listPendingSync(batchLimit);
    const syncBatchId = `rectification-sync-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    this.logSyncBatchStart(syncBatchId, triggerSource, orders.length);
    const batch = this.repository.createSyncBatch({
      sync_batch_id: syncBatchId,
      trigger_source: triggerSource,
      status: "running",
      scanned_count: orders.length,
      config: {
        batch_size: batchLimit,
        retry_count: settings.rectificationSyncRetryCount,
        timeout_ms: settings.rectificationSyncTimeoutMs,
        interval_ms: settings.rectificationSyncIntervalMs
      },
      started_at: startedAt
    });

    let successCount = 0;
    let failedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;
    let responseTimeTotal = 0;
    let responseTimeCount = 0;
    let responseTimeMax = 0;

    for (const order of orders) {
      const result = await this.syncOrderWithRetry(order, settings.rectificationSyncRetryCount);
      this.repository.createSyncLog({
        sync_batch_id: syncBatchId,
        order_id: result.orderId,
        huiyunying_order_id: result.huiYunYingOrderId,
        status: result.status,
        error_type: result.errorType,
        error_message: result.errorMessage,
        attempt_count: result.attemptCount,
        response_time_ms: result.responseTimeMs,
        remote_status: result.remoteStatus,
        remote_if_corrected: result.remoteIfCorrected,
        request_payload: result.requestPayload,
        response_payload: result.responsePayload,
        synced_at: new Date().toISOString()
      });

      if (result.status === "success") {
        successCount += 1;
      } else if (result.status === "failed") {
        failedCount += 1;
      } else if (result.status === "not_found") {
        notFoundCount += 1;
      } else if (result.status === "skipped") {
        skippedCount += 1;
      }

      if (typeof result.responseTimeMs === "number" && Number.isFinite(result.responseTimeMs)) {
        responseTimeTotal += result.responseTimeMs;
        responseTimeCount += 1;
        responseTimeMax = Math.max(responseTimeMax, result.responseTimeMs);
      }
    }

    const finishedAt = new Date().toISOString();
    this.repository.finalizeSyncBatch(syncBatchId, {
      status: failedCount > 0 ? "completed_with_errors" : "completed",
      success_count: successCount,
      failed_count: failedCount,
      not_found_count: notFoundCount,
      skipped_count: skippedCount,
      average_response_time_ms: responseTimeCount > 0 ? Math.round(responseTimeTotal / responseTimeCount) : null,
      max_response_time_ms: responseTimeCount > 0 ? responseTimeMax : null,
      summary: {
        scanned_count: orders.length,
        success_count: successCount,
        failed_count: failedCount,
        not_found_count: notFoundCount,
        skipped_count: skippedCount
      },
      finished_at: finishedAt
    });

    const completedBatch =
      this.repository.listRecentSyncBatches(1).find((item) => item.sync_batch_id === syncBatchId) || batch;
    this.logSyncBatchResult(completedBatch);
    return completedBatch;
  }
}
