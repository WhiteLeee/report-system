import type { HuiYunYingRectificationOrderItem } from "@/backend/integrations/huiyunying/huiyunying.types";
import type { RectificationOrderRecord, RectificationOrderStatus } from "@/backend/rectification/rectification.types";

function normalizeText(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function buildReplySegments(item: HuiYunYingRectificationOrderItem): string[] {
  const contentParts = [
    normalizeText(item.inspectionPointsStr),
    normalizeText(item.markNames),
    normalizeText(item.contentTitle)
  ].filter((value): value is string => Boolean(value));
  const reviewParts = [
    normalizeText(item.examiner) ? `审核人：${normalizeText(item.examiner)}` : null,
    normalizeText(item.examineTime) ? `审核时间：${normalizeText(item.examineTime)}` : null,
    normalizeText(item.realCorrectedTime || item.realCorrected)
      ? `完成时间：${normalizeText(item.realCorrectedTime || item.realCorrected)}`
      : null
  ].filter((value): value is string => Boolean(value));
  return [...contentParts, ...reviewParts];
}

export function normalizeRemoteIfCorrected(ifCorrected: unknown): string | null {
  const normalized = String(ifCorrected || "").trim();
  if (!normalized) {
    return null;
  }
  if (["1", "已整改", "整改完成"].includes(normalized)) {
    return "1";
  }
  if (["2", "待审核", "审核中"].includes(normalized)) {
    return "2";
  }
  if (["0", "待整改", "未整改", "已下发"].includes(normalized)) {
    return "0";
  }
  return normalized;
}

export function mapRemoteRectificationStatus(ifCorrected: unknown): RectificationOrderStatus {
  const normalized = normalizeRemoteIfCorrected(ifCorrected);
  if (normalized === "1") {
    return "corrected";
  }
  if (normalized === "2") {
    return "pending_review";
  }
  return "created";
}

export function getRectificationStateLabel(order: Pick<RectificationOrderRecord, "if_corrected" | "status">): string {
  const normalized = normalizeRemoteIfCorrected(order.if_corrected);
  if (normalized === "1") {
    return "已整改";
  }
  if (normalized === "2") {
    return "待审核";
  }
  if (normalized === "0") {
    return "待整改";
  }
  if (order.status === "corrected") {
    return "已整改";
  }
  if (order.status === "pending_review") {
    return "待审核";
  }
  if (order.status === "sync_failed") {
    return "同步失败";
  }
  return "已下发";
}

export function buildRectificationReplyContent(
  item: HuiYunYingRectificationOrderItem
): string | null {
  const segments = buildReplySegments(item);
  return segments.length > 0 ? segments.join("；") : null;
}

export function buildRectificationSyncPatch(
  order: RectificationOrderRecord,
  item: HuiYunYingRectificationOrderItem
): Pick<
  RectificationOrderRecord,
  | "huiyunying_order_id"
  | "status"
  | "if_corrected"
  | "real_corrected_time"
  | "rectification_reply_content"
  | "response_payload"
> {
  return {
    huiyunying_order_id: normalizeText(item.disqualifiedId) || order.huiyunying_order_id,
    status: mapRemoteRectificationStatus(item.ifCorrected),
    if_corrected: normalizeRemoteIfCorrected(item.ifCorrected),
    real_corrected_time: normalizeText(item.realCorrectedTime || item.realCorrected),
    rectification_reply_content: buildRectificationReplyContent(item),
    response_payload: item as unknown as RectificationOrderRecord["response_payload"]
  };
}

export function isRemoteRectificationSnapshotUnchanged(
  order: RectificationOrderRecord,
  item: HuiYunYingRectificationOrderItem
): boolean {
  const currentPayload =
    order.response_payload && typeof order.response_payload === "object" && !Array.isArray(order.response_payload)
      ? (order.response_payload as Record<string, unknown>)
      : {};
  const nextPatch = buildRectificationSyncPatch(order, item);
  return (
    String(nextPatch.huiyunying_order_id || "") === String(order.huiyunying_order_id || "") &&
    nextPatch.status === order.status &&
    String(nextPatch.if_corrected || "") === String(order.if_corrected || "") &&
    String(nextPatch.real_corrected_time || "") === String(order.real_corrected_time || "") &&
    String(nextPatch.rectification_reply_content || "") === String(order.rectification_reply_content || "") &&
    String(item.modifiedTime || "") === String(currentPayload.modifiedTime || "")
  );
}
