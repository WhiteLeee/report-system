import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReportInspection, ReportIssue } from "../backend/report/report.types";
import {
  classifyReportResultSemantics,
  getReportResultSemanticLabel,
  getReportResultSemanticSummaryLabel
} from "../ui/report-result-semantics";

function createInspection(overrides: Partial<ReportInspection> = {}): ReportInspection {
  return {
    id: 1,
    report_id: 1,
    result_id: 1,
    store_id: "store-1",
    store_name: "测试门店",
    inspection_id: "inspection-1",
    skill_id: "skill-1",
    skill_name: "货架检查",
    status: "success",
    raw_result: "识别完成，未发现异常。",
    error_message: null,
    metadata: {},
    display_order: 0,
    created_at: "2026-04-01T08:00:00.000Z",
    ...overrides
  };
}

function createIssue(overrides: Partial<ReportIssue> = {}): ReportIssue {
  return {
    id: 1,
    report_id: 1,
    result_id: 1,
    store_id: "store-1",
    store_name: "测试门店",
    title: "货架未摆满",
    category: "陈列",
    severity: "P2",
    description: "货架未摆满",
    suggestion: null,
    image_url: null,
    image_object_key: null,
    review_state: "pending",
    metadata: {},
    display_order: 0,
    created_at: "2026-04-01T08:00:00.000Z",
    ...overrides
  };
}

test("有问题项时优先判定为发现问题", () => {
  const state = classifyReportResultSemantics([createIssue()], [createInspection()]);
  assert.equal(state, "issue_found");
  assert.equal(getReportResultSemanticLabel(state, 1), "1");
  assert.equal(getReportResultSemanticSummaryLabel(state, 1), "发现 1 个问题");
});

test("无问题且 inspection 成功时判定为未发现问题", () => {
  const state = classifyReportResultSemantics([], [createInspection()]);
  assert.equal(state, "pass");
  assert.equal(getReportResultSemanticLabel(state), "0");
  assert.equal(getReportResultSemanticSummaryLabel(state), "未发现问题");
});

test("无问题但命中目标缺失语义时判定为无法判定", () => {
  const state = classifyReportResultSemantics(
    [],
    [createInspection({ raw_result: "巡检目标缺失，无法进行合规性检查。", status: "success" })]
  );
  assert.equal(state, "inconclusive");
});

test("无问题但 inspection 失败时判定为巡检失败", () => {
  const state = classifyReportResultSemantics(
    [],
    [createInspection({ status: "failed", error_message: "model timeout" })]
  );
  assert.equal(state, "inspection_failed");
});
