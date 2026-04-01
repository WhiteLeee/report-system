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
  create(input: CreateRectificationOrderInput): RectificationOrderRecord;
  listAll(filters?: RectificationOrderFilters, context?: RequestContext): RectificationOrderRecord[];
  listByResultId(resultId: number): RectificationOrderRecord[];
  listPendingSync(limit?: number): RectificationOrderRecord[];
  createSyncBatch(input: CreateRectificationSyncBatchInput): RectificationSyncBatchRecord;
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
  ): void;
  createSyncLog(input: CreateRectificationSyncLogInput): void;
  listRecentSyncBatches(limit?: number): RectificationSyncBatchRecord[];
  listDailySyncStats(days?: number): RectificationSyncDailyStat[];
  attachSourceReviewLog(orderIds: number[], sourceReviewLogId: number): void;
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
  ): void;
}
