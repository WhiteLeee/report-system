# Report System 单租户部署手册

## 1. 目标
本手册用于指导 `report-system` 按“单客户单实例”方式初始化与部署。

## 2. 初始化步骤

### 2.1 安装依赖

```bash
npm install
```

### 2.2 生成单租户配置

```bash
npm run tenant:init -- \
  --tenant-id dlb \
  --tenant-name 德伦堡 \
  --brand-name 德伦堡巡检报告 \
  --base-url https://report-dlb.example.com \
  --logo-url https://cdn.example.com/dlb-logo.png \
  --data-dir ./data \
  --db-path ./data/report-system.sqlite \
  --force
```

该命令会生成：

1. `.env.local`
2. `config/tenant.json`
3. SQLite 目录
4. 已迁移的数据库文件

### 2.3 构建并启动

```bash
npm run build
PORT=3000 npm run start
```

## 3. 关键文件

1. 环境变量模板：
   - [../.env.example](/Users/wick/Desktop/ZhiQing%20Selection/SourceCode/report-system/.env.example)
2. 客户配置模板：
   - [../config/tenant.example.json](/Users/wick/Desktop/ZhiQing%20Selection/SourceCode/report-system/config/tenant.example.json)
3. systemd 示例：
   - [../deploy/report-system.service](/Users/wick/Desktop/ZhiQing%20Selection/SourceCode/report-system/deploy/report-system.service)

## 4. 当前配置来源

运行时配置按以下优先级解析：

1. 环境变量
2. `REPORT_SYSTEM_TENANT_CONFIG_PATH` 指向的 `tenant.json`
3. 默认值

当前已支持：

1. `REPORT_SYSTEM_TENANT_ID`
2. `REPORT_SYSTEM_TENANT_NAME`
3. `REPORT_SYSTEM_BRAND_NAME`
4. `REPORT_SYSTEM_BASE_URL`
5. `REPORT_SYSTEM_LOGO_URL`
6. `REPORT_SYSTEM_PRIMARY_COLOR`
7. `REPORT_SYSTEM_PRIMARY_COLOR_STRONG`
8. `REPORT_SYSTEM_DEFAULT_TIMEZONE`
9. `REPORT_SYSTEM_DATA_DIR`
10. `REPORT_SYSTEM_DB_PATH`
11. `REPORT_SYSTEM_TENANT_CONFIG_PATH`

## 5. 部署建议

1. 一个客户一套代码实例目录或一套容器实例。
2. 一个客户一个独立数据库文件。
3. 一个客户一个独立环境文件。
4. VisionAgent 发布目标应指向该客户实例自己的域名。

## 6. 已知边界

1. 当前客户品牌主要体现在标题、品牌名、Logo 和主题色。
2. 当前仍使用 SQLite，适合单机低并发。
3. 当前未启用 API 鉴权，适合同机或内网联调，后续可再补。
