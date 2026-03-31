import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import { createRectificationService } from "@/backend/rectification/rectification.module";

declare global {
  // eslint-disable-next-line no-var
  var __reportSystemRectificationSyncManager:
    | {
        timer: NodeJS.Timeout | null;
        intervalMs: number;
      }
    | undefined;
}

export function ensureRectificationSyncManagerStarted(): void {
  const settings = createSystemSettingsService().getHuiYunYingApiSettings();
  const intervalMs = Math.max(0, settings.rectificationSyncIntervalMs);
  const state = globalThis.__reportSystemRectificationSyncManager || {
    timer: null,
    intervalMs: -1
  };

  if (state.timer && state.intervalMs === intervalMs) {
    globalThis.__reportSystemRectificationSyncManager = state;
    return;
  }

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  state.intervalMs = intervalMs;

  if (intervalMs > 0) {
    state.timer = setInterval(() => {
      void createRectificationService().syncPendingOrders().catch(() => undefined);
    }, intervalMs);
  }

  globalThis.__reportSystemRectificationSyncManager = state;
}
