# Report System

Report System 是客户侧在线报告系统，负责接收 `vision-agent` 发布的巡检报告，并提供浏览器查看能力。

当前项目定位：

1. 接收 `vision-agent` 发布的“原子巡检事实数据 + 少量辅助汇总”
2. 使用 SQLite 落库存储已发布报告
3. 提供报告列表页、详情页、发布状态查询接口和图片级复检能力
4. 不承担巡检生产能力，不接入抓拍、调度、计划管理等后台功能

当前运行时约定：

1. `vision-agent` 必须显式发送 `payload_version`
2. `report-system` 只接收本实例声明支持的 `payload_version`
3. `payload_version` 是双边接口契约版本，不等于业务报告的 `report_version`

## 1. 项目边界

### 1.1 当前已实现

- 发布接收：`POST /api/reports/publish`
- 发布状态查询：`GET /api/reports/publish-status`
- 报告列表：`GET /api/reports` + `/reports`
- 报告详情：`GET /api/reports/{id}` + `/reports/{id}`
- 图片复检写入：`POST /api/reports/{reportId}/images/{imageId}/review-status`
- 最近复检记录：`GET /api/reports/{reportId}/review-logs`
- SQLite 存储：`report / report_store / report_image / report_issue / report_review_log`

### 1.2 当前未实现

- API 鉴权
- 细粒度摄像头表 / 巡检表独立建模
- OSS 签名访问控制

## 2. 技术栈

- Next.js 16
- React 19
- TypeScript
- better-sqlite3
- Drizzle ORM
- Zod

## 3. 项目结构

```text
report-system/
├── app/
│   ├── api/reports/                  # 发布、查询接口
│   └── reports/                      # 列表页、详情页
├── backend/
│   ├── auth/                         # 请求上下文
│   ├── database/                     # SQLite / schema / migrate
│   ├── report/                       # 报告领域、schema、service、repository
│   └── shared/                       # 通用 JSON 类型
├── drizzle/                          # 迁移文件
├── scripts/                          # 本地数据库与初始化脚本
└── ui/                               # 页面展示辅助函数
```

## 3.1 领域设计文档

- [docs/report-review-state-refactor.md](/Users/wick/Desktop/ZhiQing Selection/SourceCode/report-system/docs/report-review-state-refactor.md)
  说明：批次、门店、巡检结果三级复核状态重构方案，以及快照和扩展字段的建模原则。

## 4. 数据模型说明

### 4.1 持久化表

- `report`
- `report_store`
- `report_image`
- `report_issue`

### 4.2 当前存储策略

当前采用“兼容式落库”：

1. `vision-agent` 发布的是原子事实数据
2. `report-system` 通过规范化层，把原子事实映射到现有四张报告表
3. 同时把完整原始 payload 存入 `report.raw_payload_json`
4. 图片级复检状态直接写回 `report_image.review_status`，并生成 `report_review_log`

这样做的目的：
- 先跑通完整发布链路
- 保持页面结构简单
- 为后续独立扩展 `camera / inspection` 等细粒度表预留空间
- 给图片级复检保留独立日志和回溯能力

## 5. 当前发布契约

`vision-agent` 当前发送的 payload 顶层结构：

```json
{
  "source_system": "vision-agent",
  "payload_version": 2,
  "idempotency_key": "...",
  "published_at": "2026-03-25 13:00:00",
  "publish_dir": "data/report_publish/2026-03-25/001",
  "report": {
    "report_meta": {},
    "summary": {},
    "facts": {
      "stores": [],
      "cameras": [],
      "captures": [],
      "inspections": [],
      "issues": []
    }
  }
}
```

### 5.1 `report_meta`

表示报告基本信息：
- `report_type`
- `topic`
- `plan_id`
- `plan_name`
- `report_versions`
- `enterprise_id`
- `enterprise_name`
- `start_date`
- `end_date`
- `operator`
- `generated_at`

### 5.2 `summary`

少量辅助汇总：
- `metrics`
- `trend`
- `issue_distribution`

### 5.3 `facts`

原子事实数据：
- `stores`
- `cameras`
- `captures`
- `inspections`
- `issues`

### 5.4 当前结果语义约定

`vision-agent` 当前会同时发送 `captures.issue_count` 和 `inspections.status/raw_result/error_message/total_issues`。

`report-system` 的展示与复核默认按下面规则解释单张图片结果：

- 存在 `issues`：视为 `发现问题`
- 无 `issues`，但 inspection 明确失败或有错误信息：视为 `巡检失败`
- 无 `issues`，但 inspection 命中“目标缺失 / 无法判断 / 低置信度”等语义：视为 `无法判定`
- 其余无 `issues` 且 inspection 正常完成：视为 `未发现问题`

因此，`0 问题` 不再等价于“业务正常”，必须结合 inspection 结果一起判断。

## 6. 启动

### 6.1 安装依赖

```bash
npm install
```

### 6.2 初始化数据库

```bash
npm run db:migrate
```

### 6.3 单租户初始化

