import type { RequestContext } from "@/backend/auth/request-context";
import { createHuiYunYingRectificationService } from "@/backend/integrations/huiyunying/huiyunying.module";
import type { HuiYunYingCreateRectificationInput } from "@/backend/integrations/huiyunying/huiyunying.types";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import type { ReviewSelectedIssue } from "@/backend/report/report.types";
import type {
  CreateRectificationOrderInput,
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

function formatDateOnly(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export class RectificationService {
  constructor(private readonly repository: RectificationOrderRepository) {}

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

  async syncOrderStatus(order: RectificationOrderRecord): Promise<RectificationOrderRecord> {
    const huiYunYingService = createHuiYunYingRectificationService();
    const today = formatDateOnly(new Date());
    const createdDate = formatDateOnly(order.created_at) || today;
    const items = await huiYunYingService.listRectificationOrders({
      searchName: order.store_code || order.store_name || order.store_id || "",
      pageNumber: 1,
      pageSize: 50,
      startDate: createdDate,
      endDate: today,
      modifyStartDate: createdDate,
      modifyEndDate: today
    });

    const matched =
      items.find((item) => String(item.disqualifiedId || "").trim() === String(order.huiyunying_order_id || "").trim()) ||
      items.find(
        (item) =>
          String(item.storeCode || "").trim() === String(order.store_code || "").trim() &&
          String(item.description || "").trim() === order.request_description
      ) ||
      null;

    if (!matched) {
      this.repository.updateSyncState(order.id, {
        last_synced_at: new Date().toISOString(),
        response_payload: { status: "not_found" }
      });
      return this.repository.listByResultId(order.result_id).find((item) => item.id === order.id) || order;
    }

    const ifCorrected = String(matched.ifCorrected || "").trim() || null;
    const status =
      ifCorrected === "1" ? "corrected" : ifCorrected === "2" ? "pending_review" : "created";

    this.repository.updateSyncState(order.id, {
      huiyunying_order_id:
        String(matched.disqualifiedId || "").trim() || order.huiyunying_order_id,
      status,
      if_corrected: ifCorrected,
      real_corrected_time: String(matched.realCorrectedTime || "").trim() || null,
      last_synced_at: new Date().toISOString(),
      response_payload: matched as unknown as JsonValue
    });

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

  async syncPendingOrders(limit = 50): Promise<void> {
    const orders = this.repository.listPendingSync(limit);
    for (const order of orders) {
      await this.syncOrderStatus(order);
    }
  }
}
