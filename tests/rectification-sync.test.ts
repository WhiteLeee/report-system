import assert from "node:assert/strict";
import { test } from "node:test";

import type { HuiYunYingRectificationOrderItem } from "../backend/integrations/huiyunying/huiyunying.types";
import {
  buildRectificationReplyContent,
  buildRectificationSyncPatch,
  getRectificationStateLabel,
  isRemoteRectificationSnapshotUnchanged,
  mapRemoteRectificationStatus,
  normalizeRemoteIfCorrected
} from "../backend/rectification/rectification-sync";
import type { RectificationOrderRecord } from "../backend/rectification/rectification.types";

function createOrder(overrides: Partial<RectificationOrderRecord> = {}): RectificationOrderRecord {
  return {
    id: 1,
    report_id: 101,
    result_id: 201,
    source_enterprise_id: "ent-1",
    enterprise_name: "测试企业",
    report_type: "standard",
    report_version: "v1",
    published_at: "2026-04-01T08:00:00.000Z",
    source_review_log_id: 1,
    store_id: "store-1",
    store_code: "S001",
    store_name: "测试门店",
    huiyunying_order_id: "9001",
    request_description: "门店陈列需整改",
    selected_issues: [],
    image_urls: [],
    request_payload: {},
    response_payload: {
      modifiedTime: "2026-04-01 10:00:00"
    },
    status: "created",
    if_corrected: "0",
    should_corrected: "2026-04-08",
    real_corrected_time: null,
    rectification_reply_content: "旧回复",
    last_synced_at: "2026-04-01T10:00:00.000Z",
    created_by: "tester",
    created_at: "2026-04-01T08:00:00.000Z",
    updated_at: "2026-04-01T10:00:00.000Z",
    ...overrides
  };
}

function createRemoteItem(overrides: Partial<HuiYunYingRectificationOrderItem> = {}): HuiYunYingRectificationOrderItem {
  return {
    disqualifiedId: "9001",
    ifCorrected: "2",
    storeCode: "S001",
    description: "门店陈列需整改",
    realCorrectedTime: "2026-04-02 09:00:00",
    inspectionPointsStr: "货架完整性",
    markNames: "货架未摆满",
    contentTitle: "陈列整改",
    examiner: "巡检员A",
    examineTime: "2026-04-02 10:00:00",
    modifiedTime: "2026-04-02 10:00:00",
    ...overrides
  };
}

test("根据慧运营返回状态映射本地整改单状态", () => {
  assert.equal(mapRemoteRectificationStatus("1"), "corrected");
  assert.equal(mapRemoteRectificationStatus("2"), "pending_review");
  assert.equal(mapRemoteRectificationStatus("已整改"), "corrected");
  assert.equal(mapRemoteRectificationStatus("待审核"), "pending_review");
  assert.equal(mapRemoteRectificationStatus("待整改"), "created");
  assert.equal(mapRemoteRectificationStatus("0"), "created");
  assert.equal(mapRemoteRectificationStatus(undefined), "created");
});

test("规范化慧运营整改状态值", () => {
  assert.equal(normalizeRemoteIfCorrected("已整改"), "1");
  assert.equal(normalizeRemoteIfCorrected("待审核"), "2");
  assert.equal(normalizeRemoteIfCorrected("待整改"), "0");
  assert.equal(normalizeRemoteIfCorrected("已下发"), "0");
  assert.equal(normalizeRemoteIfCorrected(""), null);
});

test("生成整改回复内容时拼接整改与审核信息", () => {
  const reply = buildRectificationReplyContent(createRemoteItem());

  assert.equal(reply, "货架完整性；货架未摆满；陈列整改；审核人：巡检员A；审核时间：2026-04-02 10:00:00；完成时间：2026-04-02 09:00:00");
});

test("根据慧运营返回构造本地同步补丁", () => {
  const patch = buildRectificationSyncPatch(createOrder(), createRemoteItem({ ifCorrected: "已整改" }));

  assert.equal(patch.huiyunying_order_id, "9001");
  assert.equal(patch.status, "corrected");
  assert.equal(patch.if_corrected, "1");
  assert.equal(patch.real_corrected_time, "2026-04-02 09:00:00");
  assert.equal(
    patch.rectification_reply_content,
    "货架完整性；货架未摆满；陈列整改；审核人：巡检员A；审核时间：2026-04-02 10:00:00；完成时间：2026-04-02 09:00:00"
  );
});

test("展示状态兼容中文整改值", () => {
  assert.equal(getRectificationStateLabel(createOrder({ if_corrected: "已整改" })), "已整改");
  assert.equal(getRectificationStateLabel(createOrder({ if_corrected: "待审核" })), "待审核");
  assert.equal(getRectificationStateLabel(createOrder({ if_corrected: "待整改" })), "待整改");
  assert.equal(getRectificationStateLabel(createOrder({ if_corrected: null, status: "sync_failed" })), "同步失败");
});

test("远端快照未变化时识别为可跳过同步", () => {
  const order = createOrder({
    status: "pending_review",
    if_corrected: "2",
    real_corrected_time: "2026-04-02 09:00:00",
    response_payload: {
      modifiedTime: "2026-04-02 10:00:00"
    },
    rectification_reply_content:
      "货架完整性；货架未摆满；陈列整改；审核人：巡检员A；审核时间：2026-04-02 10:00:00；完成时间：2026-04-02 09:00:00"
  });

  assert.equal(isRemoteRectificationSnapshotUnchanged(order, createRemoteItem()), true);
  assert.equal(
    isRemoteRectificationSnapshotUnchanged(
      order,
      createRemoteItem({
        modifiedTime: "2026-04-03 10:00:00"
      })
    ),
    false
  );
});
