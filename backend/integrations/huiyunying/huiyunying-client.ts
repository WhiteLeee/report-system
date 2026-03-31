import { HuiYunYingRateLimiter } from "@/backend/integrations/huiyunying/huiyunying-rate-limiter";
import { HuiYunYingAuthService } from "@/backend/integrations/huiyunying/huiyunying-auth.service";
import { HuiYunYingHttpError } from "@/backend/integrations/huiyunying/huiyunying-errors";
import {
  logHuiYunYingError,
  logHuiYunYingRequest,
  logHuiYunYingResponse
} from "@/backend/integrations/huiyunying/huiyunying-log";
import type {
  HuiYunYingCreateRectificationInput,
  HuiYunYingListRectificationInput,
  HuiYunYingResolvedSettings,
  HuiYunYingRectificationOrderItem
} from "@/backend/integrations/huiyunying/huiyunying.types";

function joinUrl(baseUri: string, path: string): string {
  return new URL(path.replace(/^\//, ""), `${baseUri.replace(/\/+$/, "")}/`).toString();
}

function safeParseJsonObject(rawBody: string): Record<string, unknown> {
  if (!rawBody) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function isBusinessSuccessStatus(status: unknown): boolean {
  return status === undefined || status === null || status === 0 || status === "0" || status === 200 || status === "200";
}

function readBusinessMessage(payload: Record<string, unknown>): string {
  return String(payload.message || payload.error_msg || payload.error || "").trim();
}

export class HuiYunYingClient {
  private readonly rateLimiter: HuiYunYingRateLimiter;

  constructor(
    private readonly settings: HuiYunYingResolvedSettings,
    private readonly authService: HuiYunYingAuthService
  ) {
    this.rateLimiter = new HuiYunYingRateLimiter(settings.rateLimitCount, settings.rateLimitWindowMs);
  }

  ensureConfigured(): void {
    if (!this.settings.baseUri || !this.settings.appid || !this.settings.secret) {
      throw new Error("慧运营 API 配置不完整。");
    }
  }

  private async sendJsonRequest(
    label: string,
    path: string,
    token: string,
    body: unknown,
    extraHeaders: Record<string, string> = {}
  ): Promise<Response> {
    const url = `${joinUrl(this.settings.baseUri, path)}?version=1`;
    const headers = {
      "content-type": "application/json",
      Authorization: token,
      token,
      ...extraHeaders
    };
    logHuiYunYingRequest({
      label,
      method: "POST",
      url,
      headers,
      body
    });
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store"
    });
    return response;
  }

  private async executeWithTokenRetry<T>(
    send: (token: string) => Promise<Response>,
    parse: (response: Response) => Promise<T>
  ): Promise<T> {
    const attempt = async (forceRefresh = false): Promise<Response> => {
      const token = await this.authService.getToken(forceRefresh);
      return send(token);
    };

    let response = await attempt(false);
    if (response.status === 401) {
      this.authService.invalidateToken();
      response = await attempt(true);
    }
    return parse(response);
  }

  async createRectificationOrder(input: HuiYunYingCreateRectificationInput): Promise<unknown> {
    this.ensureConfigured();
    return this.executeWithTokenRetry(
      async (token) => {
        await this.rateLimiter.acquire();
        return this.sendJsonRequest("rectification.create", this.settings.rectificationCreateRoute, token, input);
      },
      async (response) => {
        const url = `${joinUrl(this.settings.baseUri, this.settings.rectificationCreateRoute)}?version=1`;
        const rawBody = (await response.text().catch(() => "")).trim();
        logHuiYunYingResponse({
          label: "rectification.create",
          method: "POST",
          url,
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body: rawBody
        });
        const payload = safeParseJsonObject(rawBody);
        if (!response.ok) {
          const detail = rawBody || JSON.stringify(payload);
          logHuiYunYingError({
            label: "rectification.create",
            method: "POST",
            url,
            message: `慧运营新增整改单失败: ${response.status}`,
            detail
          });
          throw new HuiYunYingHttpError(`慧运营新增整改单失败: ${response.status}`, response.status, detail);
        }
        if (!isBusinessSuccessStatus(payload.status) || payload.data === false) {
          const message = readBusinessMessage(payload) || "慧运营返回业务失败";
          const detail = rawBody || JSON.stringify(payload);
          logHuiYunYingError({
            label: "rectification.create",
            method: "POST",
            url,
            message: `慧运营新增整改单业务失败: ${String(payload.status ?? "") || "unknown"}`,
            detail
          });
          throw new HuiYunYingHttpError(
            `慧运营新增整改单业务失败: ${message}`,
            response.status,
            detail
          );
        }
        return payload;
      }
    );
  }

  async listRectificationOrders(input: HuiYunYingListRectificationInput): Promise<HuiYunYingRectificationOrderItem[]> {
    this.ensureConfigured();
    return this.executeWithTokenRetry(
      async (token) => {
        await this.rateLimiter.acquire();
        return this.sendJsonRequest("rectification.list", this.settings.rectificationListRoute, token, input, {
          ent: this.settings.appid
        });
      },
      async (response) => {
        const url = `${joinUrl(this.settings.baseUri, this.settings.rectificationListRoute)}?version=1`;
        const rawBody = (await response.text().catch(() => "")).trim();
        logHuiYunYingResponse({
          label: "rectification.list",
          method: "POST",
          url,
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body: rawBody
        });
        const payload = safeParseJsonObject(rawBody) as {
          data?: HuiYunYingRectificationOrderItem[];
        };
        if (!response.ok) {
          const detail = rawBody || JSON.stringify(payload);
          logHuiYunYingError({
            label: "rectification.list",
            method: "POST",
            url,
            message: `慧运营查询整改单失败: ${response.status}`,
            detail
          });
          throw new HuiYunYingHttpError(`慧运营查询整改单失败: ${response.status}`, response.status, detail);
        }
        if (!isBusinessSuccessStatus((payload as Record<string, unknown>).status)) {
          const message = readBusinessMessage(payload as Record<string, unknown>) || "慧运营返回业务失败";
          const detail = rawBody || JSON.stringify(payload);
          logHuiYunYingError({
            label: "rectification.list",
            method: "POST",
            url,
            message: `慧运营查询整改单业务失败: ${String((payload as Record<string, unknown>).status ?? "") || "unknown"}`,
            detail
          });
          throw new HuiYunYingHttpError(
            `慧运营查询整改单业务失败: ${message}`,
            response.status,
            detail
          );
        }
        return Array.isArray(payload.data) ? payload.data : [];
      }
    );
  }
}
