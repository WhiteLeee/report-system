import { getReportSystemConfig } from "@/backend/config/report-system-config";

function readForwardedValue(value: string | null): string {
  if (!value) {
    return "";
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .find(Boolean) || "";
}

function stripPort(host: string): string {
  const trimmed = host.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("[")) {
    const endIndex = trimmed.indexOf("]");
    if (endIndex > 0) {
      return trimmed.slice(1, endIndex);
    }
  }
  const withoutIpv6Brackets = trimmed;
  const colonIndex = withoutIpv6Brackets.lastIndexOf(":");
  if (colonIndex <= 0) {
    return withoutIpv6Brackets;
  }
  const suffix = withoutIpv6Brackets.slice(colonIndex + 1);
  if (/^\d+$/.test(suffix)) {
    return withoutIpv6Brackets.slice(0, colonIndex);
  }
  return withoutIpv6Brackets;
}

function isLocalHost(host: string): boolean {
  const normalized = stripPort(host).toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "0.0.0.0";
}

function isValidHost(host: string): boolean {
  if (!host.trim()) {
    return false;
  }
  try {
    new URL(`http://${host}`);
    return true;
  } catch {
    return false;
  }
}

function readRequestHost(request: Request): string {
  const hostHeader = readForwardedValue(request.headers.get("host")).trim();
  const forwardedHost = readForwardedValue(request.headers.get("x-forwarded-host")).trim();

  if (hostHeader && !isLocalHost(hostHeader) && isValidHost(hostHeader)) {
    return hostHeader;
  }

  if (forwardedHost && isValidHost(forwardedHost)) {
    return forwardedHost;
  }

  if (hostHeader && isValidHost(hostHeader)) {
    return hostHeader;
  }

  try {
    const configuredHost = new URL(getReportSystemConfig().baseUrl).host;
    if (configuredHost && isValidHost(configuredHost)) {
      return configuredHost;
    }
  } catch {
    return "";
  }

  return "";
}

function readRequestProtocol(request: Request): "http" | "https" {
  const forwardedProtocol = readForwardedValue(request.headers.get("x-forwarded-proto")).toLowerCase();
  if (forwardedProtocol === "http" || forwardedProtocol === "https") {
    return forwardedProtocol;
  }
  try {
    return new URL(request.url).protocol === "https:" ? "https" : "http";
  } catch {
    return "http";
  }
}

export function buildRequestUrl(request: Request, path: string): URL {
  if (/^https?:\/\//i.test(path)) {
    return new URL(path);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const host = readRequestHost(request);
  if (!host) {
    return new URL(normalizedPath, request.url);
  }

  const protocol = readRequestProtocol(request);
  try {
    return new URL(normalizedPath, `${protocol}://${host}`);
  } catch {
    return new URL(normalizedPath, request.url);
  }
}
