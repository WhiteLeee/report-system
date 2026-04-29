# report-system 适配 vision-agent V5 标注图发布需求文档

## 1. 背景

`vision-agent` 本次改造新增了 HYY V5 巡检通道、V5 标注图 OSS 资产化、巡检技能 Prompt 管理、未稳定资产发布门禁和人工覆盖发布能力。对 `report-system` 影响最大的变化是报告事实模型中的图片语义。

旧口径中，`report-system` 基本按“一张抓拍图对应一张展示图”理解报告结果：

```text
report result
-> capture.preview_url 或 capture.capture_url
```

V5 口径中，一张原始抓拍图可能被多个技能识别，每个技能识别结果都有自己的标注图：

```text
原始抓拍图 capture
-> 技能识别 inspection A -> 标注图 A -> 问题 A
-> 技能识别 inspection B -> 标注图 B -> 问题 B
```

因此，`report-system` 必须从“图片结果级展示图”升级为“技能识别级主证据图”。否则同一张抓拍图下多个技能会共用一张原图，复核人员无法看到技能对应的红框标注图，也无法准确下发整改单。

## 2. 目标

1. 支持接收 `vision-agent` 发布的 V5 技能级证据图字段。
2. 保持首期 `payload_version=2` 兼容，不启用 `facts.artifacts`。
3. 保持 `report_image` 代表原始抓拍图，不把每个技能标注图拆成新的图片结果。
4. 每个 `inspection` 能保留自己的 `evidence_image_url`、来源、原图、上游 request 信息和资产状态。
5. 每个 `issue` 能保留并展示自己关联技能的标注图。
6. 报告详情页切换技能时，主图同步切换为当前技能标注图。
7. 复核弹窗、整改单预览和问题查看使用当前技能或问题对应的标注图。
8. 对未稳定资产化但人工覆盖发布的标注图，首期即展示最小风险提示。
9. 业务页面不展示数据库 ID、对象键、request id 等技术字段；技术字段只用于排障、日志或受控调试信息。

## 3. 非目标

1. 不实现 `payload_version=3`。
2. 不实现 `facts.artifacts`、`inspection.primary_artifact_id` 或独立算法产物资产表。
3. 不实现 `report-system` 侧 OSS 二次换签或图片代理。
4. 不负责 `vision-agent` 侧标注图补偿、重试、重新资产化。
5. 不迁移历史报告数据。
6. 不改变用户、角色、权限、主数据同步、报告列表筛选等非本需求相关能力。

## 4. 角色与场景

### 4.1 复核人员

复核人员在报告详情中打开一条巡检结果，需要看到当前技能对应的标注图。切换技能后，主图必须同步切换。复核人员可以临时查看原图做对照，但回到技能识别上下文时默认展示标注图。

### 4.2 运营管理员

运营管理员关注报告是否由稳定标注图支撑。若 `vision-agent` 人工覆盖发布了未完成云存储的标注图，运营管理员需要在 `report-system` 中看到风险提示和覆盖原因，便于后续要求重新发布稳定版本。

### 4.3 客户查看者

客户查看报告和问题详情时，应看到可理解的门店、技能、问题和标注图，不应看到数据库 ID、对象键、request id、payload 字段名等技术信息。

### 4.4 技术排障人员

技术排障人员需要保留 `provider_meta`、`raw_result_json`、OSS object key、V5 request id 等信息，便于关联 `vision-agent` 发布日志、OSS 资产记录和上游识别结果。此类信息不在普通业务页面默认展示。

## 5. 术语

| 术语 | 含义 |
|---|---|
| capture | 原始抓拍事实，一张摄像头图片。 |
| inspection | 某张 capture 上某个技能的识别事实。 |
| issue | inspection 识别出的具体问题项。 |
| evidence_image_url | payload 中的技能或问题主证据图，V5 下通常是标注图。 |
| original_image_url | 原始抓拍图业务别名，用于对照和回退。 |
| display_image_url | `report-system` 根据业务优先级计算出的当前实际展示图。 |
| provider_meta | 上游和资产化状态元数据，例如 OSS object key、V5 request id、临时 URL 来源。 |
| unstable_evidence | 人工覆盖发布未稳定资产化标注图的风险标记。 |

## 6. 发布契约

首期仍支持 `payload_version=2`。`facts.captures` 继续表示原始抓拍事实，`capture_url` 和 `preview_url` 不得被标注图覆盖。

