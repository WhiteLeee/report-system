import assert from "node:assert/strict";
import { test } from "node:test";

import { buildRectificationPreviewOrders, RectificationPreviewError } from "../lib/rectification-preview";

test("未勾选问题项时使用默认描述生成整改单预览", () => {
  const orders = buildRectificationPreviewOrders({
    selectedIssues: [],
    note: "",
    shouldCorrected: "2026-04-08",
    imageUrls: ["https://example.com/a.jpg"],
    maxLength: 500
  });

  assert.equal(orders.length, 1);
  assert.equal(orders[0].issueCount, 0);
  assert.equal(orders[0].selectedIssues.length, 0);
  assert.equal(orders[0].description, "当前结果未勾选具体问题项，请门店结合巡检图片完成整改。");
});

test("未勾选问题项但填写备注时使用备注生成整改单预览", () => {
  const orders = buildRectificationPreviewOrders({
    selectedIssues: [],
    note: "请门店重点核查陈列完整性。",
    shouldCorrected: "2026-04-08",
    imageUrls: [],
    maxLength: 500
  });

  assert.equal(orders.length, 1);
  assert.equal(orders[0].description, "复核备注：请门店重点核查陈列完整性。");
});

test("未勾选问题项且备注超长时返回长度错误", () => {
  assert.throws(
    () =>
      buildRectificationPreviewOrders({
        selectedIssues: [],
        note: "这是一个很长的备注",
        shouldCorrected: "2026-04-08",
        imageUrls: [],
        maxLength: 5
      }),
    (error) => error instanceof RectificationPreviewError && error.message === "复核备注已超过 5 字，无法创建整改单。"
  );
});

test("勾选问题项时在描述中标明对应图片序号", () => {
  const orders = buildRectificationPreviewOrders({
    selectedIssues: [
      { id: 1, title: "货架未摆满", imageUrls: ["https://example.com/a.jpg"] },
      { id: 2, title: "通道堵塞", imageUrls: ["https://example.com/b.jpg"] }
    ],
    note: "",
    shouldCorrected: "2026-04-08",
    imageUrls: [],
    maxLength: 500
  });

  assert.equal(orders.length, 1);
  assert.deepEqual(orders[0].imageUrls, ["https://example.com/a.jpg", "https://example.com/b.jpg"]);
  assert.equal(orders[0].description, "1. 货架未摆满（对应图片：第1张）\n2. 通道堵塞（对应图片：第2张）");
});

test("勾选问题项缺少图片时拒绝生成整改单预览", () => {
  assert.throws(
    () =>
      buildRectificationPreviewOrders({
        selectedIssues: [{ id: 1, title: "货架未摆满", imageUrls: [] }],
        note: "",
        shouldCorrected: "2026-04-08",
        imageUrls: ["https://example.com/fallback.jpg"],
        maxLength: 500
      }),
    (error) =>
      error instanceof RectificationPreviewError &&
      error.message === "问题“货架未摆满”缺少可下发图片，请检查标注图或原图。"
  );
});

test("勾选问题项图片超过 10 张时按图片数量自动拆单", () => {
  const selectedIssues = Array.from({ length: 11 }, (_, index) => ({
    id: index + 1,
    title: `问题 ${index + 1}`,
    imageUrls: [`https://example.com/${index + 1}.jpg`]
  }));

  const orders = buildRectificationPreviewOrders({
    selectedIssues,
    note: "",
    shouldCorrected: "2026-04-08",
    imageUrls: [],
    maxLength: 1000
  });

  assert.equal(orders.length, 2);
  assert.equal(orders[0].selectedIssues.length, 10);
  assert.equal(orders[0].imageUrls.length, 10);
  assert.equal(orders[1].selectedIssues.length, 1);
  assert.deepEqual(orders[1].imageUrls, ["https://example.com/11.jpg"]);
  assert.match(orders[1].description, /11\. 问题 11（对应图片：第1张）/);
});
