import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const require = createRequire(import.meta.url);
require.extensions[".css"] = () => ({});

const tempRoot = mkdtempSync(join(tmpdir(), "report-settings-branding-"));
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

let settingsSaveRoute: typeof import("../app/admin/settings/save/route");
let authModule: typeof import("../backend/auth/auth.module");
let sessionModule: typeof import("../backend/auth/session");
let systemSettingsModule: typeof import("../backend/system-settings/system-settings.module");
let layoutModule: typeof import("../app/layout");

const uploadedFilePaths = new Set<string>();

function cookieHeader(sessionToken: string): string {
  return `${sessionModule.SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

function assertOkAuthResult(
  authResult:
    | { ok: true; sessionToken: string; expiresAt: string }
    | { ok: false; reason: string; lockedUntil?: string }
): asserts authResult is { ok: true; sessionToken: string; expiresAt: string } {
  assert.equal(authResult.ok, true);
}

function trackPublicAsset(publicUrl: string): void {
  const trimmed = publicUrl.trim();
  if (!trimmed.startsWith("/")) {
    return;
  }
  uploadedFilePaths.add(join(process.cwd(), "public", trimmed.slice(1)));
}

before(async () => {
  await import("../backend/database/migrate");
  [authModule, sessionModule, systemSettingsModule, layoutModule, settingsSaveRoute] = await Promise.all([
    import("../backend/auth/auth.module"),
    import("../backend/auth/session"),
    import("../backend/system-settings/system-settings.module"),
    import("../app/layout"),
    import("../app/admin/settings/save/route")
  ]);

  authModule.createAuthService().ensureBootstrap();
});

after(() => {
  for (const filePath of uploadedFilePaths) {
    rmSync(filePath, { force: true });
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

test("settings save route rejects non-admin user for branding updates", async () => {
  const authService = authModule.createAuthService();
  const username = `viewer_${Date.now()}`;
  authService.createUser({
    username,
    password: "ViewerPassword123",
    displayName: "普通查看者",
    roleCode: "viewer",
    enterpriseScopeIds: [],
    organizationScopeIds: [],
    storeScopeIds: []
  });

  const authResult = authService.authenticate(username, "ViewerPassword123");
  assertOkAuthResult(authResult);

  const formData = new FormData();
  formData.set("tab", "branding");
  formData.set("enterpriseName", "普通用户测试企业");
  formData.set("primaryColor", "#8b5a2b");
  formData.set("primaryColorStrong", "#6b421d");

  const response = await settingsSaveRoute.POST(
    new Request("http://127.0.0.1:3000/admin/settings/save", {
      method: "POST",
      headers: { cookie: cookieHeader(authResult.sessionToken) },
      body: formData
    })
  );
  assert.equal(response.status, 403);
});

test("branding upload rejects fake png content by signature check", async () => {
  const authService = authModule.createAuthService();
  const authResult = authService.authenticate("admin", "ChangeMe123!");
  assertOkAuthResult(authResult);

  const formData = new FormData();
  formData.set("tab", "branding");
  formData.set("enterpriseName", "文件校验企业");
  formData.set("primaryColor", "#8b5a2b");
  formData.set("primaryColorStrong", "#6b421d");
  formData.set("logoFile", new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], "logo.png", { type: "image/png" }));

  const response = await settingsSaveRoute.POST(
    new Request("http://127.0.0.1:3000/admin/settings/save", {
      method: "POST",
      headers: { cookie: cookieHeader(authResult.sessionToken) },
      body: formData
    })
  );

  assert.equal(response.status, 303);
  const location = response.headers.get("location") || "";
  assert.ok(location.includes("/admin/settings?tab=branding&error="));
  const redirectUrl = new URL(location, "http://127.0.0.1:3000");
  const errorMessage = redirectUrl.searchParams.get("error") || "";
  assert.ok(errorMessage.includes("Logo 文件内容校验失败"));
});

test("branding upload persists urls and audit fields for admin", async () => {
  const authService = authModule.createAuthService();
  const authResult = authService.authenticate("admin", "ChangeMe123!");
  assertOkAuthResult(authResult);

  const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const icoSignature = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x00]);
  const formData = new FormData();
  formData.set("tab", "branding");
  formData.set("enterpriseName", "品牌配置测试企业");
  formData.set("primaryColor", "#123456");
  formData.set("primaryColorStrong", "#102030");
  formData.set("logoFile", new File([pngSignature], "logo.png", { type: "image/png" }));
  formData.set("faviconFile", new File([icoSignature], "favicon.ico", { type: "image/x-icon" }));

  const response = await settingsSaveRoute.POST(
    new Request("http://127.0.0.1:3000/admin/settings/save", {
      method: "POST",
      headers: { cookie: cookieHeader(authResult.sessionToken) },
      body: formData
    })
  );

  assert.equal(response.status, 303);
  const location = response.headers.get("location") || "";
  assert.ok(location.includes("/admin/settings?tab=branding"));
  assert.ok(!location.includes("error="));

  const settings = systemSettingsModule.createSystemSettingsService().getEnterpriseBrandingSettings();
  assert.equal(settings.enterpriseName, "品牌配置测试企业");
  assert.equal(settings.primaryColor, "#123456");
  assert.equal(settings.primaryColorStrong, "#102030");
  assert.equal(settings.updatedBy, "admin");
  assert.ok(settings.updatedAt.length > 0);
  assert.ok(settings.logoUrl.startsWith("/uploads/branding/logo-"));
  assert.ok(settings.faviconUrl.startsWith("/uploads/branding/favicon-"));

  trackPublicAsset(settings.logoUrl);
  trackPublicAsset(settings.faviconUrl);
});

test("metadata appends favicon version query by branding updatedAt", () => {
  const systemSettingsService = systemSettingsModule.createSystemSettingsService();
  systemSettingsService.saveEnterpriseBrandingSettings({
    enterpriseName: "版本参数测试企业",
    logoUrl: "/uploads/branding/logo-v2.png",
    faviconUrl: "/uploads/branding/favicon-v2.png",
    primaryColor: "#111111",
    primaryColorStrong: "#000000",
    updatedBy: "admin",
    updatedAt: "2026-04-10T10:20:30.000Z"
  });

  const metadata = layoutModule.generateMetadata();
  const icons = metadata.icons as { icon?: string; apple?: string } | undefined;
  assert.ok(icons);
  assert.equal(typeof icons?.icon, "string");
  assert.equal(typeof icons?.apple, "string");
  assert.ok(String(icons?.icon).includes("/uploads/branding/favicon-v2.png?v=2026-04-10T10%3A20%3A30.000Z"));
  assert.ok(String(icons?.apple).includes("/uploads/branding/favicon-v2.png?v=2026-04-10T10%3A20%3A30.000Z"));
});
