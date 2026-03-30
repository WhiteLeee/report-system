# Report System 长期可维护改造需求文档

## 1. 文档目的
本文档用于定义 `report-system` 从“一期骨架”演进到“可长期维护、可持续迭代”的正式改造方案。

本文档关注工程底座改造，不以新增客户业务功能为主要目标。改造完成后，系统应具备承接以下后续能力的基础条件：

1. 多租户
2. 用户与权限体系
3. 复检状态流转
4. 审计日志
5. 数据分析
6. PostgreSQL 持久化

## 2. 项目现状
当前 `report-system` 已完成一期骨架，已具备以下能力：

1. 接收 VisionAgent 发布报告的 API
2. 使用 SQLite 存储报告快照
3. 提供报告列表页
4. 提供报告详情页

当前方案适合快速验证产品形态，但从长期演进视角看，存在以下问题：

1. 项目仍偏原型结构，业务分层不清晰
2. 当前使用 JavaScript，缺少类型约束
3. 数据访问直接绑定 SQLite 实现，后续迁移 PostgreSQL 成本会逐步升高
4. 缺少 migration 管理机制
5. 尚未为多租户、权限体系预留清晰领域边界

## 3. 改造目标
本轮改造的目标如下：

1. 将项目从 JavaScript 升级为 TypeScript
2. 建立 `service + repository` 分层结构
3. 接入 migration 工具统一管理数据库结构
4. 预留 `tenant` 和 `auth` 领域模块
5. 在不破坏现有一期能力的前提下，提升可维护性、可测试性和可迁移性
6. 为二期中后段迁移 PostgreSQL 做准备

## 4. 非目标
本轮改造不包含以下内容：

1. 不正式实现登录流程
2. 不正式实现 RBAC 权限体系
3. 不正式实现多租户隔离逻辑
4. 不正式实现复检状态编辑和日志功能
5. 不立即切换 PostgreSQL
6. 不拆分独立微服务

## 5. 总体执行顺序
本项目长期可维护改造应严格按以下顺序推进：

1. 升级到 TypeScript
2. 抽 `service + repository` 分层
3. 接入 migration 工具
4. 预留 `tenant/auth domain`
5. 再开始加复检、用户、权限
6. 在二期中后段切 PostgreSQL

该顺序不可随意打乱。原因如下：

1. 如果不先做 TypeScript，后续模型和权限复杂度上来后，代码维护成本会迅速放大
2. 如果不先抽数据层，后续迁 PostgreSQL 会牵连 route、页面和业务逻辑
3. 如果不先做 migration，数据库演进会逐步失控
4. 如果不先预留 tenant/auth 边界，后续多租户和权限将变成一次全局重构

## 6. 总体原则
1. 保持当前一期功能可用，不因重构损坏报告发布、列表、详情能力
2. 页面层不直接依赖具体数据库实现
3. API route 只做参数解析、调用 service、返回 response
4. 幂等、查询编排、业务组合逻辑必须进入 service 层
5. 数据库访问必须通过 repository 抽象层完成
6. 当前继续保留 Next.js 单体形态，不引入第二后端语言
7. 当前继续使用 SQLite，但后续迁 PostgreSQL 的路径必须在本轮中被明确预留

## 7. 分阶段需求

### 7.1 第一阶段：升级到 TypeScript
目标：建立类型安全基础，降低长期维护成本。

需求：

1. 将现有 `.js` 和 `.mjs` 文件迁移为 `.ts` 和 `.tsx`
2. 增加 `tsconfig.json`
3. 为以下对象补齐类型定义：
   - 报告发布 payload
   - 报告列表 view model
   - 报告详情 view model
   - repository 接口
   - service 输入输出
4. 保持现有业务行为不变
5. 保持开发、构建命令简单可用

验收标准：

1. `npm run build` 通过
2. 当前报告发布 API 可用
3. 当前报告列表页可用
4. 当前报告详情页可用
5. 不存在未处理的关键类型错误

### 7.2 第二阶段：抽 service + repository 分层
目标：将业务逻辑和数据库实现解耦。

