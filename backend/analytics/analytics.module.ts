import { AnalyticsService } from "@/backend/analytics/queries/analytics.service";
import { PgAnalyticsRepository } from "@/backend/analytics/queries/pg-analytics.repository";
import { AnalyticsFactService } from "@/backend/analytics/facts/analytics-fact.service";
import { PgAnalyticsFactRepository } from "@/backend/analytics/facts/pg-analytics-fact.repository";
import { AnalyticsSnapshotService } from "@/backend/analytics/snapshots/analytics-snapshot.service";
import { PgAnalyticsSnapshotRepository } from "@/backend/analytics/snapshots/pg-analytics-snapshot.repository";
import { AnalyticsJobService } from "@/backend/analytics/jobs/analytics-job.service";
import { PgAnalyticsJobRepository } from "@/backend/analytics/jobs/pg-analytics-job.repository";

export function createAnalyticsRepository(): any {
  return new PgAnalyticsRepository();
}

export function createAnalyticsService(): any {
  return new AnalyticsService(createAnalyticsRepository());
}

export function createAnalyticsFactRepository(): any {
  return new PgAnalyticsFactRepository();
}

export function createAnalyticsFactService(): any {
  return new AnalyticsFactService(createAnalyticsFactRepository());
}

export function createAnalyticsSnapshotRepository(): any {
  return new PgAnalyticsSnapshotRepository();
}

export function createAnalyticsSnapshotService(): any {
  return new AnalyticsSnapshotService(createAnalyticsFactRepository(), createAnalyticsSnapshotRepository());
}

export function createAnalyticsJobRepository(): any {
  return new PgAnalyticsJobRepository();
}

export function createAnalyticsJobService(): any {
  return new AnalyticsJobService(
    createAnalyticsJobRepository(),
    createAnalyticsFactService(),
    createAnalyticsSnapshotService()
  );
}
