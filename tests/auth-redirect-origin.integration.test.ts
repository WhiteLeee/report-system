import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { resolveTestAdminDbUrl, resolveTestDbUrl, shouldManageIsolatedDatabase } from "./postgres-test-env";

const tempRoot = mkdtempSync(join(tmpdir(), "report-auth-redirect-"));
const dataDir = join(tempRoot, "data");
const isolatedDbName = `report_test_auth_redirect_${randomUUID().replace(/-/g, "_")}`;
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

let loginRoute: typeof import("../app/api/auth/login/route");
let logoutRoute: typeof import("../app/api/auth/logout/route");
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
    await client.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [isolatedDbName]);
    await client.query(`drop database if exists "${isolatedDbName}"`);
  } finally {
    await client.end();
  }
}

before(async (): Promise<any> => {
  await createIsolatedDatabase();
  const migrateModule = await import("../backend/database/migrate");
  await migrateModule.runMigrations();
  [authModule, loginRoute, logoutRoute] = await Promise.all([
    import("../backend/auth/auth.module"),
    import("../app/api/auth/login/route"),
    import("../app/api/auth/logout/route")
  ]);
  await authModule.createAuthService().ensureBootstrap();
});

after(async (): Promise<any> => {
  const { closeDatabasePool } = await import("../backend/database/client");
  await closeDatabasePool();
  await dropIsolatedDatabase();
  rmSync(tempRoot, { recursive: true, force: true });
});

function buildLoginRequest(password: string): any {
  const formData = new FormData();
  formData.set("username", "admin");
  formData.set("password", password);
  formData.set("next", "/reports");

  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "x-forwarded-host": "vision.weipos.com",
      "x-forwarded-proto": "https"
    },
    body: formData
  });
}

test("login success redirect uses forwarded host instead of localhost", async (): Promise<any> => {
  const response = await loginRoute.POST(buildLoginRequest("ChangeMe123!"));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://vision.weipos.com/reports");
  assert.ok((response.headers.get("set-cookie") || "").includes("report_system_session="));
});

test("login failure redirect keeps forwarded host on /login", async (): Promise<any> => {
  const response = await loginRoute.POST(buildLoginRequest("WrongPassword!"));
  assert.equal(response.status, 303);
  const location = response.headers.get("location") || "";
  assert.ok(location.startsWith("https://vision.weipos.com/login?"));
  const redirectUrl = new URL(location);
  assert.equal(redirectUrl.searchParams.get("next"), "/reports");
});

test("logout redirect uses forwarded host instead of localhost", async (): Promise<any> => {
  const authResult = await authModule.createAuthService().authenticate("admin", "ChangeMe123!");
  assert.equal(authResult.ok, true);
  if (!authResult.ok) {
    return;
  }

  const response = await logoutRoute.POST(
    new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `report_system_session=${encodeURIComponent(authResult.sessionToken)}`,
        "x-forwarded-host": "vision.weipos.com",
        "x-forwarded-proto": "https"
      }
    })
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://vision.weipos.com/login");
});

test("non-local host header has higher priority than forwarded host", async (): Promise<any> => {
  const formData = new FormData();
  formData.set("username", "admin");
  formData.set("password", "WrongPassword!");
  formData.set("next", "/reports");

  const response = await loginRoute.POST(
    new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "vision.weipos.com",
        "x-forwarded-host": "evil.example.com",
        "x-forwarded-proto": "https"
      },
      body: formData
    })
  );

  assert.equal(response.status, 303);
  const location = response.headers.get("location") || "";
  assert.ok(location.startsWith("https://vision.weipos.com/login?"));
  assert.ok(!location.includes("evil.example.com"));
});