需求：

1. 从 route 和页面中抽离业务逻辑
2. 建立以下职责分层：
   - route：参数读取、调用 service、返回 response
   - service：业务编排、幂等逻辑、查询组合
   - repository：数据访问抽象
3. 至少定义一个 `ReportRepository` 接口
4. 当前必须覆盖以下能力：
   - `publishReport`
   - `listReports`
   - `getReportDetail`
5. 提供 SQLite 版本 repository 实现
6. 页面和 API 不能直接依赖 `better-sqlite3`

验收标准：

1. route 中不再直接出现大段数据库操作
2. 发布 API 仍保留幂等行为
3. 列表和详情查询行为不变
4. 后续可增加 PostgreSQL repository 实现，而不必修改页面层逻辑

### 7.3 第三阶段：接入 migration 工具
目标：建立标准化数据库结构演进机制。

需求：

1. 引入 migration 工具统一管理 schema
2. 将当前运行时建表逻辑迁出应用启动流程
3. 当前一期核心表至少纳入 migration 管理：
   - `report`
   - `report_store`
   - `report_image`
   - `report_issue`
4. migration 方案需兼容当前 SQLite 阶段
5. 提供基础命令说明：
   - 初始化数据库
   - 执行 migration
   - 重建本地数据库

验收标准：

1. 新环境可通过 migration 初始化数据库
2. 表结构变更具备可追踪、可回放能力
3. 应用运行不再依赖隐式建表

### 7.4 第四阶段：预留 tenant/auth domain
目标：为后续多租户和权限体系预留边界，而非立即实现业务。

需求：

1. 在项目结构中引入 `tenant` 模块和 `auth` 模块
2. 为以下领域对象预留位置：
   - tenant
   - user
   - role
   - permission
   - user scope
3. 在 report 业务层预留租户上下文接入点
4. 未来设计应支持引入：
   - `tenant_id`
   - 企业级访问范围
   - 品牌级访问范围
   - 门店级访问范围
5. 当前代码中避免写死不可拆解的单租户假设

验收标准：

1. 项目目录中已有 `tenant/auth` 模块位置
2. report 业务层未来可接入 user/tenant context
3. 当前不需要真正完成登录和权限逻辑

### 7.5 第五阶段：再开始加复检、用户、权限
目标：在底座稳定后开始叠加真实业务能力。

本阶段不在本轮实施，但本轮改造必须为其创造条件。

后续重点：

1. 复检状态修改
2. 复检日志记录
3. 用户体系
4. 权限判断
5. 组织、门店、企业访问范围控制

后续模型建议：

1. 报告快照表继续承载发布冻结数据
2. 在线业务状态单独承载，不直接污染快照主体
3. 后续新增表建议包括：
   - `report_review_log`
   - `report_user`

### 7.6 第六阶段：在二期中后段切 PostgreSQL
目标：支撑长期客户系统运行。

本阶段不在本轮直接实施，但本轮需保证以下约束：

1. 页面层不依赖 SQLite 特性
2. repository 接口不暴露 SQLite 细节
3. migration 工具未来应可支持 PostgreSQL 演进
4. PostgreSQL 切换应主要发生在基础设施层和 repository 实现层

PostgreSQL 切换触发条件建议：

1. 多租户正式上线
2. 用户和权限体系上线
3. 复检状态进入多人并发使用
4. 数据分析查询明显增多
5. 审计、备份、监控要求提高

## 8. 推荐目录结构
改造后目录建议逐步演进为：

```text
app/
  api/
  reports/

modules/
  report/
    domain/
    application/
    infrastructure/
    presentation/
  auth/
    domain/
    application/
  tenant/
    domain/
    application/

infra/
  db/
  config/

shared/
  types/
  utils/
  constants/
```

目录说明：

1. `app/` 承载 Next.js 路由和页面
2. `modules/report/` 承载报告领域业务
3. `modules/auth/` 和 `modules/tenant/` 先作为领域占位
4. `infra/db/` 负责数据库实现和 migration 接入
5. `shared/` 放置公共类型、工具和常量

