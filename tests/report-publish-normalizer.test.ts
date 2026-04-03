import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizePublishedReport } from "../backend/report/report-publish-normalizer";
import type { ReportPublishPayload } from "../backend/report/report.types";

function createPayload(): ReportPublishPayload {
  return {
    source_system: "vision-agent",
    payload_version: 2,
    idempotency_key: "publish-auto-review-demo",
    published_at: "2026-04-01 12:00:00",
    report: {
      report_meta: {
        report_type: "daily",
        topic: "智能巡检",
        plan_id: "plan-demo",
        plan_name: "演示计划",
        report_versions: ["v1"],
        enterprise_id: "ent-demo",
        enterprise_name: "演示企业",
        start_date: "2026-04-01",
        end_date: "2026-04-01",
        operator: "tester",
        generated_at: "2026-04-01 12:00:00"
      },
      summary: {
        metrics: {}
      },
      facts: {
        stores: [
          {
            store_id: "store-1",
            store_code: "S001",
            store_name: "测试门店",
            organize_name: "总部"
          }
        ],
        cameras: [],
        captures: [
          {
            capture_id: "capture-1",
            image_id: "image-1",
            store_id: "store-1",
            store_name: "测试门店",
            preview_url: "https://example.com/1.jpg",
            captured_at: "2026-04-01 10:00:00",
            issue_count: 0
          },
          {
            capture_id: "capture-2",
            image_id: "image-2",
            store_id: "store-1",
            store_name: "测试门店",
            preview_url: "https://example.com/2.jpg",
            captured_at: "2026-04-01 10:05:00",
            issue_count: 1
          }
        ],
        inspections: [
          {
            inspection_id: "inspection-1",
            capture_id: "capture-1",
            image_id: "image-1",
            store_id: "store-1",
            skill_id: "skill-1",
            skill_name: "货架检查",
            status: "success",
            raw_result: "识别完成，未发现异常。",
            total_issues: 0
          },
          {
            inspection_id: "inspection-2",
            capture_id: "capture-2",
            image_id: "image-2",
            store_id: "store-1",
            skill_id: "skill-1",
            skill_name: "货架检查",
            status: "success",
            raw_result: "发现货架未摆满。",
            total_issues: 1
          }
        ],
        issues: [
          {
            issue_id: "issue-1",
            inspection_id: "inspection-2",
            capture_id: "capture-2",
            image_id: "image-2",
            store_id: "store-1",
            skill_id: "skill-1",
            skill_name: "货架检查",
            issue_type: "陈列",
            description: "货架未摆满",
            count: 1,
            severity: "P2",
            review_status: "pending_review"
          }
        ]
      }
    }
  };
}

test("未发现问题的图片在入库标准化时自动标记为已复核", () => {
  const normalized = normalizePublishedReport(createPayload());

  assert.equal(normalized.images.length, 2);
  assert.equal(normalized.images[0].review_state, "completed");
  assert.equal(normalized.images[0].reviewed_at, "2026-04-01 12:00:00");
  assert.deepEqual(normalized.images[0].review_payload, {
    auto_completed: true,
    auto_completed_reason: "pass_no_issues"
  });
  assert.equal(normalized.images[1].review_state, "pending");

  assert.equal(normalized.completed_result_count, 1);
  assert.equal(normalized.pending_result_count, 1);
  assert.equal(normalized.progress_state, "in_progress");
  assert.equal(normalized.stores[0].completed_result_count, 1);
  assert.equal(normalized.stores[0].progress_state, "in_progress");
});