### 6.1 契约不变量

1. `facts.captures[].capture_id` 在单个报告 payload 内必须唯一。
2. `facts.inspections[].inspection_id` 在单个报告 payload 内必须唯一。
3. `facts.inspections[].capture_id` 必须能关联到某个 capture；无法关联时仍可保留原始 payload，但业务展示只能降级。
4. `facts.issues[].inspection_id` 优先用于关联 inspection。
5. issue 缺失或无法匹配 `inspection_id` 时，才允许按 `capture_id + skill_id` 降级匹配。
6. 同一 capture 下多个 inspections 可以拥有不同 `evidence_image_url`，不得互相覆盖。
7. 失败或无结论的 inspection 允许没有 `evidence_image_url`，页面应回退原图并提示标注图不可用。
8. `payload_version=2` 下即使出现 `facts.artifacts`，首期也不参与业务映射，只可忽略或保留在原始 payload 快照中。

### 6.2 inspections 字段

`facts.inspections[]` 需要支持以下扩展字段：

```json
{
  "inspection_id": "inspection-000001",
  "capture_id": "capture-000001",
  "image_id": "img-v5-001",
  "store_id": "store-001",
  "store_code": "dlb001",
  "store_name": "测试门店",
  "skill_id": "skill-a",
  "skill_name": "标签朝向",
  "channel_code": "baidu_yijian_v5",
  "status": "success",
  "raw_result": "标签未朝外",
  "raw_result_json": {
    "requestId": "req-v5-001"
  },
  "error_message": "",
  "total_issues": 1,
  "evidence_image_url": "https://vision-check.oss-cn-shanghai.aliyuncs.com/vision-agent/evidence/...",
  "evidence_image_source": "oss_rendered",
  "original_image_url": "https://hyy.example.com/capture.jpg",
  "provider_meta": {
    "source_render_image_url": "https://baidu.example.com/render.jpg?...",
    "evidence_object_key": "vision-agent/evidence/v5/enterprise=dlb/...",
    "evidence_asset_id": "asset-xxx",
    "evidence_asset_status": "uploaded",
    "prompt_version_id": "prompt-xxx",
    "prompt_hash": "sha256:..."
  }
}
```

字段语义：

| 字段 | 业务语义 | 展示要求 |
|---|---|---|
| `evidence_image_url` | payload 传来的技能主证据图。 | 普通页面可展示图片，不展示字段名。 |
| `evidence_image_source` | 证据图来源，如 `oss_rendered`、`rendered_remote`、`original_fallback`。 | 可映射为业务状态文案。 |
| `original_image_url` | 原始抓拍图。 | 用于查看原图和回退。 |
| `provider_meta` | 上游和资产化状态。 | 默认不在客户页面展示。 |
| `raw_result_json` | V5 原始结果摘要。 | 排障用，不在普通页面展示。 |

### 6.3 issues 字段

`facts.issues[]` 需要支持以下扩展字段：

```json
{
  "issue_id": "issue-000001",
  "inspection_id": "inspection-000001",
  "capture_id": "capture-000001",
  "image_id": "img-v5-001",
  "store_id": "store-001",
  "store_code": "dlb001",
  "store_name": "测试门店",
  "skill_id": "skill-a",
  "skill_name": "标签朝向",
  "issue_type": "标签",
  "description": "标签未朝外",
  "count": 1,
  "severity": "P2",
  "review_status": "pending_review",
  "evidence_image_url": "https://vision-check.oss-cn-shanghai.aliyuncs.com/vision-agent/evidence/...",
  "evidence_image_source": "oss_rendered",
  "original_image_url": "https://hyy.example.com/capture.jpg",
  "extra_json": {
    "unstable_evidence": true,
    "evidence_asset_override_reason": "供应商图片资产补偿失败，先发日报"
  }
}
```

## 7. 展示规则

### 7.1 技能主图优先级

当前技能主图按 active inspection 计算：

```text
inspection.evidence_image_url
-> inspection.original_image_url
-> capture.preview_url
-> capture.capture_url
-> 图片不可用占位
```

`evidence_image_url` 是 payload 原始证据图字段，不得被 fallback 值污染。`display_image_url` 是展示层计算结果，可以是证据图、原图或占位。

### 7.2 问题主图优先级

问题主图按 issue 计算：

