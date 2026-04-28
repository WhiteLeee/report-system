import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReportInspection, ReportIssue, ReportResult } from "../backend/report/report.types";
import { resolveResultImageState } from "../ui/report/report-detail-helpers";

function createResult(): ReportResult {
  return {
    id: 1,
    report_id: 1,
    store_id: "store-1",
    store_name: "测试门店",
    object_key: null,
    bucket: null,
    region: null,
    url: "https://example.com/result.jpg",
    width: null,
    height: null,
    captured_at: null,
    review_state: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    review_payload: {},
    metadata: {
      capture_url: "https://example.com/original.jpg",
      display_url: "https://example.com/original.jpg"
    },
    display_order: 0,
    created_at: "2026-04-01 12:00:00"
  };
}

function createInspection(overrides: Partial<ReportInspection> = {}): ReportInspection {
  return {
    id: 1,
    report_id: 1,
    result_id: 1,
    store_id: "store-1",
    store_name: "测试门店",
    inspection_id: "inspection-1",
    skill_id: "skill-1",
    skill_name: "技能 1",
    status: "success",
    raw_result: null,
    error_message: null,
    metadata: {
      evidence_image_url: "https://oss.example.com/evidence.jpg",
      original_image_url: "https://example.com/original.jpg",
      display_image_url: "https://oss.example.com/evidence.jpg",
      provider_meta: {}
    },
    display_order: 0,
    created_at: "2026-04-01 12:00:00",
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
    title: "问题",
    category: null,
    severity: null,
    description: null,
    suggestion: null,
    image_url: "https://example.com/original.jpg",
    image_object_key: null,
    review_state: "pending",
    metadata: {
      evidence_image_url: "",
      linked_inspection_evidence_image_url: "",
      original_image_url: "https://example.com/original.jpg",
      display_image_url: "https://example.com/original.jpg",
      extra_json: {}
    },
    display_order: 0,
    created_at: "2026-04-01 12:00:00",
    ...overrides
  };
}

test("resolveResultImageState 默认使用当前技能标注图", () => {
  const state = resolveResultImageState({
    selectedResult: createResult(),
    activeInspection: createInspection()
  });

  assert.equal(state.url, "https://oss.example.com/evidence.jpg");
  assert.equal(state.fallbackReason, "none");
});

test("resolveResultImageState 原图模式不污染 evidence 字段", () => {
  const state = resolveResultImageState({
    selectedResult: createResult(),
    activeInspection: createInspection(),
    mode: "original"
  });

  assert.equal(state.url, "https://example.com/original.jpg");
  assert.equal(state.evidenceUrl, "https://oss.example.com/evidence.jpg");
  assert.equal(state.fallbackReason, "original_mode");
});

test("resolveResultImageState 不把 issue.image_url 误判为 payload evidence", () => {
  const state = resolveResultImageState({
    selectedResult: createResult(),
    activeInspection: createInspection({
      metadata: {
        evidence_image_url: "",
        original_image_url: "https://example.com/original.jpg",
        display_image_url: "https://example.com/original.jpg",
        provider_meta: {}
      }
    }),
    activeIssue: createIssue()
  });

  assert.equal(state.evidenceUrl, "");
  assert.equal(state.url, "https://example.com/original.jpg");
  assert.equal(state.fallbackReason, "missing_evidence");
});

test("resolveResultImageState 标注图运行时加载失败时回退原图", () => {
  const state = resolveResultImageState({
    selectedResult: createResult(),
    activeInspection: createInspection(),
    loadFailed: true,
    mode: "evidence"
  });

  assert.equal(state.url, "https://example.com/original.jpg");
  assert.equal(state.evidenceUrl, "https://oss.example.com/evidence.jpg");
  assert.equal(state.fallbackReason, "load_failed");
});
