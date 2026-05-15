import type {
  CreateRectificationSyncBatchInput,
  CreateRectificationSyncLogInput,
  CreateRectificationOrderInput,
  RectificationSyncBatchRecord,
  RectificationSyncDailyStat,
  RectificationOrderFilters,
  RectificationOrderRecord
} from "@/backend/rectification/rectification.types";
import type { RequestContext } from "@/backend/auth/request-context";

export interface RectificationOrderRepository {
  create(input: CreateRectificationOrderInput): Promise<any>;
  listAll(filters?: RectificationOrderFilters, context?: RequestContext): Promise<any>;
  listByResultId(resultId: number): Promise<any>;
  listPendingSync(limit?: number): Promise<any>;
  createSyncBatch(input: CreateRectificationSyncBatchInput): Promise<any>;
  finalizeSyncBatch(
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
  ): Promise<any>;
  createSyncLog(input: CreateRectificationSyncLogInput): Promise<any>;
  listRecentSyncBatches(limit?: number): Promise<any>;
  listDailySyncStats(days?: number): Promise<any>;
  attachSourceReviewLog(orderIds: number[], sourceReviewLogId: number): Promise<any>;
  updateSyncState(
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
  ): Promise<any>;
}