```text
issue.evidence_image_url
-> 关联 inspection.evidence_image_url
-> issue.original_image_url
-> 关联 inspection.original_image_url
-> capture.preview_url
-> capture.capture_url
-> 图片不可用占位
```

### 7.3 技能切换规则

1. 一张 capture 下存在多个 inspections 时，场景列表展示技能名称。
2. 切换技能后，主图默认回到该技能的证据图模式。
3. 原图查看状态只作用于当前技能，不应在切换技能后继续压住新技能证据图。
4. 上一条和下一条导航如果保留当前 inspection 参数，必须确保目标结果中存在该 inspection；不存在时回退默认技能。

### 7.4 原图和标注图对照

本次上线必须支持最小对照能力：

1. 默认展示当前技能标注图。
2. 当前技能有 `original_image_url` 或 capture 原图时，提供“查看原图”入口。
3. 查看原图后提供“返回标注图”入口。
4. 切换技能后默认展示新技能标注图。

### 7.5 图片加载失败

当标注图 URL 加载失败、返回 403/404、跨域失败或临时 URL 过期时：

1. 页面回退展示原图。
2. 展示提示：`标注图加载失败，当前为原图`。
3. 如果存在 `unstable_evidence`，同时展示长期可访问性风险。
4. 不阻断复核操作；复核弹窗可显示当前实际展示图，但整改单预览和下发默认仍优先使用 issue/inspection evidence，只有 evidence 缺失或加载失败时才回退原图并提示。

## 8. 风险状态

`vision-agent` 可能发布以下状态：

| 状态 | 来源 | report-system 行为 |
|---|---|---|
| `uploaded` | 标注图已上传 OSS。 | 正常展示标注图。 |
| `failed` | OSS 资产化失败，人工覆盖发布。 | 展示风险提示和覆盖原因。 |
| `pending` 或 `uploading` | 资产化未完成，人工覆盖发布。 | 展示风险提示和覆盖原因。 |
| `disabled` | OSS 资产化被部署配置关闭。 | 展示图片，保留状态，可提示“证据图未云存储”。 |
| 缺失 | 老数据或非 V5 数据。 | 按旧逻辑回退原图。 |

风险字段读取优先级：

```text
issue.extra_json.unstable_evidence
-> inspection.provider_meta.unstable_evidence
```

覆盖原因读取优先级：

```text
issue.extra_json.evidence_asset_override_reason
-> inspection.provider_meta.evidence_asset_override_reason
```

## 9. 页面展示边界

普通业务页面展示：

1. 门店名称。
2. 摄像头别名或业务描述。
3. 技能名称。
4. 问题描述。
5. 标注图或原图。
6. 证据图状态的业务文案。
7. 人工覆盖风险提示和原因。

普通业务页面不展示：

1. 数据库 ID。
2. `inspection_id`、`image_id`、`issue_id`。
3. OSS object key。
4. V5 request id。
5. payload 字段名。
6. 原始 JSON。

技术字段可通过日志、服务端排障、受控调试信息或后续管理页使用。

## 10. 数据保留规则

1. `report_image` 继续保存原始抓拍图。
2. `report_inspection.metadata_json` 保存 payload evidence、原图、provider metadata、raw result json。
3. `report_issue.image_url` 保存问题当前主展示图，优先使用 issue 或关联 inspection 的 evidence。
4. `report_issue.metadata_json` 保存 issue evidence、来源、原图、extra_json。
5. `captures.preview_url/capture_url` 不被标注图覆盖。
6. `provider_meta.source_render_image_url` 仅用于排障，不作为优先展示字段。
7. `raw_payload` 继续完整保留，作为最终追溯来源。

## 11. 本次迭代上线范围

本次迭代目标是完整实现并上线 V5 标注图适配能力。可以分步开发、分步测试、分步合并，但不能只上线其中一个局部阶段；对复核人员开放前必须完成本节全部范围。

本次上线必须包含：

1. 接收并保留 V5 扩展字段。
2. 同一 capture 多技能多标注图不串图。
3. 技能 tab 切换主图。
4. 当前技能原图和标注图对照。
5. 问题图、复核弹窗、整改单预览使用当前技能或问题对应图片。
6. 未稳定资产人工覆盖发布的最小风险提示。
7. 运行时图片加载失败回退原图。
8. 旧报告兼容回退。

本次上线不包含：

