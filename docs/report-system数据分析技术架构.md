# Report System 数据分析技术架构

## 1. 文档目的

本文档用于定义 `report-system` 以“数据分析”为核心能力时的正式技术架构。

该架构强调以下目标：

1. 支持业务数据结构持续演进
2. 支持分析口径持续迭代
3. 支持定时分析任务、增量刷新、全量重建
4. 支持权限范围收口
5. 在当前 `Next.js + SQLite` 单体形态下保持可实现、可维护、可扩展

本文档不替代需求文档，而是作为后续分析模块开发的工程基线。

补充说明：

本文档与 [report-system多角色治理分析设计方案.md](/Users/wick/Desktop/ZhiQing%20Selection/SourceCode/report-system/docs/report-system多角色治理分析设计方案.md) 共同构成后续 analytics 演进基线。前者解决工程分层，后者解决治理主体和责任关系。

---

## 2. 核心定位

`report-system` 不再只是“报告查看与复核系统”，而应演进为：

`巡检数据分析与治理平台`

这意味着：

- 报告查看只是分析数据的一个入口
- 复核与整改单闭环只是治理动作
- 数据分析是平台的核心输出能力
- 平台输出不只面向“看数据”，还要面向“推动门店、加盟商、运营组织去改善”

因此技术架构必须围绕“稳定分析能力”设计，而不是围绕“单个报告页面”设计。

---

## 3. 架构原则

### 3.1 事实与分析分层

业务事实表负责记录真实业务过程：

- 报告
- 门店
- 巡检结果
- 问题项
- inspection
- 复核日志
- 整改单

分析模块不应长期直接依赖这些表的当前形态做所有统计。

原因：

1. 业务表结构会变化
2. 字段语义会变化
3. 页面与分析会争抢同一套查询逻辑
4. 趋势与排行查询会越来越重

结论：

必须在业务事实层之上再抽象分析层。

### 3.2 指标口径中心化

所有分析指标必须统一定义，不允许：

- 页面自己算
- API 自己算
- 导出自己算
- 运营口径和页面口径不一致

结论：

分析指标定义必须集中在分析模块内部。

### 3.3 结果语义优先

分析体系必须统一使用当前系统已有的巡检结果语义：

- `issue_found`
- `pass`
- `inconclusive`
- `inspection_failed`

任何统计不得回退为“问题数是否为 0”。

### 3.4 分析任务是正式能力，不是后补脚本

数据分析后续一定需要：

- 增量刷新
- 日汇总
- 趋势快照
- 口径变更后的重建
- 失败重试

因此任务调度与重建能力必须进入正式架构，而不是靠零散脚本。

### 3.5 支持重建

只要口径会变，分析系统就必须支持重建。

必须支持：

- 从业务事实重建分析事实
- 从分析事实重建汇总快照
- 按日期范围重建
- 按企业 / 组织 / 门店重建

### 3.6 支持多角色治理分析

分析架构必须显式支持以下三类主体：

- 门店
- 加盟商
- 运营组织

并逐步区分：

- `统计维度`
- `责任维度`

否则 analytics 只能做分布和排行，无法形成可执行的治理分析。

---

## 4. 总体分层

建议采用以下 5 层结构：

```text
业务事实层
  -> 分析语义层
    -> 分析汇总层
      -> 分析任务层
        -> 展示与导出层
```

### 4.1 业务事实层

当前真实数据源，主要包括：

- `report`
- `report_store`
- `report_image`
- `report_issue`
- `report_inspection`
- `report_review_log`
- `report_rectification_order`
- `report_rectification_sync_batch`
- `report_rectification_sync_log`

职责：

- 存储原始业务事实
- 作为分析抽取的真相源

不承担职责：

- 不直接承载所有分析口径
- 不直接承担趋势和汇总查询

### 4.2 分析语义层

这是分析模块最关键的一层。

目标：

把业务事实映射成一套“稳定的分析事实模型”，隔离业务表结构演进。

建议事实模型：

- `analytics_result_fact`
- `analytics_issue_fact`
- `analytics_review_fact`
- `analytics_rectification_fact`

建议字段特征：

- 只保留分析真正需要的稳定字段
- 显式保存语义分类结果
- 显式保存关键维度字段
- 显式保存关键时间字段
- 显式保存分析版本号

例如 `analytics_result_fact` 建议至少包括：

- `id`
- `report_id`
- `result_id`
- `capture_id`
- `enterprise_id`
- `enterprise_name`
- `organization_code`
- `organization_name`
- `franchisee_name`
- `store_id`
- `store_name`
- `report_type`
- `report_topic`
- `plan_id`
- `plan_name`
- `captured_date`
- `result_semantic_state`
- `issue_count`
- `review_state`
- `auto_completed`
- `published_at`
- `analytics_schema_version`

