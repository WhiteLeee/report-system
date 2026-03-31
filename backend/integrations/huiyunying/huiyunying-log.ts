function maskValue(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 6) {
    return "***";
  }
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === "token" || normalizedKey === "authorization") {
        return [key, maskValue(value)];
      }
      return [key, value];
    })
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function logHuiYunYingRequest(input: {
  label: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}): void {
  console.info(
    `[huiyunying][request] ${input.label}\n${safeStringify({
      method: input.method,
      url: input.url,
      query: input.query || {},
      headers: sanitizeHeaders(input.headers || {}),
      body: input.body ?? null
    })}`
  );
}

export function logHuiYunYingResponse(input: {
  label: string;
  method: string;
  url: string;
  status: number;
  ok: boolean;
  headers?: Record<string, string>;
  body: string;
}): void {
  console.info(
    `[huiyunying][response] ${input.label}\n${safeStringify({
      method: input.method,
      url: input.url,
      status: input.status,
      ok: input.ok,
      headers: input.headers || {},
      body: input.body
    })}`
  );
}

export function logHuiYunYingError(input: {
  label: string;
  method: string;
  url: string;
  message: string;
  detail?: unknown;
}): void {
  console.error(
    `[huiyunying][error] ${input.label}\n${safeStringify({
      method: input.method,
      url: input.url,
      message: input.message,
      detail: input.detail ?? null
    })}`
  );
}
