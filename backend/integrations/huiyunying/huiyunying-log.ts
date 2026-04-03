export function logHuiYunYingRequest(_input: {
  label: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}): void {}

export function logHuiYunYingResponse(_input: {
  label: string;
  method: string;
  url: string;
  status: number;
  ok: boolean;
  headers?: Record<string, string>;
  body: string;
}): void {}

export function logHuiYunYingError(_input: {
  label: string;
  method: string;
  url: string;
  message: string;
  detail?: unknown;
}): void {}
