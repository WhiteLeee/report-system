# Report System 项目级品牌配置改造方案

## 1. 背景与目标
- 当前品牌信息（企业名、Logo、主配色）主要来自部署配置，无法在系统管理内在线维护。
- 本次目标是新增“项目级（单租户级）品牌配置”，由 `admin` 在系统管理中统一配置后，对所有用户全局生效且表现一致。

## 2. 范围与边界
### 2.1 本次范围
- 在系统管理增加“企业品牌配置”Tab。
- 配置项包含：
  - 企业名称
  - Logo（上传）
  - Favicon / Browser Icon（上传）
  - 主配色（含主色与深色）
- 配置生效范围：全项目、全用户统一可见。

### 2.2 明确不做
- 不做用户级个性化主题。
- 不做多租户隔离品牌配置。
- 不做完整 design token 引擎（只覆盖本次业务需要的品牌变量）。

## 3. 强制实施约束（必须遵守）
- 本需求的 UI 改造与新增组件，**必须使用 shadcn-ui 技能执行**。
- 具体要求：
  - 优先复用 `components/ui/*` 现有组件。
  - 缺失基础组件时，按 shadcn 规范补最小可复用组件。
  - 禁止继续新增散落的非 shadcn 交互组件实现。

## 4. 方案设计
### 4.1 配置存储
- 继续复用 `system_setting` 表，新增配置键：
  - `enterprise_branding_v1`
- `value_json` 示例：
```json
{
  "enterpriseName": "某某企业",
  "logoUrl": "/uploads/branding/logo-20260409.png",
  "faviconUrl": "/uploads/branding/favicon-20260409.ico",
  "primaryColor": "#8b5a2b",
  "primaryColorStrong": "#6b421d",
  "updatedBy": "admin",
  "updatedAt": "2026-04-09T08:00:00.000Z"
}
```

### 4.2 文件上传与静态访问
- 上传入口放在系统管理的“企业品牌配置”Tab 内。
- 上传目标目录：`public/uploads/branding/`。
- 命名策略：`{type}-{timestamp}.{ext}`，避免覆盖历史文件。
- 访问路径统一使用站内相对路径（如 `/uploads/branding/logo-*.png`）。
- 安全限制：Logo 仅支持 `png/jpg/jpeg/webp`，favicon 仅支持 `ico/png`，并做服务端文件内容校验。

### 4.3 生效机制
- `app/layout.tsx` 在服务端读取品牌配置，并注入 CSS 变量：
  - `--brand`
  - `--brand-strong`
- 页面头部、系统标题、登录页品牌展示统一读取同一份品牌配置。
- favicon 使用动态 metadata 读取配置值，确保浏览器标签页图标同步。

### 4.4 权限与审计
- 仅 `admin`（具备 `system:settings:write`）可编辑品牌配置。
- 其他角色可见但不可编辑（或不可进入该页，按现有系统管理权限策略执行）。
- 保存动作写入审计日志：
  - action: `system.settings.branding.update`
  - 记录 `before/after` 与操作人信息。

## 5. 页面交互（系统管理 > 企业品牌配置）
- 表单字段：
  - 企业名称（文本）
  - 主色（Color + 文本输入双控件）
  - 深色（Color + 文本输入双控件）
  - Logo 上传（显示当前图）
  - Favicon 上传（显示当前图）
- 操作按钮：
  - 上传并替换
  - 保存配置
  - 恢复默认（可选，若实施）
- 预览区域：
  - 展示标题、按钮、导航高亮、favicon 说明。

## 6. 迭代拆解清单
### 迭代 A：基础能力落地
- 新增 `enterprise_branding_v1` 类型定义、仓储读写、服务层校验。
- 新增系统设置 Tab 和保存路由分支。
- 增加审计日志埋点。

### 迭代 B：上传能力落地
- 增加 Logo/Favicon 上传接口。
- 增加文件类型、大小、安全校验。
- 表单接入上传与回显。

### 迭代 C：全局生效
- layout 动态注入品牌变量。
- metadata favicon 动态化。
- DashboardHeader、登录页、关键入口统一读取品牌配置。

### 迭代 D：回归与文档
- 权限回归（admin / reviewer / viewer）。
- UI 回归（桌面端/移动端）。
- 文档补充（README + docs）。

## 7. 验收标准
- admin 可在系统管理完成品牌配置保存。
- Logo 与 favicon 上传后可在页面和浏览器标签页正确显示。
- 主色和深色调整后，关键品牌位即时生效（刷新页面后一致）。
- 非 admin 无法修改品牌配置。
- 全站用户看到同一套品牌信息，不存在用户间差异。

## 8. 风险与控制
- 风险：上传文件类型不受控导致展示异常。
  - 控制：限制 MIME、扩展名、文件大小，并进行服务端校验。
- 风险：旧页面仍有硬编码颜色导致“局部不一致”。
  - 控制：迭代 C 同步梳理关键页面，优先替换导航/按钮/标题等品牌位。
- 风险：favicon 缓存导致“看起来未生效”。
  - 控制：生成带版本参数的 favicon URL（如 `?v=updatedAt`）。

## 9. 结论
- 该改造是“中等规模、低业务风险”的配置型增强。
- 采用“系统管理集中配置 + 全局统一生效”的方案，满足单租户项目级品牌管理诉求。
- 后续如进入“全站 UI 统一化”阶段，继续按 **shadcn-ui 技能** 执行可控推进。
