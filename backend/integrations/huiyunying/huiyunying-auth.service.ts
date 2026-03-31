import type { HuiYunYingResolvedSettings, HuiYunYingSignResponse } from "@/backend/integrations/huiyunying/huiyunying.types";
import {
  logHuiYunYingError,
  logHuiYunYingRequest,
  logHuiYunYingResponse
} from "@/backend/integrations/huiyunying/huiyunying-log";
import { HuiYunYingRateLimiter } from "@/backend/integrations/huiyunying/huiyunying-rate-limiter";

type HuiYunYingTokenCacheEntry = {
  token: string;
  expiresAt: number;
};

declare global {
  var __reportSystemHuiYunYingTokenCache: Map<string, HuiYunYingTokenCacheEntry> | undefined;
}

const TOKEN_TTL_MS = 22 * 60 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 3 * 60 * 1000;

function joinUrl(baseUri: string, path: string): string {
  return new URL(path.replace(/^\//, ""), `${baseUri.replace(/\/+$/, "")}/`).toString();
}

function getTokenCache(): Map<string, HuiYunYingTokenCacheEntry> {
  if (!globalThis.__reportSystemHuiYunYingTokenCache) {
    globalThis.__reportSystemHuiYunYingTokenCache = new Map<string, HuiYunYingTokenCacheEntry>();
  }
  return globalThis.__reportSystemHuiYunYingTokenCache;
}

function buildCacheKey(settings: HuiYunYingResolvedSettings): string {
  return [settings.baseUri, settings.appid, settings.secret].join("|");
}

function parseTokenFromPayload(
  rawBody: string,
  payload: HuiYunYingSignResponse | null
): { token: string; errorMessage: string } {
  const plainTextToken = rawBody.startsWith("{") ? "" : rawBody;
  const structuredToken = String(payload?.token || payload?.data?.token || "").trim();
  const token = structuredToken || plainTextToken;

  if (token) {
    return { token, errorMessage: "" };
  }

  const errorMessage = String(
    payload?.error_msg || payload?.message || payload?.error || rawBody || "响应中未返回 token"
  ).trim();
  return { token: "", errorMessage };
}

export class HuiYunYingAuthService {
  private readonly rateLimiter: HuiYunYingRateLimiter;

  constructor(private readonly settings: HuiYunYingResolvedSettings) {
    this.rateLimiter = new HuiYunYingRateLimiter(settings.rateLimitCount, settings.rateLimitWindowMs);
  }

  ensureConfigured(): void {
    if (!this.settings.baseUri || !this.settings.appid || !this.settings.secret) {
      throw new Error("慧运营 API 配置不完整。");
    }
  }

  isTokenValid(): boolean {
    const cached = getTokenCache().get(buildCacheKey(this.settings));
    if (!cached?.token) {
      return false;
    }
    return cached.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS;
  }

  invalidateToken(): void {
    getTokenCache().delete(buildCacheKey(this.settings));
  }

  async getToken(forceRefresh = false): Promise<string> {
    this.ensureConfigured();
    const cacheKey = buildCacheKey(this.settings);
    const cached = getTokenCache().get(cacheKey);
    if (!forceRefresh && cached?.token && cached.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
      return cached.token;
    }

    await this.rateLimiter.acquire();
    const url = new URL(joinUrl(this.settings.baseUri, this.settings.signPath));
    url.searchParams.set("key", this.settings.appid);
    url.searchParams.set("secret", this.settings.secret);
    logHuiYunYingRequest({
      label: "sign",
      method: "GET",
      url: url.toString(),
      query: {
        key: this.settings.appid,
        secret: this.settings.secret
      }
    });

    const response = await fetch(url, { method: "GET", cache: "no-store" });
    const rawBody = (await response.text().catch(() => "")).trim();
    logHuiYunYingResponse({
      label: "sign",
      method: "GET",
      url: url.toString(),
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      body: rawBody
    });
    const payload = rawBody.startsWith("{")
      ? ((JSON.parse(rawBody) as HuiYunYingSignResponse | null) ?? null)
      : null;
    const { token, errorMessage } = parseTokenFromPayload(rawBody, payload);

    if (!response.ok) {
      logHuiYunYingError({
        label: "sign",
        method: "GET",
        url: url.toString(),
        message: `慧运营 token 获取失败: ${response.status}`,
        detail: errorMessage || rawBody
      });
      throw new Error(`慧运营 token 获取失败: ${response.status}${errorMessage ? ` - ${errorMessage}` : ""}`);
    }

    if (!token) {
      logHuiYunYingError({
        label: "sign",
        method: "GET",
        url: url.toString(),
        message: "慧运营 token 获取失败: 响应中未返回有效 token",
        detail: errorMessage || rawBody
      });
      throw new Error(`慧运营 token 获取失败: ${errorMessage || response.status}`);
    }

    getTokenCache().set(cacheKey, {
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS
    });

    return token;
  }
}