## 9. 技术方案约束
1. 保留 `Next.js` 作为当前页面和 API 容器
2. 保留 Node.js 作为当前后端运行环境
3. 当前阶段不增加第二后端语言
4. TypeScript 作为后续默认开发语言
5. 数据层抽象优先级高于 PostgreSQL 切换
6. migration 工具选型应优先考虑长期可维护性

## 10. 风险与注意事项
1. 如果不先抽 repository，后续迁库将波及页面和 route，重构成本显著升高
2. 如果不先做 TypeScript，tenant/auth/permission 复杂度增长后，语义漂移和维护风险会明显增加
3. 如果缺少 migration 机制，数据库演进会失去可追踪性
4. 如果 tenant/auth 不先预留边界，后续权限体系容易演变成全局重构
5. 本轮虽然不新增客户功能，但属于高价值基础设施改造，不应只做表面目录调整

## 11. 本轮验收标准
本轮改造完成后，应满足以下条件：

1. 项目已迁移到 TypeScript
2. 报告发布、列表、详情能力保持可用
3. 已建立 `service + repository` 分层
4. SQLite 实现已被封装到基础设施层
5. 已接入 migration 工具并支持初始化数据库
6. 已预留 `tenant/auth` 模块结构
7. 后续新增复检、用户、权限时，不需要再先做大规模工程重构

## 12. 实施拆解清单

### 12.1 里程碑一：TypeScript 迁移
实施项：

1. 新增 `tsconfig.json`
2. 新增 Next.js 所需 TypeScript 配置文件
3. 将 `app/` 下页面和 API 迁移为 `.tsx` / `.ts`
4. 将 `lib/`、`scripts/` 中核心文件迁移为 TypeScript
5. 为当前一期业务补齐类型定义
6. 修复构建、导入路径和类型错误

交付物：

1. TypeScript 项目可运行
2. 构建通过
3. 当前功能无回归

### 12.2 里程碑二：Report 模块分层
实施项：

1. 新建 `modules/report/domain`
2. 新建 `modules/report/application`
3. 新建 `modules/report/infrastructure`
4. 抽离 `ReportRepository` 接口
5. 实现 SQLite 版本 repository
6. 将幂等、查询编排等逻辑迁入 service
7. route 改为仅做入参和出参处理

交付物：

1. `report` 领域具备最小完整分层
2. 页面和 API 不直接依赖 SQLite 客户端

### 12.3 里程碑三：Migration 接入
实施项：

1. 选定 migration 工具
2. 初始化 migration 配置
3. 将现有 4 张核心表迁入 migration
4. 提供数据库初始化命令
5. 提供本地重建数据库命令
6. 更新 README 或开发说明

交付物：

1. schema 管理进入标准化流程
2. 新环境可重复初始化数据库

### 12.4 里程碑四：tenant/auth 领域占位
实施项：

1. 新建 `modules/auth`
2. 新建 `modules/tenant`
3. 预留 user/tenant context 类型
4. 在 report service 预留上下文参数位置
5. 预留未来权限校验扩展点

交付物：

1. 多租户和权限边界具备落脚点
2. 后续新增权限能力不需要再先做目录级重构

### 12.5 里程碑五：底座验收与二期接入准备
实施项：

1. 回归验证发布 API
2. 回归验证报告列表页
3. 回归验证报告详情页
4. 校验 mock 数据流程
5. 校验数据库初始化流程
6. 输出二期接入建议

交付物：

1. 本轮底座改造验收通过
2. 可进入复检、用户、权限等二期功能开发

## 13. 实施建议
建议按以下顺序落地：

1. TypeScript 迁移
2. report 模块分层重构
3. migration 工具接入
4. tenant/auth 模块占位
5. 回归验证

本轮确认后，实施时建议保持以下策略：

1. 先改结构，不改现有产品行为
2. 每完成一个里程碑就进行构建验证和基础回归
3. 所有新功能开发从本轮完成后的结构开始，不再继续往旧结构上叠加
