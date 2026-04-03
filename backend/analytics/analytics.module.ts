import { AnalyticsService } from "@/backend/analytics/queries/analytics.service";
import { SqliteAnalyticsRepository } from "@/backend/analytics/queries/sqlite-analytics.repository";
import { AnalyticsFactService } from "@/backend/analytics/facts/analytics-fact.service";
import { SqliteAnalyticsFactRepository } from "@/backend/analytics/facts/sqlite-analytics-fact.repository";
import { AnalyticsSnapshotService } from "@/backend/analytics/snapshots/analytics-snapshot.service";
import { SqliteAnalyticsSnapshotRepository } from "@/backend/analytics/snapshots/sqlite-analytics-snapshot.repository";
import { AnalyticsJobService } from "@/backend/analytics/jobs/analytics-job.service";
import { SqliteAnalyticsJobRepository } from "@/backend/analytics/jobs/sqlite-analytics-job.repository";

export function createAnalyticsRepository(): SqliteAnalyticsRepository {
  return new SqliteAnalyticsRepository();
}

export function createAnalyticsService(): AnalyticsService {
  return new AnalyticsService(createAnalyticsRepository());
}

export function createAnalyticsFactRepository(): SqliteAnalyticsFactRepository {
  return new SqliteAnalyticsFactRepository();
}

export function createAnalyticsFactService(): AnalyticsFactService {
  return new AnalyticsFactService(createAnalyticsFactRepository());
}

export function createAnalyticsSnapshotRepository(): SqliteAnalyticsSnapshotRepository {
  return new SqliteAnalyticsSnapshotRepository();
}

export function createAnalyticsSnapshotService(): AnalyticsSnapshotService {
  return new AnalyticsSnapshotService(createAnalyticsFactRepository(), createAnalyticsSnapshotRepository());
}

export function createAnalyticsJobRepository(): SqliteAnalyticsJobRepository {
  return new SqliteAnalyticsJobRepository();
}

export function createAnalyticsJobService(): AnalyticsJobService {
  return new AnalyticsJobService(
    createAnalyticsJobRepository(),
    createAnalyticsFactService(),
    createAnalyticsSnapshotService()
  );
}