这样后续即使业务表中 `metadata` 结构变化，分析页面仍然可以稳定运行。

补充要求：

- `organization_code` 作为稳定组织主键使用
- `organization_name` 仅作为展示字段使用
- `franchisee_name` 在主数据已具备的前提下，应进入 analytics facts
- 如果后续主数据补齐 `franchisee_id`，analytics facts 应优先切换到 `franchisee_id + franchisee_name`

### 4.3 分析汇总层

目标：

承载趋势、排行、总览类查询所需的加速数据。

建议快照模型：

- `analytics_daily_overview`
- `analytics_daily_result_semantic`
- `analytics_daily_issue_type`
- `analytics_daily_rectification`
- `analytics_org_daily_metrics`
- `analytics_store_daily_metrics`

职责：

- 承载日级或周级汇总
- 支撑分析页高频查询
- 避免每次扫全量事实表

### 4.4 分析任务层

目标：

负责分析数据的刷新、重建、调度与失败恢复。

建议任务模型：

- `analytics_job_run`
- `analytics_job_checkpoint`

任务类型建议：

- `fact_incremental_refresh`
- `fact_full_rebuild`
- `daily_snapshot_refresh`
- `daily_snapshot_rebuild`
- `rectification_overdue_refresh`
- `governance_metrics_refresh`

### 4.5 展示与导出层

目标：

承载 `/analytics` 页面、分析接口与导出能力。

职责：

- 展示概览、趋势、排行、分布
- 提供 CSV 导出
- 支持跳转到 `/reports`、`/rectifications`

---

## 5. 模块划分

建议新增独立分析模块：

```text
backend/
  analytics/
    contracts/
      analytics.types.ts
      analytics.filters.ts
      analytics.metrics.ts
      analytics-version.ts
    adapters/
      report-analytics.adapter.ts
      rectification-analytics.adapter.ts
    facts/
      analytics-fact.repository.ts
      sqlite-analytics-fact.repository.ts
      analytics-fact.service.ts
    snapshots/
      analytics-snapshot.repository.ts
      sqlite-analytics-snapshot.repository.ts
      analytics-snapshot.service.ts
    queries/
      analytics.repository.ts
      sqlite-analytics.repository.ts
      analytics.service.ts
    jobs/
      analytics-job.repository.ts
      sqlite-analytics-job.repository.ts
      analytics-job.service.ts
      analytics-job.manager.ts
    analytics.module.ts
```

### 5.1 contracts

职责：

- 定义统一 filters
- 定义指标结构
- 定义 view model
- 定义分析 schema version
- 定义多角色治理分析所需的责任主体维度

### 5.2 adapters

职责：

- 把业务事实映射成分析事实
- 处理源结构版本差异
- 隔离上游字段变化

这是兼容未来结构变化的关键位置。

同时也是隔离“业务对象”和“治理主体”的关键位置。

### 5.3 facts

职责：

- 写入分析事实表
- 增量刷新分析事实
- 重建分析事实

### 5.4 snapshots

职责：

- 生成日汇总 / 趋势汇总 / 组织汇总 / 门店汇总
- 为分析页提供加速数据

### 5.5 queries

职责：

- 面向页面与导出提供查询接口
- 优先查询汇总层
- 必要时回落分析事实层

### 5.6 jobs

职责：

- 任务调度
- 任务执行
- 失败重试
- 断点恢复
- 重建任务

---

## 6. 面向结构变化的设计

### 6.1 为什么必须单独设计

`report-system` 的业务表结构未来一定会变，原因包括：

- `vision-agent` 发布契约变化
- 新字段增加
- 结果语义规则调整
- 复核流程调整
- 整改单流程调整

如果分析直接绑定业务表，结果是：

- 每次业务变化都要改分析页
- 每次口径变化都要改所有统计 SQL
- 老数据与新数据口径混乱

### 6.2 解决方式

建议采用：

`业务事实 -> Adapter -> 分析事实`

其中：

- 业务事实可以变化
- Adapter 负责适配变化
- 分析事实保持稳定

### 6.3 分析版本

建议引入：

- `analytics_schema_version`

作用：

- 标记分析事实是按哪一版规则生成的
- 为后续重建和回溯提供依据

### 6.4 重建能力

当出现以下情况时，应支持重建：

- 结果语义规则变化
- 闭环状态映射变化
- 指标口径变化
- 新增重要分析维度
- 历史数据回补

重建维度建议支持：

- 全量重建
- 按日期范围重建
- 按企业重建
- 按组织重建
- 按报告重建

---

## 7. 定时任务架构

### 7.1 为什么必须内建任务机制

数据分析不可能只靠页面实时现算，后续一定需要：

- 日趋势
- 周趋势
- 管理看板
- 超期整改统计
- 重算任务

因此必须正式支持定时任务。

### 7.2 建议任务类型

