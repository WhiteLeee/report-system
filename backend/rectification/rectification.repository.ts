import type {
  CreateRectificationOrderInput,
  RectificationOrderFilters,
  RectificationOrderRecord
} from "@/backend/rectification/rectification.types";
import type { RequestContext } from "@/backend/auth/request-context";

export interface RectificationOrderRepository {
  create(input: CreateRectificationOrderInput): RectificationOrderRecord;
  listAll(filters?: RectificationOrderFilters, context?: RequestContext): RectificationOrderRecord[];
  listByResultId(resultId: number): RectificationOrderRecord[];
  listPendingSync(limit?: number): RectificationOrderRecord[];
  attachSourceReviewLog(orderIds: number[], sourceReviewLogId: number): void;
  updateSyncState(
    orderId: number,
    patch: Partial<
      Pick<
        RectificationOrderRecord,
        "huiyunying_order_id" | "status" | "if_corrected" | "real_corrected_time" | "last_synced_at" | "response_payload"
      >
    >
  ): void;
}