首次交付某个客户实例时，建议先执行：

```bash
npm run tenant:init -- \
  --tenant-id dlb \
  --tenant-name 德伦堡 \
  --brand-name 德伦堡巡检报告 \
  --base-url https://report-dlb.example.com \
  --logo-url https://cdn.example.com/dlb-logo.png \
  --data-dir ./data \
  --db-path ./data/report-system.sqlite \
  --supported-payload-versions 2 \
  --force
```

该命令会：

1. 生成 `.env.local`
2. 生成 `config/tenant.json`
3. 初始化 SQLite 所需目录
4. 自动执行 `npm run db:migrate`

### 6.4 本地快速重置

如果你在开发/测试过程中，需要“保留当前租户配置，但把 `.env.local`、`config/tenant.json` 和数据库一起重建”，直接执行：

```bash
npm run reinit:local
```

该命令会：

1. 读取当前项目已有租户配置作为默认值
2. 重写 `.env.local`
3. 重写 `config/tenant.json`
4. 删除并重建本地数据库
5. 自动执行 `npm run db:migrate`
6. 自动执行 `npm run auth:seed`

如果需要临时覆盖某些参数，也可以追加：

```bash
npm run reinit:local -- --tenant-id dlb --tenant-name 德伦堡
```

如果只想先预览会执行什么：

```bash
npm run reinit:local -- --dry-run
```

### 6.5 开发模式

```bash
npm run dev
```

### 6.6 生产模式

```bash
npm run build
npm run start
```

