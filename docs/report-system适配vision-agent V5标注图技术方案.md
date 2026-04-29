# report-system 适配 vision-agent V5 标注图技术方案

## 1. 背景

`vision-agent` 首期 V5 发布仍使用 `payload_version=2`，但在 `facts.inspections[]` 和 `facts.issues[]` 中增加技能级证据图字段。`report-system` 需要在不引入 `facts.artifacts` 的前提下完成最小适配。

核心技术约束：

1. `report_image` 继续表示原始抓拍图。
2. `report_inspection` 表示技能识别事实，保存技能级标注图元数据。
3. `report_issue.image_url` 表示问题当前主展示图，可指向标注图。
4. `evidence_image_url` 只保存 payload 传入的证据图，不写入 fallback 结果。
5. 展示层单独计算 `display_image_url`。

## 2. 当前差距

### 2.1 schema 丢字段

当前 `backend/report/report.schema.ts` 未声明：

```text
inspection.evidence_image_url
inspection.evidence_image_source
inspection.original_image_url
inspection.raw_result_json
inspection.provider_meta
issue.evidence_image_url
issue.evidence_image_source
issue.original_image_url
```

Zod object 默认会剥离未声明字段，导致后续 normalizer 无法读取 V5 证据图。

### 2.2 normalizer 仍按 capture 图展示

当前 `resolveDisplayUrl(capture)` 只读：

```text
capture.preview_url
-> capture.capture_url
```

这无法表达同一 capture 下多个技能分别对应不同标注图。

### 2.3 前端主图固定在 result 级别

结果详情页当前通过 selected result 的 `display_url` 计算主图。active inspection 变化不会影响主图，因此技能 tab 切换不会切换图片。

### 2.4 API 出参链路未显式约束

即使后端把 evidence 写入 `metadata_json`，仍需要确认详情查询返回：

```text
ReportInspection.metadata
ReportIssue.image_url
ReportIssue.metadata
```

否则 UI 无法消费。

## 3. 设计原则

1. 保持 v2 最小适配，不提前实现 v3。
2. 不新增 DB 表，优先复用 `metadata_json`。
3. payload 原始字段和展示计算字段分离。
4. 接收宽松，标准化严格。
5. UI 默认展示业务文案，不展示技术字段。
6. 测试覆盖 schema、normalizer、详情接口和前端主图选择。

## 4. 字段语义

为避免证据图语义被 fallback 污染，技术实现统一使用三类字段：

| 字段 | 来源 | 是否落库 | 含义 |
|---|---|---|---|
| `payloadEvidenceUrl` | `facts.inspections[].evidence_image_url` 或 `facts.issues[].evidence_image_url` | 是 | payload 原始证据图。没有则为空。 |
| `originalImageUrl` | `original_image_url` 或 capture 原图 | 是 | 原始抓拍图。 |
| `displayImageUrl` | 展示层按优先级计算 | 可存在 metadata，不能覆盖 evidence | 当前实际展示图。 |

禁止行为：

```text
metadata.evidence_image_url = evidence_image_url || original_image_url || capture_url
```

允许行为：

```text
metadata.evidence_image_url = payload evidence only
metadata.display_image_url = evidence || original || capture
```

## 5. 发布契约与 schema

### 5.1 schema 扩展

文件：

```text
backend/report/report.schema.ts
```

建议新增 JSON object schema：

```ts
const jsonObjectSchema = z.record(z.string(), jsonSchema);
```

`inspectionFactSchema` 增加：

```ts
evidence_image_url: z.string().trim().optional(),
evidence_image_source: z.string().trim().optional(),
original_image_url: z.string().trim().optional(),
raw_result_json: jsonSchema.optional(),
provider_meta: jsonObjectSchema.optional()
```

`issueFactSchema` 增加：

```ts
evidence_image_url: z.string().trim().optional(),
evidence_image_source: z.string().trim().optional(),
original_image_url: z.string().trim().optional()
```

入参阶段不强制 URL 校验，原因：

1. 历史 payload 可能包含 `oss://`、相对路径或代理 URL。
2. V5 人工覆盖发布可能带临时 URL。
3. `report-system` 不负责验证远端图片长期有效性。

normalizer 阶段必须通过 `safeString` 过滤空值。

### 5.2 TypeScript 类型

文件：

```text
backend/report/report.types.ts
```

