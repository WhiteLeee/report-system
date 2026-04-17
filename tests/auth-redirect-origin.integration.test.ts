import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const tempRoot = mkdtempSync(join(tmpdir(), "report-auth-redirect-"));
const dataDir = join(tempRoot, "data");
const dbPath = join(dataDir, "report-system.sqlite");
mkdirSync(dataDir, { recursive: true });

process.env.REPORT_SYSTEM_DATA_DIR = dataDir;
process.env.REPORT_SYSTEM_DB_PATH = dbPath;
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

before(async () => {
  await import("../backend/database/migrate");
  [authModule, loginRoute, logoutRoute] = await Promise.all([
    import("../backend/auth/auth.module"),
    import("../app/api/auth/login/route"),
    import("../app/api/auth/logout/route")
  ]);
  authModule.createAuthService().ensureBootstrap();
});

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

function buildLoginRequest(password: string): Request {
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

test("login success redirect uses forwarded host instead of localhost", async () => {
  const response = await loginRoute.POST(buildLoginRequest("ChangeMe123!"));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://vision.weipos.com/reports");
  assert.ok((response.headers.get("set-cookie") || "").includes("report_system_session="));
});

test("login failure redirect keeps forwarded host on /login", async () => {
  const response = await loginRoute.POST(buildLoginRequest("WrongPassword!"));
  assert.equal(response.status, 303);
  const location = response.headers.get("location") || "";
  assert.ok(location.startsWith("https://vision.weipos.com/login?"));
  const redirectUrl = new URL(location);
  assert.equal(redirectUrl.searchParams.get("next"), "/reports");
});

test("logout redirect uses forwarded host instead of localhost", async () => {
  const authResult = authModule.createAuthService().authenticate("admin", "ChangeMe123!");
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

test("non-local host header has higher priority than forwarded host", async () => {
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