1. artifact 表。
2. v3 payload。
3. OSS 二次签发。
4. 历史数据迁移。
5. 独立技术排障管理页。

## 12. 分步开发与测试计划

以下步骤是开发和测试拆分，不是分期上线拆分。步骤 1 可以先合并为技术底座，但不能单独作为业务上线版本；步骤 1 到步骤 3 全部完成后，才满足本次迭代上线门槛。步骤 4 是后续 v3 演进预案，不属于本次上线范围。

### 步骤 1：契约接收与入库保留

目标：`report-system` 不丢 V5 扩展字段。

范围：

1. 扩展 schema 和 types。
2. 入库保留 inspection evidence、issue evidence、provider_meta、raw_result_json。
3. `report_issue.image_url` 使用正确证据图。
4. 增加 schema parse、normalizer 和详情数据返回测试。

### 步骤 2：详情页展示闭环

目标：复核人员能按技能看到对应标注图。

范围：

1. 技能 tab 切换主图。
2. 原图和标注图对照。
3. 图片加载失败 fallback。
4. 复核弹窗使用当前实际展示图；整改单预览默认使用 issue/inspection evidence，失败时回退原图并提示。
5. 最小风险提示。

### 步骤 3：运营风险增强

目标：运营人员更容易识别和追踪不稳定证据图。

范围：

1. 更完整的证据图状态标签。
2. 覆盖原因展示优化。
3. 报告详情内的证据图状态汇总。
4. 不稳定证据图的业务文案验收。

### 后续预案：v3 artifacts 适配

触发条件：`vision-agent` 正式启用 `payload_version=3`。

范围：

1. 接收 `facts.artifacts`。
2. 设计 `report_artifact` 或统一资产表。
3. 支持 `inspection.primary_artifact_id`。
4. 支持标注图、热力图、裁剪图等多资产类型。

## 13. 验收标准

### 13.1 契约接收

给定一个 `payload_version=2` payload，包含 `facts.inspections[].evidence_image_url`、`provider_meta`、`raw_result_json`，当发布到 `report-system` 后：

1. 发布成功。
2. inspection metadata 中保留 payload evidence。
3. provider metadata 未丢失。
4. raw result json 未丢失。

### 13.2 多技能多图

给定同一 capture 下两个 inspections：

```text
skill-a -> https://oss.example.com/a.jpg
skill-b -> https://oss.example.com/b.jpg
```

当用户在详情页切换技能时：

1. 选择 skill-a 展示 a.jpg。
2. 选择 skill-b 展示 b.jpg。
3. 两个技能的问题、复核预览和整改单预览不串图。

### 13.3 issue 关联

给定两个 issue 分别关联不同 `inspection_id`，当查看问题或生成整改单时：

1. issue A 使用 inspection A 的标注图。
2. issue B 使用 inspection B 的标注图。
3. 缺失 issue evidence 时回退关联 inspection evidence。

### 13.4 原图回退

给定 inspection 没有 `evidence_image_url`，当打开详情页时：

1. 展示原始抓拍图。
2. 提示 `标注图不可用，当前为原图`。
3. 复核流程仍可使用。

### 13.5 运行时加载失败

给定标注图 URL 返回 403/404 或加载失败，当页面渲染图片时：

1. 自动回退原图。
2. 提示 `标注图加载失败，当前为原图`。
3. 不阻断复核提交。

### 13.6 未稳定资产

给定 `provider_meta.unstable_evidence=true` 或 `extra_json.unstable_evidence=true`，当查看报告详情时：

1. 展示长期可访问性风险提示。
2. 展示覆盖原因。
3. 不展示 object key、request id 等技术字段。

### 13.7 旧数据兼容

给定旧 V4 payload 或不含 evidence 字段的历史报告，当打开报告详情时：

1. 页面正常展示原图。
2. 无错误提示。
3. 复核和筛选能力不回归。

## 14. 待确认项

1. 本次上线是否需要在报告列表中增加“存在不稳定证据图”筛选或提示。本需求建议不纳入本次上线。
2. 客户查看页面是否存在独立视图。如果存在，应同步应用“不展示技术字段”和“风险业务文案”规则。
3. 整改单下发到外部系统时是否也要携带标注图 URL。本需求仅覆盖 `report-system` 内部预览和复核链路。
4. 是否需要受控调试入口查看 object key、request id。本次上线不提供 UI 调试入口，仅保留 DB、raw payload 和服务端日志排障。
