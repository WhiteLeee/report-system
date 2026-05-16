import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { resolveTestAdminDbUrl, resolveTestDbUrl, shouldManageIsolatedDatabase } from "./postgres-test-env";

const tempRoot = mkdtempSync(join(tmpdir(), "report-master-data-"));
const dataDir = join(tempRoot, "data");
const isolatedDbName = `report_test_master_data_${randomUUID().replace(/-/g, "_")}`;
const dbUrl = resolveTestDbUrl(isolatedDbName);
const adminDbUrl = resolveTestAdminDbUrl();
mkdirSync(dataDir, { recursive: true });

process.env.REPORT_SYSTEM_DATA_DIR = dataDir;
process.env.REPORT_SYSTEM_DB_URL = dbUrl;
process.env.REPORT_SYSTEM_TENANT_ID = "demo";
process.env.REPORT_SYSTEM_TENANT_NAME = "示例客户";
process.env.REPORT_SYSTEM_BRAND_NAME = "示例报告系统";
process.env.REPORT_SYSTEM_BASE_URL = "http://127.0.0.1:3000";
process.env.REPORT_SYSTEM_ADMIN_USERNAME = "admin";
process.env.REPORT_SYSTEM_ADMIN_PASSWORD = "ChangeMe123!";
process.env.REPORT_SYSTEM_ADMIN_DISPLAY_NAME = "系统管理员";
process.env.REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS = "2";

let publishRoute: typeof import("../app/api/master-data/publish/route");
let masterDataModule: typeof import("../backend/master-data/master-data.module");
let authModule: typeof import("../backend/auth/auth.module");

async function createIsolatedDatabase(): Promise<void> {
  if (!shouldManageIsolatedDatabase()) {
    return;
  }
  const client = new Client({ connectionString: adminDbUrl });
  await client.connect();
  try {
    await client.query(`create database "${isolatedDbName}"`);
  } finally {
    await client.end();
  }
}

async function dropIsolatedDatabase(): Promise<void> {
  if (!shouldManageIsolatedDatabase()) {
    return;
  }
  const client = new Client({ connectionString: adminDbUrl });
  await client.connect();
  try {
    await client.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [
      isolatedDbName
    ]);
    await client.query(`drop database if exists "${isolatedDbName}"`);
  } finally {
    await client.end();
  }
}

const payload = {
  source_system: "vision-agent",
  payload_version: 1,
  data_type: "store_master",
  idempotency_key: "master-data-001",
  published_at: "2026-03-29 10:00:00",
  snapshot_mode: "full_replace",
  enterprise: {
    enterprise_id: "demo",
    enterprise_name: "示例客户"
  },
  snapshot_meta: {
    snapshot_version: "20260329100000",
    organize_count: 2,
    store_count: 1,
    operator: "vision"
  },
  organizations: [
    {
      organize_code: "org-root",
      organize_name: "东北大区",
      parent_code: "",
      level: 1,
      raw_json: {
        organizeId: 1,
        currentStoreCount: 1,
        nameLink: "东北大区"
      }
    },
    {
      organize_code: "org-child",
      organize_name: "沈阳一区",
      parent_code: "org-root",
      level: 2,
      raw_json: {
        organizeId: 2,
        currentStoreCount: 1,
        nameLink: "东北大区/沈阳一区"
      }
    }
  ],
  stores: [
    {
      store_id: "store-001",
      store_code: "demo001",
      store_name: "沈阳测试门店",
      organize_code: "org-child",
      organize_name: "沈阳一区",
      store_type: "jm",
      franchisee_name: "张三",
      supervisor: "李四",
      status: "zc",
      raw_json: {
        fullName: "沈阳测试门店",
        employeeName: "王五",
        empCount: 12,
        businessStatus: "zc",
        storeAddress: "沈阳市测试路 1 号"
      }
    }
  ]
};

before(async (): Promise<any> => {
  await createIsolatedDatabase();
  const migrateModule = await import("../backend/database/migrate");
  await migrateModule.runMigrations();
  [publishRoute, masterDataModule, authModule] = await Promise.all([
    import("../app/api/master-data/publish/route"),
    import("../backend/master-data/master-data.module"),
    import("../backend/auth/auth.module")
  ]);
  await authModule.createAuthService().ensureBootstrap();
});

after(async (): Promise<any> => {
  const { closeDatabasePool } = await import("../backend/database/client");
  await closeDatabasePool();
  await dropIsolatedDatabase();
  rmSync(tempRoot, { recursive: true, force: true });
});

test("master-data publish route persists snapshot and supports duplicate replay", async (): Promise<any> => {
  const firstResp = await publishRoute.POST(
    new Request("http://127.0.0.1:3000/api/master-data/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
  );
  assert.equal(firstResp.status, 201);
  const firstBody = await firstResp.json();
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.organize_count, 2);
  assert.equal(firstBody.store_count, 1);

  const duplicateResp = await publishRoute.POST(
    new Request("http://127.0.0.1:3000/api/master-data/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
  );
  assert.equal(duplicateResp.status, 200);
  const duplicateBody = await duplicateResp.json();
  assert.equal(duplicateBody.action, "duplicate");

  const masterDataService = masterDataModule.createMasterDataService();
  const enterprises = await masterDataService.listEnterprises();
  assert.equal(enterprises.length, 1);
  assert.equal(enterprises[0]?.enterprise_id, "demo");

  const organizations = await masterDataService.listOrganizations("demo");
  assert.equal(organizations.length, 1);
  assert.equal(organizations[0]?.organize_code, "org-root");
  assert.equal(organizations[0]?.current_store_count, 1);
  assert.equal(organizations[0]?.child[0]?.organize_code, "org-child");

  const stores = await masterDataService.listStores({ enterpriseId: "demo", organizeCode: "org-child" });
  assert.equal(stores.length, 1);
  assert.equal(stores[0]?.store_id, "store-001");
  assert.equal(stores[0]?.employee_name, "王五");
  assert.equal(stores[0]?.emp_count, 12);
  assert.equal(stores[0]?.business_status, "zc");
});

test("auth service stores organization scopes and master-data queries honor them", async (): Promise<any> => {
  const authService = authModule.createAuthService();
  const created = await authService.createUser({
    username: `scoped-user-${Date.now()}`,
    displayName: "组织范围用户",
    password: "ChangeMe123!",
    roleCode: "viewer",
    enterpriseScopeIds: ["demo"],
    organizationScopeIds: ["org-child"],
    storeScopeIds: []
  });
  assert.deepEqual(created.organizationScopeIds, ["org-child"]);

  const masterDataService = masterDataModule.createMasterDataService();
  const scopedOrganizations = await masterDataService.listOrganizations("demo", {
    enterpriseScopeIds: ["demo"],
    organizationScopeIds: ["org-child"]
  });
  assert.equal(scopedOrganizations.length, 1);
  assert.equal(scopedOrganizations[0]?.organize_code, "org-child");

  const scopedStores = await masterDataService.listStores(
    { enterpriseId: "demo" },
    {
      enterpriseScopeIds: ["demo"],
      organizationScopeIds: ["org-child"]
    }
  );
  assert.equal(scopedStores.length, 1);
  assert.equal(scopedStores[0]?.organize_code, "org-child");
});
