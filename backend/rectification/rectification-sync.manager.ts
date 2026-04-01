import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import { createRectificationService } from "@/backend/rectification/rectification.module";

declare global {
  // eslint-disable-next-line no-var
  var __reportSystemRectificationSyncManager:
    | {
        timer: NodeJS.Timeout | null;
        intervalMs: number;
        runningPromise: Promise<unknown> | null;
      }
    | undefined;
}

async function triggerRectificationSync(): Promise<void> {
  const state = globalThis.__reportSystemRectificationSyncManager;
  if (!state) {
    return;
  }
  if (state.runningPromise) {
    await state.runningPromise;
    return;
  }

  const promise = createRectificationService()
    .syncPendingOrders(undefined, "scheduler")
    .catch((error) => {
      console.error(
        `[rectification-sync][scheduler:error] ${error instanceof Error ? error.message : "Unknown error"}`
      );
    })
    .finally(() => {
      if (globalThis.__reportSystemRectificationSyncManager) {
        globalThis.__reportSystemRectificationSyncManager.runningPromise = null;
      }
    });

  state.runningPromise = promise;
  await promise;
}

export function ensureRectificationSyncManagerStarted(): void {
  const settings = createSystemSettingsService().getHuiYunYingApiSettings();
  const intervalMs = Math.max(0, settings.rectificationSyncIntervalMs);
  const state = globalThis.__reportSystemRectificationSyncManager || {
    timer: null,
    intervalMs: -1,
    runningPromise: null
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
    void triggerRectificationSync();
    state.timer = setInterval(() => {
      void triggerRectificationSync();
    }, intervalMs);
  }

  globalThis.__reportSystemRectificationSyncManager = state;
}