默认地址：
- [http://localhost:3000](http://localhost:3000)
- 报告列表页：[http://localhost:3000/reports](http://localhost:3000/reports)

### 6.7 生产部署示例命令

适用于单机 Linux 服务部署，`report-system` 作为客户侧在线报告系统运行：

```bash
cd /srv/report-system
npm install
npm run tenant:init -- \
  --tenant-id dlb \
  --tenant-name 德伦堡 \
  --brand-name 德伦堡巡检报告 \
  --base-url https://report-dlb.example.com \
  --force
npm run db:migrate
npm run build
PORT=3000 npm run start
```

如果你希望以后台方式持续运行，通常会配合 `systemd`、`supervisor` 或容器来托管上面的启动命令。
仓库已附带 systemd 示例文件：

- [deploy/report-system.service](/Users/wick/Desktop/ZhiQing%20Selection/SourceCode/report-system/deploy/report-system.service)
- [.env.example](/Users/wick/Desktop/ZhiQing%20Selection/SourceCode/report-system/.env.example)
- [config/tenant.example.json](/Users/wick/Desktop/ZhiQing%20Selection/SourceCode/report-system/config/tenant.example.json)

### 6.8 复检联调测试

```bash
npm test
```

该测试覆盖：

1. 发布报告后对单张图片标记复检状态
2. `report_review_log` 的落库与查询
3. 报告详情页上的最近复检记录渲染

## 7. 数据库

SQLite 文件位置：
- `data/report-system.sqlite`

常用命令：

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:reset:local
npm run reinit:local
npm test
```

说明：
- `db:generate`：根据 Drizzle schema 生成 migration
- `db:migrate`：执行 migration
- `db:studio`：打开 Drizzle Studio
- `db:reset:local`：重建本地 SQLite 数据库
- `reinit:local`：重建当前租户配置与本地数据库，适合测试阶段快速回到初始状态

## 7.1 `payload_version` 运行时兼容策略

这套策略与 `vision-agent` 一起对齐执行。

定义：
- `payload_version`：发布接口契约版本
- `report_version`：某一份业务报告快照版本

两者不是一回事，不能混用。

当前规则：
- `payload_version` 必须显式传入
- `report-system` 只接受 `REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS` 中声明支持的版本
- 当前默认支持版本：`2`
- 收到结构合法但版本不支持的 payload 时，返回 `422`

推荐配置方式：

```bash
REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS=2
```

也可以写入客户配置：

```json
{
  "supportedPayloadVersions": [2]
}
```

为什么这样做：
- 避免上游漏传版本时被静默当成默认值
- 避免 `vision-agent` 升级 payload 结构后，`report-system` 还按旧结构误解析
- 让双边升级时可以明确支持窗口，例如 `[2,3]`

职责边界：
- `vision-agent` 负责声明自己发送哪个 `payload_version`
- `report-system` 负责声明自己支持接收哪些 `payload_version`
- 版本差异的字段适配应收口在发布规范化层，而不是散落在 repository

## 8. API

### 8.1 接收发布

```http
POST /api/reports/publish
Content-Type: application/json
```

当前特性：
- 不启用鉴权
- 使用 `idempotency_key` 做幂等
- 重复发布同一键时直接返回已存在结果
- 仅接收当前实例支持的 `payload_version`

成功返回示例：

```json
{
  "ok": true,
  "report_id": 2,
  "action": "created",
  "publish_id": "565fbcaf...",
  "report_version": "2026-03-24~2026-03-24|management+operations",
  "received_at": "2026-03-25T05:37:38.289Z"
}
```

不支持的版本返回示例：

```json
{
  "success": false,
  "error": "Unsupported payload_version.",
  "received_payload_version": 3,
  "supported_payload_versions": [2]
}
```

### 8.2 发布状态查询

```http
GET /api/reports/publish-status?idempotency_key=...
```

返回示例：

```json
{
  "ok": true,
  "exists": true,
  "status": "published",
  "report_id": 2,
  "publish_id": "565fbcaf...",
  "report_version": "2026-03-24~2026-03-24|management+operations",
  "received_at": "2026-03-25T05:37:54.840Z"
}
```

### 8.3 报告列表

```http
GET /api/reports
```

支持筛选参数：
- `enterprise`
- `reportType`
- `reviewStatus`
- `startDate`
- `endDate`

### 8.4 报告详情

```http
GET /api/reports/{reportId}
```

## 9. 页面

当前前端可访问页面共 5 个。后续如果让我“改某个页面”，请直接说页面地址或页面名称。

### 9.1 `/`

用途：
- 系统入口页
- 不承载业务内容
- 已登录跳转到 `/reports`
- 未登录跳转到 `/login`

### 9.2 `/login`

用途：
- 本地账号密码登录页
- 登录成功后进入报告系统

### 9.3 `/reports`

用途：
- 报告列表页 / 报告工作台
- 查看当前可访问范围内的报告批次
- 按企业、时间范围、报告类型、复检状态筛选
- 查看顶部汇总数据
- 进入单份报告详情

### 9.4 `/reports/{reportId}`

用途：
- 单份报告详情页 / 复核台
- 查看当前报告下的巡检结果列表
- 按组织、门店、复检状态筛选结果
- 查看单条巡检结果详情、关联问题项、门店进度、协作记录
- 执行图片级复检并填写备注

### 9.5 `/admin/users`

用途：
- 用户管理页
- 创建本地用户
- 更新角色、范围、密码和账号状态

## 10. 接口路由

当前项目的接口和动作路由如下。后续如果让我“改某个接口”，请直接说接口地址。

### 10.1 认证接口

- `POST /api/auth/login`
  用途：账号密码登录，创建会话
- `POST /api/auth/logout`
  用途：退出登录，清理会话

### 10.2 报告接口

- `GET /api/reports`
  用途：获取报告列表，支持筛选
- `GET /api/reports/{reportId}`
  用途：获取单份报告详情
- `POST /api/reports/publish`
  用途：接收 `vision-agent` 发布的报告
- `GET /api/reports/publish-status?idempotency_key=...`
  用途：查询某次发布是否已入库
- `GET /api/reports/{reportId}/review-logs`
  用途：获取某份报告最近复检日志
- `POST /api/reports/{reportId}/images/{imageId}/review-status`
  用途：更新单张图片的复检状态，并写入复检日志

### 10.3 管理动作路由

这些路由不是 `api` 前缀，但本质上是表单提交动作接口：

- `POST /admin/users/create`
  用途：创建用户
- `POST /admin/users/{userId}/role`
  用途：更新用户角色
- `POST /admin/users/{userId}/scopes`
  用途：更新用户企业范围和门店范围
- `POST /admin/users/{userId}/password`
  用途：重置用户密码
- `POST /admin/users/{userId}/status`
  用途：启用或禁用用户

## 11. 与 VisionAgent 联调

### 11.1 先启动 report-system

```bash
npm run start
```

生产环境示例：

```bash
PORT=3000 npm run start
```

### 11.2 再启动 vision-agent

确保 `vision-agent` 的发布地址配置为：

```yaml
report_publish:
  base_url: "http://127.0.0.1:3000"
  api_token: ""
  publish_path: "/api/reports/publish"
  timeout_seconds: 30
```

### 11.3 从 vision-agent 发布

当前 `vision-agent` 已支持：
- 首页按钮：`发布报告`
- 接口：`POST /api/reports/publish`

## 12. 当前限制

1. 还没有权限体系
2. 还没有复检状态写回接口
3. `camera / inspection` 事实还未拆成独立持久化表
4. 当前仍以 SQLite 单机部署为主

## 13. 下一步建议

建议下一批按这个顺序继续：

1. 增加复检状态更新接口
2. 在详情页补连续复检交互
3. 新增 `camera / inspection` 独立表
4. 再考虑 API 鉴权与客户权限体系

## 15. 前端 UI 基线

当前前端基础组件标准统一为 `shadcn/ui`。

- `components.json` 作为前端基础组件配置入口
- 当前约定使用 `new-york` style
- Tailwind 使用 v4 方式接入
- 基础组件目录固定为 `@/components/ui`
- 页面独有样式优先写在页面级 `*.module.css`
- `app/globals.css` 只保留更抽象的全局样式

详细规则见：

- [docs/frontend-ui-standards.md](/Users/wick/Desktop/ZhiQing Selection/SourceCode/report-system/docs/frontend-ui-standards.md)
