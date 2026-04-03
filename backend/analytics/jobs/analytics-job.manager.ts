import { createAnalyticsJobService } from "@/backend/analytics/analytics.module";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";

declare global {
  // eslint-disable-next-line no-var
  var __reportSystemAnalyticsJobManager:
    | {
        resultFactRefreshTimer: NodeJS.Timeout | null;
        snapshotRefreshTimer: NodeJS.Timeout | null;
        resultFactIntervalMs: number;
        snapshotIntervalMs: number;
        resultFactRunningPromise: Promise<unknown> | null;
        snapshotRunningPromise: Promise<unknown> | null;
      }
    | undefined;
}

async function triggerResultFactRefresh(): Promise<void> {
  const state = globalThis.__reportSystemAnalyticsJobManager;
  if (!state) {
    return;
  }
  if (state.resultFactRunningPromise) {
    await state.resultFactRunningPromise;
    return;
  }

  const promise = Promise.resolve()
    .then(() => createAnalyticsJobService().runResultFactRebuild())
    .catch((error) => {
      console.error(`[analytics][fact-refresh:error] ${error instanceof Error ? error.message : "Unknown error"}`);
    })
    .finally(() => {
      if (globalThis.__reportSystemAnalyticsJobManager) {
        globalThis.__reportSystemAnalyticsJobManager.resultFactRunningPromise = null;
      }
    });

  state.resultFactRunningPromise = promise;
  await promise;
}

async function triggerSnapshotRefresh(): Promise<void> {
  const state = globalThis.__reportSystemAnalyticsJobManager;
  if (!state) {
    return;
  }
  if (state.snapshotRunningPromise) {
    await state.snapshotRunningPromise;
    return;
  }

  const promise = Promise.resolve()
    .then(async () => {
      await triggerResultFactRefresh();
      createAnalyticsJobService().runDailySnapshotRebuild();
    })
    .catch((error) => {
      console.error(`[analytics][snapshot-refresh:error] ${error instanceof Error ? error.message : "Unknown error"}`);
    })
    .finally(() => {
      if (globalThis.__reportSystemAnalyticsJobManager) {
        globalThis.__reportSystemAnalyticsJobManager.snapshotRunningPromise = null;
      }
    });

  state.snapshotRunningPromise = promise;
  await promise;
}

export function ensureAnalyticsJobManagerStarted(): void {
  const settings = createSystemSettingsService().getHuiYunYingApiSettings();
  const resultFactIntervalMs = Math.max(0, settings.analyticsFactRefreshIntervalMs);
  const snapshotIntervalMs = Math.max(0, settings.analyticsSnapshotRefreshIntervalMs);
  const state = globalThis.__reportSystemAnalyticsJobManager || {
    resultFactRefreshTimer: null,
    snapshotRefreshTimer: null,
    resultFactIntervalMs: -1,
    snapshotIntervalMs: -1,
    resultFactRunningPromise: null,
    snapshotRunningPromise: null
  };

  if (state.resultFactRefreshTimer && state.resultFactIntervalMs !== resultFactIntervalMs) {
    clearInterval(state.resultFactRefreshTimer);
    state.resultFactRefreshTimer = null;
  }
  if (state.snapshotRefreshTimer && state.snapshotIntervalMs !== snapshotIntervalMs) {
    clearInterval(state.snapshotRefreshTimer);
    state.snapshotRefreshTimer = null;
  }

  state.resultFactIntervalMs = resultFactIntervalMs;
  state.snapshotIntervalMs = snapshotIntervalMs;

  if (!state.resultFactRefreshTimer && resultFactIntervalMs > 0) {
    void triggerResultFactRefresh();
    state.resultFactRefreshTimer = setInterval(() => {
      void triggerResultFactRefresh();
    }, resultFactIntervalMs);
  }

  if (!state.snapshotRefreshTimer && snapshotIntervalMs > 0) {
    void triggerSnapshotRefresh();
    state.snapshotRefreshTimer = setInterval(() => {
      void triggerSnapshotRefresh();
    }, snapshotIntervalMs);
  }

  globalThis.__reportSystemAnalyticsJobManager = state;
}