`ReportInspectionFact` 增加：

```ts
evidence_image_url?: string;
evidence_image_source?: string;
original_image_url?: string;
raw_result_json?: JsonValue;
provider_meta?: Record<string, JsonValue>;
```

`ReportIssueFact` 增加：

```ts
evidence_image_url?: string;
evidence_image_source?: string;
original_image_url?: string;
```

`ReportInspection` 首期不新增顶层字段，前端从 `metadata` 读取。

## 6. normalizer 设计

文件：

```text
backend/report/report-publish-normalizer.ts
```

### 6.1 lookup

新增 lookup：

```ts
const inspectionsById = new Map<string, ReportInspectionFact>();
const inspectionsByCaptureAndSkill = new Map<string, ReportInspectionFact>();

facts.inspections.forEach((inspection) => {
  inspectionsById.set(inspection.inspection_id, inspection);
  inspectionsByCaptureAndSkill.set(`${inspection.capture_id}::${inspection.skill_id}`, inspection);
});
```

issue 关联优先级：

```text
issue.inspection_id
-> issue.capture_id + issue.skill_id
-> capture fallback
```

### 6.2 payload 校验

normalizer 在映射前必须先做确定性校验，避免重复 key 被 `Map` 静默覆盖。

校验规则：

1. `facts.captures[].capture_id` 在单个 payload 内重复时，拒绝发布并返回明确错误。
2. `facts.inspections[].inspection_id` 在单个 payload 内重复时，拒绝发布并返回明确错误。
3. `facts.issues[].issue_id` 在单个 payload 内重复时，拒绝发布并返回明确错误。
4. `inspection.capture_id` 无法关联 capture 时，不拒绝发布，但该 inspection 的图片展示只能降级，并在 metadata 中记录 `missing_capture=true`。
5. `issue.inspection_id` 无法关联 inspection 时，不拒绝发布，按 `capture_id + skill_id` 降级匹配；仍无法匹配时回退 capture，并在 metadata 中记录 `missing_inspection=true`。
6. 重复 ID 不允许 last-write-wins，因为这会在多技能多图场景下造成串图且难以排查。

### 6.3 helper

建议实现：

```ts
function resolveOriginalImageUrl(capture: ReportCaptureFact | undefined, explicitOriginal = ""): string {
  return (
    safeString(explicitOriginal) ||
    safeString(capture?.capture_url) ||
    safeString(capture?.preview_url) ||
    normalizeDisplayImageUrl(capture?.local_path) ||
    ""
  );
}

function resolveCaptureDisplayUrl(capture: ReportCaptureFact | undefined): string {
  return resolveDisplayUrl(capture) === "about:blank" ? "" : resolveDisplayUrl(capture);
}

function resolveInspectionEvidence(
  inspection: ReportInspectionFact,
  capture: ReportCaptureFact | undefined
) {
  const payloadEvidenceUrl = safeString(inspection.evidence_image_url);
  const originalImageUrl = resolveOriginalImageUrl(capture, inspection.original_image_url);
  const captureDisplayUrl = resolveCaptureDisplayUrl(capture);
  const displayImageUrl = payloadEvidenceUrl || originalImageUrl || captureDisplayUrl;

  return {
    payloadEvidenceUrl,
    evidenceImageSource: safeString(inspection.evidence_image_source),
    originalImageUrl,
    displayImageUrl,
    providerMeta: isJsonObject(inspection.provider_meta) ? inspection.provider_meta : {},
    rawResultJson: inspection.raw_result_json ?? {}
  };
}
```

注意：`payloadEvidenceUrl` 和 `displayImageUrl` 必须分开。

### 6.4 inspection 映射

`NormalizedInspectionRecord.metadata` 增加：

```ts
{
  evidence_image_url: evidence.payloadEvidenceUrl,
  evidence_image_source: evidence.evidenceImageSource,
  original_image_url: evidence.originalImageUrl,
  display_image_url: evidence.displayImageUrl,
  provider_meta: evidence.providerMeta,
  raw_result_json: evidence.rawResultJson
}
```

`display_image_url` 可以是 fallback 结果；`evidence_image_url` 只能是 payload evidence。

### 6.5 issue 映射

issue 主图解析：

