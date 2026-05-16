import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readMigrationFiles } from "drizzle-orm/migrator";

import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { pool } from "@/backend/database/client";

const migrationsFolder = path.join(process.cwd(), "drizzle");

if (!fs.existsSync(migrationsFolder)) {
  throw new Error("Migration folder not found. Run `npm run db:generate` or add migrations first.");
}

function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function qualifiedTableName(schema: string, table: string): string {
  return `${escapeIdentifier(schema)}.${escapeIdentifier(table)}`;
}

async function ensureSchemaExists(schema: string): Promise<void> {
  const result = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from information_schema.schemata where schema_name = $1) as exists",
    [schema]
  );
  if (!result.rows[0]?.exists) {
    throw new Error(
      `Migration schema "${schema}" does not exist. Create it first or set REPORT_SYSTEM_DB_MIGRATIONS_SCHEMA to an existing schema.`
    );
  }
}

async function ensureMigrationsTable(schema: string, table: string): Promise<void> {
  const tableName = qualifiedTableName(schema, table);
  await pool.query(
    `create table if not exists ${tableName} (
      id serial primary key,
      hash text not null,
      created_at bigint not null
    )`
  );
}

async function readLastAppliedMillis(schema: string, table: string): Promise<number> {
  const tableName = qualifiedTableName(schema, table);
  const result = await pool.query<{ created_at: string | number }>(
    `select created_at from ${tableName} order by created_at desc limit 1`
  );
  const raw = result.rows[0]?.created_at;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function hasAppliedMigrationHash(schema: string, table: string, hash: string): Promise<boolean> {
  const tableName = qualifiedTableName(schema, table);
  const result = await pool.query<{ exists: boolean }>(
    `select exists(select 1 from ${tableName} where hash = $1) as exists`,
    [hash]
  );
  return Boolean(result.rows[0]?.exists);
}

function extractCreatedTables(migrationSql: string[]): string[] {
  const created = new Set<string>();
  for (const statement of migrationSql) {
    const sql = statement.trim();
    if (!sql) {
      continue;
    }
    const match = /^create\s+table\s+"([^"]+)"/i.exec(sql);
    if (match?.[1]) {
      created.add(match[1]);
    }
  }
  return Array.from(created);
}

async function doesTableExist(tableName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `select exists(
      select 1
      from information_schema.tables
      where table_name = $1
        and table_schema not in ('pg_catalog', 'information_schema')
    ) as exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function resolveExistingCreatedTables(createdTables: string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const tableName of createdTables) {
    if (await doesTableExist(tableName)) {
      existing.push(tableName);
    }
  }
  return existing;
}

async function applyPendingMigrations(schema: string, table: string): Promise<void> {
  const tableName = qualifiedTableName(schema, table);
  const migrations = readMigrationFiles({ migrationsFolder });
  let lastAppliedMillis = await readLastAppliedMillis(schema, table);

  for (const migration of migrations) {
    if (await hasAppliedMigrationHash(schema, table, migration.hash)) {
      if (migration.folderMillis > lastAppliedMillis) {
        lastAppliedMillis = migration.folderMillis;
      }
      continue;
    }

    if (migration.folderMillis <= lastAppliedMillis) {
      continue;
    }

    const createdTables = extractCreatedTables(migration.sql);
    if (createdTables.length > 0) {
      const existingTables = await resolveExistingCreatedTables(createdTables);
      if (existingTables.length === createdTables.length) {
        await pool.query(`insert into ${tableName} ("hash", "created_at") values ($1, $2)`, [
          migration.hash,
          migration.folderMillis
        ]);
        lastAppliedMillis = migration.folderMillis;
        console.warn(
          `Migration ${migration.hash} was baseline-marked as applied because all target tables already exist.`
        );
        continue;
      }

      if (existingTables.length > 0) {
        throw new Error(
          `Migration ${migration.hash} is partially applied. Existing tables: ${existingTables.join(", ")}`
        );
      }
    }

    await pool.query("begin");
    try {
      for (const statement of migration.sql) {
        const sql = statement.trim();
        if (!sql) {
          continue;
        }
        await pool.query(sql);
      }
      await pool.query(`insert into ${tableName} ("hash", "created_at") values ($1, $2)`, [
        migration.hash,
        migration.folderMillis
      ]);
      await pool.query("commit");
      lastAppliedMillis = migration.folderMillis;
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}

export async function runMigrations(closePool = false): Promise<void> {
  const config = getReportSystemConfig();
  await ensureSchemaExists(config.dbMigrationsSchema);
  await ensureMigrationsTable(config.dbMigrationsSchema, config.dbMigrationsTable);
  await applyPendingMigrations(config.dbMigrationsSchema, config.dbMigrationsTable);
  console.log("Database migrations completed.");
  if (closePool) {
    await pool.end();
  }
}

const isDirectRun = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectRun) {
  runMigrations(true).catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
}
