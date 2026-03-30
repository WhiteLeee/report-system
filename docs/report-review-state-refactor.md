# 报告复核状态重构设计

## 1. 背景

当前 `report-system` 的复核状态模型只有二元状态：

- `pending_review`
- `reviewed`

并且批次、门店、巡检结果三层共用同一个枚举。现状会导致两个直接问题：

1. 无法表达“部分已处理”的业务语义  
   例如：`未完成 12/126`
2. 批次级和门店级状态只是结果级状态的弱化版，无法清晰支撑多人协作复核

本次重构的目标，是把“实际复核对象”和“聚合进度对象”彻底拆开，形成可扩展的数据结构。

## 2. 业务目标

### 2.1 批次级复核信息

批次需要支持 3 种进度状态：

- `待复核`
  含义：批次内 `0` 条巡检结果被复核
- `未完成`
  含义：批次内已有部分巡检结果被复核，但未全部完成
- `已完成`
  含义：批次内全部巡检结果都已完成复核

列表页展示口径统一为：

- `待复核`
- `未完成 12/126`
- `已完成`

其中 `12/126` 表示：

- `completed_result_count / total_result_count`

### 2.2 门店级复核信息

门店是批次内部的协作分配单元，也需要支持 3 种进度状态：

- `待复核`
- `未完成`
- `已完成`

门店进度的判定逻辑与批次相同，但统计口径缩小到单门店范围。

### 2.3 巡检结果级复核信息

单条巡检结果是运营经理真正执行复核动作的最小单元。

建议状态只保留两种：

- `pending`
- `completed`

“未完成”不是单条巡检结果的概念，而是聚合层概念。

## 3. 设计原则

### 3.1 可写状态与派生状态分离

只允许直接写入：

- 巡检结果级 `review_state`

统一派生：

- 门店级 `progress_state`
- 批次级 `progress_state`

这样可以避免人工直接修改聚合状态导致数据不一致。

### 3.2 聚合状态必须依赖计数快照

批次和门店的状态，不再由“是否全完成”这种简单逻辑粗暴推导，而是依赖明确的统计字段：

- `total_result_count`
- `completed_result_count`
- `pending_result_count`
- `progress_percent`

### 3.3 原始快照与结构化数据分离

发布方原始 payload 仍需保留，但不再和业务主表强耦合。

建议单独存入：

- `report_source_snapshot`

这样后续可用于：

- 审计
- 重放
- 重算
- 版本排查

### 3.4 扩展字段优先走 JSON 或区块表

未来 `vision-agent` 新增字段或新的整块信息时：

- 核心筛选字段进入主表
- 展示补充字段进入 `metadata_json`
- 新的大区块进入 `extensions_json` 或独立扩展表

避免每次都大改主表结构。

## 4. 新状态模型

### 4.1 聚合进度状态

用于批次和门店：

```ts
type ProgressState = "pending" | "in_progress" | "completed";
```

判定规则：

1. `completed_result_count = 0` -> `pending`
2. `0 < completed_result_count < total_result_count` -> `in_progress`
3. `completed_result_count = total_result_count` -> `completed`

### 4.2 巡检结果复核状态

用于单条巡检结果和复核日志：

```ts
type ResultReviewState = "pending" | "completed";
```

## 5. 建议的数据模型

### 5.1 `report`

继续作为批次主表，但从“简单汇总”升级为“批次聚合状态主表”。

建议保留：

- 发布信息
- 报告基础信息
- 标准规模字段

建议新增：

- `progress_state`
- `completed_store_count`
- `pending_store_count`
- `in_progress_store_count`
- `total_result_count`
- `completed_result_count`
- `pending_result_count`
- `progress_percent`
- `state_snapshot_json`
- `extensions_json`

### 5.2 `report_store`

门店表升级为“门店聚合状态表”。

建议字段：

- `progress_state`
- `total_result_count`
- `completed_result_count`
- `pending_result_count`
- `progress_percent`
- `state_snapshot_json`

### 5.3 `report_image`

本阶段仍保留现有表名，避免一次性改爆全仓代码；但语义上改为“巡检结果表”。

建议新增/替换字段：

- `review_state`
- `reviewed_by`
- `reviewed_at`
- `review_note`
- `review_payload_json`

后续如需要彻底语义统一，再将该表重命名为 `report_result`。

### 5.4 `report_issue`

问题项不再承担批次/门店进度的主判定职责，但仍作为详情内容的一部分保留。

建议新增：

- `result_id`
- `review_state`

这样问题项可以明确挂到某条巡检结果上。

### 5.5 `report_review_log`

保留操作事件日志，但语义升级为“巡检结果复核事件”。

建议调整：

- `image_id` 语义上改为“巡检结果 id”
- `from_status / to_status` 改用 `ResultReviewState`

### 5.6 `report_source_snapshot`

新增原始快照表：

- `report_id`
- `source_system`
- `payload_version`
- `payload_hash`
- `payload_json`
- `published_at`
- `received_at`

## 6. 核心判定口径

### 6.1 门店进度

按当前门店下所有巡检结果的 `review_state` 聚合：

- `0 / N` -> `pending`
- `X / N` 且 `0 < X < N` -> `in_progress`
- `N / N` -> `completed`

### 6.2 批次进度

按整个批次下所有巡检结果的 `review_state` 聚合：

- `0 / N` -> `pending`
- `X / N` 且 `0 < X < N` -> `in_progress`
- `N / N` -> `completed`

### 6.3 UI 展示口径

列表页统一展示：

- `待复核`
- `未完成 12/126`
- `已完成`

详情页统一展示：

- 批次总进度
- 门店进度
- 单条巡检结果是否已复核

## 7. 本次实施策略

本次重构分为两步。

### 7.1 第一步

优先落地：

- 新状态类型
- 批次/门店进度统计字段
- 发布归一化重构
- 复核事务回写聚合进度
- 原始快照独立落表

### 7.2 第二步

后续视需要再做：

- `report_image` 重命名为 `report_result`
- 接口路径从 `/images/{id}` 迁到 `/results/{id}`
- 扩展区块表独立建模

## 8. 为什么这样设计

这套设计的核心价值是：

1. 能准确表达 `待复核 / 未完成 / 已完成`
2. 支持多人协作下的门店分工与批次总控
3. 批次、门店、巡检结果三层职责清晰
4. 后续 `vision-agent` 增加字段或区块时，不需要反复推倒主模型
5. 保留快照，保证审计、重算和排障能力