```ts
const linkedInspection =
  inspectionsById.get(issue.inspection_id) ||
  inspectionsByCaptureAndSkill.get(`${issue.capture_id}::${safeString(issue.skill_id)}`);

const linkedEvidence = linkedInspection
  ? resolveInspectionEvidence(linkedInspection, capture)
  : null;

const payloadIssueEvidenceUrl = safeString(issue.evidence_image_url);
const issueOriginalImageUrl = resolveOriginalImageUrl(capture, issue.original_image_url);
const imageUrl =
  payloadIssueEvidenceUrl ||
  linkedEvidence?.payloadEvidenceUrl ||
  issueOriginalImageUrl ||
  linkedEvidence?.originalImageUrl ||
  resolveCaptureDisplayUrl(capture);
```

`NormalizedIssueRecord`：

```ts
image_url: imageUrl || null,
metadata: {
  evidence_image_url: payloadIssueEvidenceUrl,
  linked_inspection_evidence_image_url: linkedEvidence?.payloadEvidenceUrl || "",
  evidence_image_source: safeString(issue.evidence_image_source) || linkedEvidence?.evidenceImageSource || "",
  original_image_url: issueOriginalImageUrl || linkedEvidence?.originalImageUrl || "",
  display_image_url: imageUrl,
  extra_json: issue.extra_json ?? {}
}
```

`report_issue.image_url` 明确表示“问题当前主展示图”，不要求与 `report_image.url` 一致。

## 7. DB 映射

首期不新增表。

### 7.1 report_image

保持现状：

```text
url = capture preview/capture display URL
metadata.capture_url = payload capture_url
metadata.preview_url = payload preview_url
metadata.display_url = capture display URL
```

不写入技能标注图。

### 7.2 report_inspection

使用现有字段：

```text
inspection_id
skill_id
skill_name
status
raw_result
error_message
metadata_json
```

`metadata_json` 保存：

```json
{
  "capture_id": "capture-000001",
  "image_id": "img-v5-001",
  "channel_code": "baidu_yijian_v5",
  "evidence_image_url": "payload evidence only",
  "evidence_image_source": "oss_rendered",
  "original_image_url": "https://hyy.example.com/capture.jpg",
  "display_image_url": "https://vision-check.oss-cn-shanghai.aliyuncs.com/...",
  "provider_meta": {
    "evidence_asset_status": "uploaded"
  },
  "raw_result_json": {
    "requestId": "req-v5-001"
  }
}
```

### 7.3 report_issue

使用现有字段：

```text
image_url = issue/inspection 当前主展示图
metadata_json.extra_json = payload extra_json
metadata_json.evidence_image_url = payload issue evidence only
metadata_json.display_image_url = issue 当前主展示图
```

## 8. API 出参

详情页当前通过 repository 返回 `ReportDetail`。首期需要确认并保持以下出参：

```text
ReportDetail.results[].metadata
ReportDetail.inspections[].metadata
ReportDetail.issues[].image_url
ReportDetail.issues[].metadata
```

如果已有 repository 已返回这些字段，则只需补测试确认。如果某层 DTO 后续新增过滤，需要明确不能剥离上述 metadata。

字段流转表：

| payload 字段 | 入库位置 | API 出参 | UI 使用 |
|---|---|---|---|
| `facts.inspections[].evidence_image_url` | `report_inspection.metadata_json.evidence_image_url` | `ReportInspection.metadata.evidence_image_url` | active inspection 标注图 |
| `facts.inspections[].original_image_url` | `report_inspection.metadata_json.original_image_url` | `ReportInspection.metadata.original_image_url` | 查看原图和 fallback |
| `facts.inspections[].provider_meta` | `report_inspection.metadata_json.provider_meta` | `ReportInspection.metadata.provider_meta` | 风险状态和排障 |
| `facts.issues[].evidence_image_url` | `report_issue.metadata_json.evidence_image_url` 和可能的 `image_url` | `ReportIssue.image_url`、`ReportIssue.metadata` | 问题图 |
| `facts.issues[].extra_json` | `report_issue.metadata_json.extra_json` | `ReportIssue.metadata.extra_json` | 风险原因 |

## 9. 前端设计

### 9.1 helper

文件：

```text
ui/report/report-detail-helpers.ts
```

新增或扩展：