#### 任务一：分析事实增量刷新

触发方式：

- 发布报告后
- 复核状态变化后
- 整改单变化后

职责：

- 将新业务事实同步到分析事实层

#### 任务二：日汇总刷新

触发方式：

- 定时任务

职责：

- 生成最近一天或最近几天的汇总快照

#### 任务三：趋势重建

触发方式：

- 手动
- 口径升级后

职责：

- 重建历史趋势和汇总

#### 任务四：超期整改刷新

触发方式：

- 定时任务

职责：

- 更新整改单超期分析口径

### 7.3 任务执行策略

建议采用：

- 单实例串行执行
- 记录任务状态
- 支持断点继续
- 支持失败重试
- 支持人为重跑

### 7.4 调度配置

后续建议把分析任务调度也纳入系统设置，例如：

- `analyticsFactRefreshIntervalMs`
- `analyticsSnapshotRefreshIntervalMs`
- `analyticsRebuildBatchSize`
- `analyticsJobRetryCount`

---

## 8. 查询架构

分析查询建议拆成两条链：

### 8.1 实时链

适合：

- 当前批次分析
- 当前门店分析
- 当前结果分析

特点：

- 查询分析事实层
- 保持实时
- 数据量相对可控

### 8.2 汇总链

适合：

- 趋势图
- 概览卡片
- Top N 排行
- 周/月分析

特点：

- 查询分析汇总层
- 保持稳定性能
- 避免扫全量明细

---

## 9. 权限模型

分析页必须与业务页统一权限口径。

原则：

- 管理员：可看全部授权范围数据
- 普通查看者：只能看自己授权组织下的数据
- 复检员：只能看自己授权组织下的数据

必须保证：

- 列表受限，图表也受限
- 排行受限，概览也受限
- 导出受限，跳转联动也受限

建议：

- 所有 `analytics.service` 入口都接收 `RequestContext`
- 统一在 service 层收口数据范围

---

## 10. 数据流

建议数据流如下：

```text
vision-agent 发布
  -> report-system 业务事实入库
  -> 结果语义标准化
  -> 复核 / 整改单闭环写回业务事实
  -> analytics adapter 抽取分析事实
  -> snapshot job 生成汇总快照
  -> /analytics 页面查询汇总与事实数据
```

这条数据流的关键点：

1. 分析不直接依赖 `vision-agent` 在线接口
2. 业务事实与分析事实分离
3. 汇总快照通过任务生成
4. 页面优先查询稳定汇总

---

## 11. 表设计建议

### 11.1 分析事实表示例

建议新增：

- `analytics_result_fact`
- `analytics_issue_fact`
- `analytics_review_fact`
- `analytics_rectification_fact`

### 11.2 分析快照表示例

建议新增：

- `analytics_daily_overview`
- `analytics_daily_result_semantic`
- `analytics_daily_issue_type`
- `analytics_daily_rectification`
- `analytics_org_daily_metrics`
- `analytics_store_daily_metrics`

### 11.3 任务表示例

建议新增：

- `analytics_job_run`
- `analytics_job_checkpoint`

---

## 12. 一期落地建议

### 阶段一：分析模块底座

先做：

- `backend/analytics` 模块骨架
- 统一 filters / metrics / version
- facts / queries 层初版

### 阶段二：核心查询

先做 4 个高价值查询：

1. 概览
2. 巡检结论分布
3. 问题类型排行
4. 整改单闭环概览

### 阶段三：快照层

新增：

- `analytics_daily_*`
- `analytics_*_metrics`

### 阶段四：任务层

新增：

- 增量刷新任务
- 汇总刷新任务
- 重建任务

### 阶段五：分析页

新增：

- `/analytics`
- 概览卡片
- 趋势
- 排行
- 导出

---

## 13. 风险与注意事项

### 13.1 不要把分析继续塞进 report 模块

否则：

- 业务逻辑和分析逻辑耦合
- 代码职责混乱
- 后续很难扩展

### 13.2 不要让页面自己算指标

否则：

- 指标口径分散
- 页面性能不稳定
- 导出和页面不一致

### 13.3 不要忽略历史重建

否则：

- 一旦口径变化，只能人工修数据
- 老数据永远不一致

### 13.4 不要把任务做成一次性脚本

否则：

- 无法稳定调度
- 无法追踪执行状态
- 无法失败恢复

---

## 14. 结论

`report-system` 如果以数据分析为核心，其正式技术架构应为：

`业务事实层 -> 分析语义层 -> 分析汇总层 -> 分析任务层 -> 展示与导出层`

其中最关键的 3 个能力必须从第一版就预留：

1. 分析事实层
2. 分析快照层
3. 分析任务层

只有这样，系统才能在未来业务结构持续变化的情况下，仍然保持数据分析能力的稳定、可扩展和可重建。
