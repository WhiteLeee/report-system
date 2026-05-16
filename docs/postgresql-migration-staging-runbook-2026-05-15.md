# PostgreSQL 迁移迭代 Staging 总结与生产升级 Runbook（2026-05-15）

## 1. 迭代目标

- 目标：`report-system` 以 PostgreSQL 完全替换 SQLite。
- 要求：代码与运行链路不保留任何 SQLite 依赖、逻辑或数据库运维流程。

## 2. 本轮 Staging 演练结论

结论：**通过（带注意事项）**。

本轮执行时间：2026-05-15（本地演练）

### 2.1 验证项与结果

1. `npm run check:ui-imports`：通过  
2. `npm run typecheck`：通过  
3. `npm run build -- --webpack`：通过  
4. `PGHOST=127.0.0.1 PGPORT=5432 npm test`：**65/65 通过**

### 2.2 关键说明

- `next build`（Turbopack 默认路径）在本地多次出现长时间卡在 `Creating an optimized production build ...` 的现象；改用 `next build --webpack` 可稳定完成构建。
- 测试环境若走 Unix Socket（`/tmp/.s.PGSQL.5432`）在受限环境会出现 `EPERM`，应明确使用 `PGHOST=127.0.0.1`。

## 3. SQLite 残留复核（代码层）

扫描范围：`backend app scripts tests deploy config drizzle package.json README.md .env.example`（排除 `docs` 与 `package-lock.json`）

结论：**未发现 sqlite/better-sqlite3/sqliteTable/.sqlite 代码命中**。

说明：
- `package-lock.json` 中可能保留上游依赖元数据文本，不代表运行时使用 SQLite。
- 历史文档（`docs/`）中提及 SQLite 属于历史描述，不属于运行逻辑。

## 4. 生产升级流程（流转/流出）

以下流程用于生产环境执行 PostgreSQL 迁移版本发布：

1. **发布前检查**
   - 确认分支与提交：`origin/main` 对齐目标发布提交。
   - 确认生产环境变量：
     - `REPORT_SYSTEM_DB_URL`
     - `REPORT_SYSTEM_DB_MIGRATIONS_SCHEMA`
     - `REPORT_SYSTEM_DB_MIGRATIONS_TABLE`
     - `REPORT_SYSTEM_TENANT_CONFIG_PATH`
   - 确认 PostgreSQL 可连接，且 migrations schema 已存在。

2. **数据库备份**
   - 执行：`./deploy/prod/backup-db.sh`
   - 备份文件应落在：`/var/backups/report-system/prod/`

3. **执行发布**
   - 执行：`./deploy/prod/deploy.sh`
   - 该流程包含：
     - 依赖安装 `npm ci`
     - 构建 `npm run build`
     - 迁移 `npm run db:migrate`
     - 服务重启 `systemctl restart report-system-prod`
     - 健康检查

4. **发布后验证**
   - 服务状态：`./deploy/prod/status.sh`
   - 健康检查：`./deploy/prod/healthcheck.sh`
   - 手工接口验证：
     - `http://127.0.0.1:3000/login`
     - `https://vision.weipos.com/login`
   - 核对登录跳转域名与业务页面访问是否正常。

## 5. 回滚流程

1. 选择最近一次可用备份（`.dump`）。
2. 执行：
   - `./deploy/prod/restore-db.sh /var/backups/report-system/prod/<backup-file>.dump`
3. 回滚后复核：
   - `./deploy/prod/status.sh`
   - `./deploy/prod/healthcheck.sh`
   - 登录与关键业务链路抽检。

## 6. 注意事项（上线前必须确认）

1. **测试命令规范**
   - 建议使用：`PGHOST=127.0.0.1 PGPORT=5432 npm test`
   - 不建议在共享固定库上反复跑全量测试（会干扰隔离库策略与迁移判定）。

2. **迁移表配置一致性**
   - `REPORT_SYSTEM_DB_MIGRATIONS_SCHEMA/TABLE` 在运行环境与 tenant 配置中必须一致。
   - schema 不存在会直接导致迁移失败。

3. **构建稳定性**
   - 如生产环境出现 Turbopack 构建卡顿，建议应急切换到 `next build --webpack` 验证可用性后再处理 Turbopack 问题。

4. **权限与目录**
   - `report` 用户需有数据目录、备份目录与 PostgreSQL 连接权限。
   - systemd 服务用户与部署脚本配置必须一致（`RUN_USER/RUN_GROUP`）。

5. **发布窗口控制**
   - 迁移发布应选择低峰窗口，迁移前后各保留一轮人工验收时间。

## 7. 上生产准入结论（基于本轮演练）

- PostgreSQL 替换目标：**已达成（代码层与测试层）**
- SQLite 运行逻辑残留：**未发现**
- 全量测试：**通过（65/65）**
- 生产发布建议：**可进入生产发布窗口，按本 Runbook 执行并保留回滚点**