```ts
export function readInspectionEvidenceUrl(inspection: ReportInspection): string;
export function readInspectionOriginalImageUrl(inspection: ReportInspection): string;
export function readInspectionDisplayImageUrl(inspection: ReportInspection): string;
export function readInspectionEvidenceSource(inspection: ReportInspection): string;
export function readInspectionProviderMeta(inspection: ReportInspection): Record<string, unknown>;
export function readIssueExtraJson(issue: ReportIssue): Record<string, unknown>;
```

### 9.2 主图状态模型

建议使用显式状态：

```ts
type ResultImageMode = "evidence" | "original";
type ResultImageState = "evidence" | "original" | "evidence_missing_fallback" | "evidence_failed_fallback";
```

计算顺序：

```text
mode=evidence:
  activeInspection.evidence_image_url
  -> activeInspection.original_image_url
  -> result.display_url
  -> result.url

mode=original:
  activeInspection.original_image_url
  -> result.display_url
  -> result.url
```

切换技能时：

```text
imageMode 重置为 evidence
```

或者：

```text
imageMode 绑定 active inspection，例如 inspection=xxx&imageMode=original
切换 inspection 链接不带 imageMode
```

### 9.3 运行时图片失败

图片加载失败状态必须由结果详情页统一管理，不能只在 `<img onError>` 内部替换图片。统一状态需要传给主图、复核弹窗和整改单预览，避免预览组件仍使用失败的 evidence URL。

图片组件需要支持 `onError`：

```text
当前展示 evidence 且加载失败
-> 回退 original
-> state=evidence_failed_fallback
-> 展示“标注图加载失败，当前为原图”
```

如果原图也失败：

```text
显示图片不可用占位
```

### 9.4 风险提示

风险状态读取：

```text
active issue extra_json
-> active inspection provider_meta
```

展示文案：

```text
标注图尚未完成云存储，长期可访问性存在风险。
原因：{evidence_asset_override_reason}
```

普通页面不展示 object key、request id、asset id。

### 9.5 复核和整改单预览

`ResultReviewWorkflow.currentImageUrl` 应传入统一图片状态解析后的当前实际展示图，而不是 result 原图或失败的 evidence URL。

整改单预览和下发默认使用 issue/inspection evidence。只有 evidence 缺失或运行时加载失败时，才回退原图并展示降级提示。用户临时切换到“查看原图”不应改变整改单默认证据图选择。

## 10. 分步开发与测试

本次迭代需要完整实现并上线 V5 标注图适配能力。以下步骤用于开发、测试和合并拆分，不代表可以按步骤分别业务上线。步骤 1 完成后只能作为技术底座；步骤 1 到步骤 3 全部完成并通过验收后，才可对复核人员和运营人员开放。

### 步骤 1：契约接收、入库和 API 出参

目标：系统完整保留 V5 evidence 数据，并能从详情 API 读出。

改动：

1. 扩展 `report.schema.ts`。
2. 扩展 `report.types.ts`。
3. normalizer 增加 inspection evidence、issue evidence 映射。
4. 保证 `ReportDetail` 出参包含 metadata 和 issue image_url。
5. 增加 schema parse、normalizer、repository/detail API 测试。

验收：

1. V5 v2 payload 发布成功。
2. 扩展字段没有被 Zod 剥离。
3. DB 和详情出参均可读取 evidence。
4. issue.image_url 是问题主图。

### 步骤 2：详情页展示闭环

目标：用户能按技能查看对应标注图。

改动：

1. 增加前端 helper。
2. 调整结果详情页 active inspection 主图计算。
3. 技能切换时主图同步切换。
4. 原图/标注图对照。
5. 图片加载失败 fallback。
6. 复核弹窗使用当前实际展示图；整改单预览默认使用 issue/inspection evidence。
7. 最小风险提示。

验收：

1. 同一 capture 两个技能显示两张不同标注图。
2. 切换技能不串图。
3. 原图对照可用。
4. evidence URL 加载失败时回退原图。
5. 复核预览图与当前技能一致。
6. 整改单预览默认使用当前问题或技能的 evidence，只有 evidence 缺失或运行时加载失败时才回退原图。

### 步骤 3：运营风险增强

目标：提升不稳定证据图的可见性和追踪能力。

改动：

1. 证据图状态标签。
2. 报告详情证据图状态汇总。
3. 人工覆盖原因的业务文案展示。
4. 不稳定证据图的报告详情汇总提示。

验收：

