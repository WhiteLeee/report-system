# Frontend UI Standards

## 1. 目标

本项目后续前端开发统一以 `shadcn/ui` 作为基础组件标准。
目标不是“复制 shadcn 示例页面”，而是：

- 用 `shadcn/ui` 重建基础组件体系
- 保留 report-system 自己的业务结构和信息组织方式
- 避免重新堆积全局样式和无序的页面内联样式

## 2. 当前基线

当前项目前端基线：

- `components.json` 使用 `new-york`
- Tailwind 采用 v4 方式接入
- 组件目录固定为 `@/components/ui`
- 公共工具固定为 `@/lib/utils`
- 主题配置按 `cssVariables: true` 约定维护

## 3. 新代码规则

后续新增或重构前端代码时，遵守以下规则：

1. 基础交互组件优先使用 `@/components/ui`
   包括按钮、输入框、文本域、下拉、卡片、标签、弹层、抽屉、表格外壳等。

2. 不再新增旧式全局交互类
   不再往 `app/globals.css` 添加 `.button`、`.pill`、`.status-pill`、`.tag-pill` 这类业务耦合类名。

3. 页面样式优先放页面级 `*.module.css`
   单页独有布局、尺寸、断点、视觉调整都放页面级样式，不污染全局。

4. 全局样式只保留抽象层
   `globals.css` 只允许保留设计 token、reset、布局基线、真正跨页面复用的抽象结构。

5. 业务状态和空态优先复用现有业务组件
   当前统一使用：
   - `@/ui/review-status-badge`
   - `@/components/ui/empty-state`

6. 能复用就不要重复造
   如果某个结构会在两个以上页面重复出现，应优先抽成业务组件或基础组件，而不是继续复制 JSX。

7. 第三方 UI 依赖必须收口到 `components/ui`
   `app/` 与 `ui/` 业务层禁止直接 `import` 以下依赖：
   - `recharts`
   - `lucide-react`
   - `react-day-picker`
   - `@radix-ui/*`
   业务层统一从 `@/components/ui/*` 引入对应封装。
   示例：
   - 图表能力走 `@/components/ui/chart`
   - 图标走 `@/components/ui/icons`
   - 日历能力走 `@/components/ui/calendar`

## 4. 推荐迁移顺序

继续重构时，按下面顺序推进：

1. 先替换基础交互组件
2. 再收页面级布局
3. 最后删旧全局样式和重复结构

## 5. 组件来源规则

如果后续继续接入新的 shadcn 组件，优先遵循当前官方配置方向：

- 使用 `new-york` style
- 优先保持 Tailwind v4 兼容
- 组件落到 `@/components/ui`
- 业务包装层放 `ui/` 或页面目录内

## 6. 禁止事项

- 不要把业务页面整体替换成 shadcn 示例页面
- 不要为单页需求继续堆全局 class
- 不要在多个页面重复手写同一套状态 badge、空态、筛选区结构
- 不要在 `app/` 或 `ui/` 直接引入 `recharts`、`lucide-react`、`react-day-picker`、`@radix-ui/*`

## 7. 自动检查

已提供依赖边界检查脚本，并接入 `prebuild`/`pretest`：

```bash
npm run check:ui-imports
```

CI 会在 GitHub Actions 运行 `Frontend Guard` 工作流。要启用“阻塞合并”，请在仓库分支保护中把检查项 `UI Boundary And Typecheck` 设为 Required。

检查通过标准：
- `app/` 与 `ui/` 不出现上述第三方依赖的直接 import
- 第三方 UI 依赖只在 `components/ui` 封装层出现