1. `uploaded` 状态不展示风险提示。
2. `failed`、`pending`、`uploading`、`disabled` 状态展示业务风险文案。
3. 普通业务页面不展示 object key、request id、asset id。
4. 运营人员能在详情页识别哪些结果存在不稳定证据图。

### 后续预案：v3 artifacts

触发条件：`vision-agent` 正式发布 `payload_version=3`。

改动：

1. 支持 `facts.artifacts` schema。
2. 设计 `report_artifact` 或统一资产表。
3. 支持 `inspection.primary_artifact_id`。
4. 支持多资产类型展示。

## 11. 测试方案

### 11.1 schema parse 测试

新增用例：

1. `reportPublishSchema.safeParse()` 后，inspection evidence 字段仍存在。
2. issue evidence 字段仍存在。
3. provider_meta 中嵌套 JSON 不丢失。
4. 空字符串不会导致发布失败，但 normalizer 会过滤。

### 11.2 normalizer 测试

新增用例：

1. 一张 capture 两个 inspections，各自保存不同 evidence。
2. `metadata.evidence_image_url` 不写 fallback 值。
3. `metadata.display_image_url` 可写 fallback 后的展示图。
4. issue evidence 优先级正确。
5. issue 缺失 evidence 时回退 linked inspection evidence。
6. linked inspection 缺失时回退原图。
7. provider_meta、raw_result_json、extra_json 保留。

### 11.3 repository/detail API 测试

新增用例：

1. 发布后调用详情查询，`ReportInspection.metadata.evidence_image_url` 存在。
2. `ReportIssue.image_url` 为标注图。
3. `ReportIssue.metadata.extra_json.unstable_evidence` 存在。

### 11.4 前端纯函数测试

如当前测试栈不适合组件测试，先抽纯函数：

```ts
resolveResultImageState({
  selectedResult,
  activeInspection,
  mode,
  loadFailed
})
```

覆盖：

1. evidence 优先。
2. original mode 展示原图。
3. evidence 缺失 fallback。
4. evidence 加载失败 fallback。
5. 切换 active inspection 后 URL 改变。

### 11.5 回归测试

1. 原有 `npm test`。
2. `npm run typecheck`。
3. 手工验证报告详情、单条结果页、复核弹窗、整改单预览。

## 12. 实施风险

1. Zod schema 未扩展会直接丢字段，因此必须先做 schema parse 测试。
2. 如果把 fallback 写入 `evidence_image_url`，前端无法判断“无标注图”，必须避免。
3. 如果 `imageMode` 是全局 query，可能破坏技能切换默认回到标注图的规则。
4. 如果 issue 只按 `capture_id` 关联，会在多技能场景串图，必须优先用 `inspection_id`。
5. 如果只验证 DB，不验证详情 API，前端仍可能拿不到 evidence。
6. 人工覆盖发布可能带临时 URL，运行时加载失败 fallback 必须纳入本次上线。

## 13. 开发检查清单

步骤 1 完成前：

1. `reportPublishSchema` 保留 V5 扩展字段。
2. `ReportInspectionFact` 和 `ReportIssueFact` 类型已扩展。
3. `normalizePublishedReport()` 区分 payload evidence 和 display image。
4. `report_inspection.metadata_json` 有 evidence 和 provider_meta。
5. `report_issue.image_url` 按 issue/inspection evidence 优先。
6. 详情 API 能返回 inspection metadata 和 issue image_url。
7. schema parse、normalizer、detail API 测试通过。

步骤 2 完成前：

1. 技能 tab 切换主图。
2. 原图/标注图对照。
3. 图片加载失败 fallback。
4. 风险提示首期可见。
5. 复核弹窗和整改单预览图与当前技能一致。
6. 前端主图选择测试或手工验收完成。

本次上线前：

1. 步骤 1 到步骤 3 全部完成，不只上线技术底座。
2. 多技能同 capture 场景完成端到端验收，确保每个技能的识别结构对应自己的标注图。
3. 重复或缺失 `inspection_id` 的 payload 被拒绝或进入明确错误状态，不静默串图。
4. 复核弹窗、整改单预览、问题图和详情主图的图片来源规则一致。
5. evidence 缺失、evidence 加载失败、原图也不可用三个降级路径均有提示。
6. 业务页面不展示数据库 ID、object key、request id、raw JSON 等技术字段。
7. schema、normalizer、detail API、前端图片解析测试或等价手工验收通过。
