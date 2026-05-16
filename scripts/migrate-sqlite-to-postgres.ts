import fs from "node:fs";
import { execFileSync } from "node:child_process";

import { Client } from "pg";

type Options = {
  sqlitePath: string;
  pgUrl: string;
  schema: string;
  batchSize: number;
  dryRun: boolean;
  truncateBeforeLoad: boolean;
  includeTables: Set<string> | null;
  useSourceSnapshot: boolean;
  conflictMode: "error" | "ignore";
  failOnRowCountMismatch: boolean;
};

type ForeignKeyRelation = {
  child: string;
  parent: string;
};

type SourceColumnInfo = {
  cid: number;
  name: string;
  pk: number;
};

type TableStats = {
  table: string;
  sourceRows: number;
  insertedRows: number;
  targetRowsBefore: number;
  targetRowsAfter: number;
  skipped: boolean;
  reason?: string;
};

const PG_BIND_PARAMETER_SAFETY_LIMIT = 60000;
const ALWAYS_EXCLUDED_TABLES = new Set(["master_data_sync_log", "report_source_snapshot"]);

function parseSqliteLiteralToken(token: string): unknown {
  const normalized = token.trim();
  if (normalized === "NULL") {
    return null;
  }

  const blobMatch = normalized.match(/^x'([0-9a-fA-F]*)'$/i);
  if (blobMatch) {
    return Buffer.from(blobMatch[1], "hex");
  }

  if (normalized.startsWith("'") && normalized.endsWith("'")) {
    const inner = normalized.slice(1, -1);
    return inner.replace(/''/g, "'");
  }

  if (/^[+-]?\d+$/.test(normalized)) {
    try {
      const value = BigInt(normalized);
      if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
        return normalized;
      }
      return Number(normalized);
    } catch {
      return normalized;
    }
  }

  if (/^[+-]?\d*\.\d+(e[+-]?\d+)?$/i.test(normalized) || /^[+-]?\d+e[+-]?\d+$/i.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : normalized;
  }

  if (normalized === "true" || normalized === "TRUE") {
    return true;
  }
  if (normalized === "false" || normalized === "FALSE") {
    return false;
  }

  return normalized;
}

function decodeQuotedRow(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  const decoded: Record<string, unknown> = {};
  for (const column of columns) {
    const raw = row[column];
    decoded[column] = parseSqliteLiteralToken(String(raw ?? "NULL"));
  }
  return decoded;
}

function parseArgs(argv: string[]): Options {
  const args = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unknown argument: ${token}`);
    }
    const key = token.slice(2);
    if (
      key === "dry-run" ||
      key === "no-truncate" ||
      key === "truncate" ||
      key === "on-conflict-ignore" ||
      key === "skip-source-snapshot" ||
      key === "allow-rowcount-mismatch"
    ) {
      args.set(key, true);
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args.set(key, value);
    i += 1;
  }

  const sqlitePath = String(args.get("sqlite") || "").trim();
  if (!sqlitePath) {
    throw new Error("Missing --sqlite <path-to-sqlite-file>");
  }

  const pgUrl = String(args.get("pg-url") || process.env.REPORT_SYSTEM_DB_URL || "").trim();
  if (!pgUrl) {
    throw new Error("Missing --pg-url and REPORT_SYSTEM_DB_URL is empty");
  }

  const schema = String(args.get("schema") || "public").trim() || "public";
  const batchSize = Number.parseInt(String(args.get("batch-size") || "1000"), 10);
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("--batch-size must be a positive integer");
  }

  const tablesRaw = String(args.get("tables") || "").trim();
  const includeTables =
    tablesRaw.length > 0
      ? new Set(
          tablesRaw
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        )
      : null;

  const explicitTruncate = Boolean(args.get("truncate"));
  const explicitNoTruncate = Boolean(args.get("no-truncate"));
  if (explicitTruncate && explicitNoTruncate) {
    throw new Error("--truncate and --no-truncate cannot be used together");
  }

  const conflictMode: "error" | "ignore" = Boolean(args.get("on-conflict-ignore")) ? "ignore" : "error";
  const failOnRowCountMismatch = !Boolean(args.get("allow-rowcount-mismatch"));

  return {
    sqlitePath,
    pgUrl,
    schema,
    batchSize,
    dryRun: Boolean(args.get("dry-run")),
    truncateBeforeLoad: explicitTruncate ? true : explicitNoTruncate ? false : false,
    includeTables,
    useSourceSnapshot: !Boolean(args.get("skip-source-snapshot")),
    conflictMode,
    failOnRowCountMismatch
  };
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function quoteSqliteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function quoteSqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function createSourceSnapshotPath(sourcePath: string): string {
  const safeBase = sourcePath
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "_") || "source.sqlite";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `/tmp/report-system-migration-${stamp}-${safeBase}`;
}

function createSqliteSnapshot(sourcePath: string): string {
  const snapshotPath = createSourceSnapshotPath(sourcePath);
  const backupCmd = `.backup ${quoteSqliteString(snapshotPath)}`;
  execFileSync("sqlite3", [sourcePath, backupCmd], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return snapshotPath;
}

function runSqliteJson<T = Record<string, unknown>>(sqlitePath: string, sql: string): T[] {
  const maxBufferMbRaw = String(process.env.SQLITE_JSON_MAX_BUFFER_MB || "128").trim();
  const maxBufferMb = Number.parseInt(maxBufferMbRaw, 10);
  const maxBuffer = (Number.isFinite(maxBufferMb) && maxBufferMb > 0 ? maxBufferMb : 128) * 1024 * 1024;
  const timeoutSecRaw = String(process.env.SQLITE_JSON_TIMEOUT_SEC || "300").trim();
  const timeoutSec = Number.parseInt(timeoutSecRaw, 10);
  const timeoutMs = (Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec : 300) * 1000;
  const output = execFileSync("sqlite3", ["-readonly", "-json", sqlitePath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer,
    timeout: timeoutMs
  });
  const text = output.trim();
  if (!text) {
    return [];
  }
  return JSON.parse(text) as T[];
}

function runSqliteScalarNumber(sqlitePath: string, sql: string): number {
  const rows = runSqliteJson<Record<string, unknown>>(sqlitePath, sql);
  if (rows.length === 0) {
    return 0;
  }
  const first = rows[0];
  const firstKey = Object.keys(first)[0];
  const rawValue = firstKey ? first[firstKey] : 0;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function runSqliteInsertSql(sqlitePath: string, table: string, selectedExpr: string): string {
  const maxBufferMbRaw = String(process.env.SQLITE_INSERT_MAX_BUFFER_MB || "512").trim();
  const maxBufferMb = Number.parseInt(maxBufferMbRaw, 10);
  const maxBuffer = (Number.isFinite(maxBufferMb) && maxBufferMb > 0 ? maxBufferMb : 512) * 1024 * 1024;
  const timeoutSecRaw = String(process.env.SQLITE_INSERT_TIMEOUT_SEC || "1800").trim();
  const timeoutSec = Number.parseInt(timeoutSecRaw, 10);
  const timeoutMs = (Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec : 1800) * 1000;
  return execFileSync(
    "sqlite3",
    [
      "-readonly",
      sqlitePath,
      `.mode insert ${quoteSqliteIdent(table)}`,
      `select ${selectedExpr} from ${quoteSqliteIdent(table)}`
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer,
      timeout: timeoutMs
    }
  );
}

function listSourceTables(sqlitePath: string): string[] {
  const rows = runSqliteJson<{ name: string }>(
    sqlitePath,
    "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"
  );
  return rows
    .map((row) => row.name)
    .filter((name) => name !== "__drizzle_migrations" && !ALWAYS_EXCLUDED_TABLES.has(name));
}

async function listTargetTables(client: Client, schema: string): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = $1
        and table_type = 'BASE TABLE'
      order by table_name`,
    [schema]
  );
  return result.rows.map((row) => row.table_name).filter((name) => name !== "__drizzle_migrations");
}

async function listForeignKeyRelations(client: Client, schema: string): Promise<ForeignKeyRelation[]> {
  const result = await client.query<{ child: string; parent: string }>(
    `select tc.table_name as child, ccu.table_name as parent
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu
         on tc.constraint_catalog = ccu.constraint_catalog
        and tc.constraint_schema = ccu.constraint_schema
        and tc.constraint_name = ccu.constraint_name
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = $1
        and ccu.table_schema = $1`,
    [schema]
  );
  return result.rows;
}

function topoSortTables(tables: string[], relations: ForeignKeyRelation[]): string[] {
  const tableSet = new Set(tables);
  const inDegree = new Map<string, number>();
  const children = new Map<string, Set<string>>();

  for (const table of tables) {
    inDegree.set(table, 0);
    children.set(table, new Set<string>());
  }

  for (const relation of relations) {
    if (!tableSet.has(relation.child) || !tableSet.has(relation.parent)) {
      continue;
    }
    if (relation.child === relation.parent) {
      continue;
    }
    const bucket = children.get(relation.parent);
    if (!bucket || bucket.has(relation.child)) {
      continue;
    }
    bucket.add(relation.child);
    inDegree.set(relation.child, (inDegree.get(relation.child) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [table, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(table);
    }
  }
  queue.sort();

  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    const nextTables = Array.from(children.get(current) || []);
    nextTables.sort();
    for (const next of nextTables) {
      const nextDegree = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  if (ordered.length === tables.length) {
    return ordered;
  }

  const unresolved = tables.filter((table) => !ordered.includes(table)).sort();
  console.warn(
    `[sqlite->pg] detected cycle or unresolved FK graph for tables: ${unresolved.join(", ")}; appending them at tail`
  );
  return ordered.concat(unresolved);
}

async function listTargetColumns(client: Client, schema: string, table: string): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `select column_name
       from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position`,
    [schema, table]
  );
  return result.rows.map((row) => row.column_name);
}

function listSourceColumnInfos(sqlitePath: string, table: string): SourceColumnInfo[] {
  return runSqliteJson<SourceColumnInfo>(
    sqlitePath,
    `select cid, name, pk from pragma_table_info(${quoteSqliteIdent(table)}) order by cid`
  );
}

function buildSourceOrderByExpr(sourceColumns: SourceColumnInfo[], selectedColumns: string[]): string {
  const selectedSet = new Set(selectedColumns);
  const primaryKeyColumns = sourceColumns
    .filter((column) => Number(column.pk) > 0 && selectedSet.has(column.name))
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map((column) => column.name);
  if (primaryKeyColumns.length > 0) {
    return primaryKeyColumns.map((column) => quoteSqliteIdent(column)).join(", ");
  }

  const idFallback = sourceColumns.find((column) => column.name === "id" && selectedSet.has("id"));
  if (idFallback) {
    return quoteSqliteIdent("id");
  }

  const firstSelected = sourceColumns.find((column) => selectedSet.has(column.name));
  if (firstSelected) {
    return quoteSqliteIdent(firstSelected.name);
  }

  return "";
}

function assertNoEmbeddedNulText(sqlitePath: string, table: string, selectedColumns: string[]): void {
  const quotedTable = quoteSqliteIdent(table);
  for (const column of selectedColumns) {
    const quotedColumn = quoteSqliteIdent(column);
    const count = runSqliteScalarNumber(
      sqlitePath,
      `select count(*) as cnt from ${quotedTable} where typeof(${quotedColumn})='text' and instr(${quotedColumn}, char(0)) > 0`
    );
    if (count > 0) {
      throw new Error(
        `[sqlite->pg] [${table}] column ${column} contains ${count} text row(s) with embedded NUL (\\u0000). Current exporter would truncate such values; aborting to prevent silent data corruption.`
      );
    }
  }
}

async function batchInsertRows(
  client: Client,
  schema: string,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  conflictMode: "error" | "ignore"
): Promise<number> {
  const quotedTable = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const quotedColumns = columns.map((column) => quoteIdent(column)).join(", ");
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let index = 1;

  for (const row of rows) {
    const rowPlaceholders: string[] = [];
    for (const column of columns) {
      rowPlaceholders.push(`$${index}`);
      index += 1;
      values.push(Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null);
    }
    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  }

  const onConflictClause = conflictMode === "ignore" ? " on conflict do nothing" : "";
  const sql = `insert into ${quotedTable} (${quotedColumns}) values ${placeholders.join(", ")}${onConflictClause}`;
  const result = await client.query(sql, values);
  return Number(result.rowCount || 0);
}

async function resetPrimaryKeySequence(client: Client, schema: string, table: string): Promise<void> {
  const fullTable = `${schema}.${table}`;
  const sequenceResult = await client.query<{ sequence_name: string | null }>(
    "select pg_get_serial_sequence($1, 'id') as sequence_name",
    [fullTable]
  );
  const sequenceName = sequenceResult.rows[0]?.sequence_name;
  if (!sequenceName) {
    return;
  }

  const resetSql = `select setval(
    $1,
    coalesce((select max(id) from ${quoteIdent(schema)}.${quoteIdent(table)}), 1),
    coalesce((select max(id) from ${quoteIdent(schema)}.${quoteIdent(table)}) is not null, false)
  )`;
  await client.query(resetSql, [sequenceName]);
}

async function countTargetRows(client: Client, schema: string, table: string): Promise<number> {
  const sql = `select count(*)::bigint as cnt from ${quoteIdent(schema)}.${quoteIdent(table)}`;
  const result = await client.query<{ cnt: string }>(sql);
  const raw = result.rows[0]?.cnt || "0";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function migrateTable(
  client: Client,
  options: Options,
  table: string
): Promise<TableStats> {
  const targetRowsBefore = await countTargetRows(client, options.schema, table);
  const sourceColumnInfos = listSourceColumnInfos(options.sqlitePath, table);
  const sourceColumns = sourceColumnInfos.map((column) => column.name);
  const targetColumns = await listTargetColumns(client, options.schema, table);
  const sourceSet = new Set(sourceColumns);
  const selectedColumns = targetColumns.filter((column) => sourceSet.has(column));
  assertNoEmbeddedNulText(options.sqlitePath, table, selectedColumns);

  if (selectedColumns.length === 0) {
    return {
      table,
      sourceRows: 0,
      insertedRows: 0,
      targetRowsBefore,
      targetRowsAfter: targetRowsBefore,
      skipped: true,
      reason: "no common columns between source and target"
    };
  }

  const quotedTable = quoteSqliteIdent(table);
  const sourceRows = runSqliteScalarNumber(options.sqlitePath, `select count(*) as cnt from ${quotedTable}`);
  if (sourceRows === 0) {
    return { table, sourceRows: 0, insertedRows: 0, targetRowsBefore, targetRowsAfter: targetRowsBefore, skipped: false };
  }

  if (options.dryRun) {
    return { table, sourceRows, insertedRows: 0, targetRowsBefore, targetRowsAfter: targetRowsBefore, skipped: false };
  }

  let insertedRowsFromBatch = 0;
  let offset = 0;
  const maxBatchSizeByBindLimit = Math.max(1, Math.floor(PG_BIND_PARAMETER_SAFETY_LIMIT / selectedColumns.length));
  let currentBatchSize = Math.min(options.batchSize, maxBatchSizeByBindLimit);
  if (currentBatchSize < options.batchSize) {
    console.warn(
      `[sqlite->pg] [${table}] batch-size reduced from ${options.batchSize} to ${currentBatchSize} to fit postgres bind-parameter limits`
    );
  }
  const selectedExpr = selectedColumns.map((column) => quoteSqliteIdent(column)).join(", ");
  const selectedQuotedExpr = selectedColumns
    .map((column) => `quote(${quoteSqliteIdent(column)}) as ${quoteSqliteIdent(column)}`)
    .join(", ");
  const orderByExpr = buildSourceOrderByExpr(sourceColumnInfos, selectedColumns);
  const orderByClause = orderByExpr ? ` order by ${orderByExpr}` : "";
  while (offset < sourceRows) {
    let batchRows: Record<string, unknown>[];
    try {
      const rawBatchRows = runSqliteJson<Record<string, unknown>>(
        options.sqlitePath,
        `select ${selectedQuotedExpr} from ${quotedTable}${orderByClause} limit ${currentBatchSize} offset ${offset}`
      );
      batchRows = rawBatchRows.map((row) => decodeQuotedRow(row, selectedColumns));
    } catch (error: unknown) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code === "ETIMEDOUT" && currentBatchSize === 1) {
        const canFallbackToInsertSql =
          selectedColumns.length === targetColumns.length &&
          targetColumns.every((column, idx) => selectedColumns[idx] === column);
        if (!canFallbackToInsertSql) {
          throw error;
        }

        console.warn(
          `[sqlite->pg] [${table}] switching to sqlite insert-mode fallback due timeout on single-row JSON read`
        );
        const rawInsertSql = runSqliteInsertSql(options.sqlitePath, table, selectedExpr);
        if (rawInsertSql.trim().length > 0) {
          await client.query(rawInsertSql);
        }
        insertedRowsFromBatch = sourceRows;
        offset = sourceRows;
        break;
      }
      if ((code === "ENOBUFS" || code === "ETIMEDOUT") && currentBatchSize > 1) {
        currentBatchSize = Math.max(1, Math.floor(currentBatchSize / 2));
        console.warn(
          `[sqlite->pg] [${table}] batch read failed (code=${code}) at offset=${offset}, fallback batch-size=${currentBatchSize}`
        );
        continue;
      }
      throw error;
    }

    if (batchRows.length === 0) {
      break;
    }
    const insertedInBatch = await batchInsertRows(
      client,
      options.schema,
      table,
      selectedColumns,
      batchRows,
      options.conflictMode
    );
    insertedRowsFromBatch += insertedInBatch;
    offset += batchRows.length;
  }

  if (selectedColumns.includes("id")) {
    await resetPrimaryKeySequence(client, options.schema, table);
  }

  const targetRowsAfter = await countTargetRows(client, options.schema, table);
  const insertedRows = Math.max(0, targetRowsAfter - targetRowsBefore);
  if (options.failOnRowCountMismatch) {
    const expectedRows = options.truncateBeforeLoad ? sourceRows : targetRowsBefore + sourceRows;
    if (targetRowsAfter !== expectedRows) {
      throw new Error(
        `[sqlite->pg] [${table}] row-count mismatch: source=${sourceRows}, target_before=${targetRowsBefore}, target_after=${targetRowsAfter}, expected_after=${expectedRows}.`
      );
    }
  }
  if (options.conflictMode === "ignore" && insertedRows !== insertedRowsFromBatch) {
    console.warn(
      `[sqlite->pg] [${table}] warning: inserted rows computed from target delta (${insertedRows}) differs from insert rowCount (${insertedRowsFromBatch})`
    );
  }

  return { table, sourceRows, insertedRows, targetRowsBefore, targetRowsAfter, skipped: false };
}

function printUsage(): void {
  console.log(`Usage:
  tsx scripts/migrate-sqlite-to-postgres.ts --sqlite <sqlite-file-path> [options]

Options:
  --pg-url <postgres-url>      PostgreSQL connection URL (default: REPORT_SYSTEM_DB_URL)
  --schema <schema>            PostgreSQL schema (default: public)
  --batch-size <n>             Insert batch size per table (default: 1000)
  --tables <a,b,c>             Only migrate selected tables
  --dry-run                    Only print migration plan and row counts
  --truncate                   Truncate target tables before loading (disabled by default)
  --no-truncate                Explicitly disable truncate
  --on-conflict-ignore         Ignore PK/unique conflicts via ON CONFLICT DO NOTHING
  --skip-source-snapshot       Read directly from source SQLite file without creating snapshot backup
  --allow-rowcount-mismatch    Do not fail when source/target row counts mismatch after table migration

Always excluded tables:
  master_data_sync_log, report_source_snapshot

Environment:
  SQLITE_JSON_MAX_BUFFER_MB    sqlite3 JSON output buffer in MB (default: 128)
  SQLITE_JSON_TIMEOUT_SEC      sqlite3 query timeout in seconds (default: 300)
  SQLITE_INSERT_MAX_BUFFER_MB  sqlite3 insert-mode buffer in MB (default: 512)
  SQLITE_INSERT_TIMEOUT_SEC    sqlite3 insert-mode timeout in seconds (default: 1800)
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.sqlitePath)) {
    throw new Error(`SQLite file not found: ${options.sqlitePath}`);
  }

  let sqlitePathForRead = options.sqlitePath;
  let snapshotPath: string | null = null;
  if (options.useSourceSnapshot) {
    snapshotPath = createSqliteSnapshot(options.sqlitePath);
    sqlitePathForRead = snapshotPath;
    console.log(`[sqlite->pg] source snapshot created: ${snapshotPath}`);
  }

  const effectiveOptions: Options = {
    ...options,
    sqlitePath: sqlitePathForRead
  };

  const client = new Client({ connectionString: options.pgUrl });
  let connected = false;
  try {
    await client.connect();
    connected = true;

    const sourceTables = listSourceTables(effectiveOptions.sqlitePath);
    const targetTables = await listTargetTables(client, effectiveOptions.schema);
    const targetSet = new Set(targetTables);

    if (effectiveOptions.includeTables && effectiveOptions.includeTables.size > 0) {
      const requestedExcluded = Array.from(effectiveOptions.includeTables.values()).filter((table) =>
        ALWAYS_EXCLUDED_TABLES.has(table)
      );
      if (requestedExcluded.length > 0) {
        console.warn(
          `[sqlite->pg] always-excluded tables were requested and will be ignored: ${requestedExcluded.join(", ")}`
        );
      }
    }

    let candidateTables = sourceTables.filter((table) => targetSet.has(table));
    if (effectiveOptions.includeTables) {
      candidateTables = candidateTables.filter((table) => effectiveOptions.includeTables!.has(table));
    }
    if (effectiveOptions.includeTables && effectiveOptions.includeTables.size > 0) {
      const requestedTables = Array.from(effectiveOptions.includeTables.values());
      const missingInSource = requestedTables.filter((table) => !sourceTables.includes(table));
      const missingInTarget = requestedTables.filter((table) => !targetSet.has(table));
      if (missingInSource.length > 0) {
        console.warn(
          `[sqlite->pg] requested tables missing in source sqlite: ${missingInSource.join(", ")}`
        );
      }
      if (missingInTarget.length > 0) {
        console.warn(
          `[sqlite->pg] requested tables missing in target schema ${effectiveOptions.schema}: ${missingInTarget.join(", ")}`
        );
      }
    }

    const skippedSourceTables = sourceTables.filter((table) => !targetSet.has(table));
    if (skippedSourceTables.length > 0) {
      console.warn(
        `[sqlite->pg] skip source-only tables (not found in target schema ${effectiveOptions.schema}): ${skippedSourceTables.join(
          ", "
        )}`
      );
    }

    if (candidateTables.length === 0) {
      console.log("[sqlite->pg] no tables to migrate");
      return;
    }

    const fkRelations = await listForeignKeyRelations(client, effectiveOptions.schema);
    const orderedTables = topoSortTables(candidateTables, fkRelations);

    console.log(`[sqlite->pg] sqlite source: ${options.sqlitePath}`);
    console.log(`[sqlite->pg] sqlite read-file: ${effectiveOptions.sqlitePath}`);
    console.log(`[sqlite->pg] pg schema: ${effectiveOptions.schema}`);
    console.log(`[sqlite->pg] tables to migrate (${orderedTables.length}): ${orderedTables.join(", ")}`);
    console.log(
      `[sqlite->pg] mode: ${options.dryRun ? "dry-run" : "execute"}, truncate: ${
        effectiveOptions.truncateBeforeLoad && !effectiveOptions.dryRun ? "yes" : "no"
      }, conflict-mode: ${effectiveOptions.conflictMode}, rowcount-check: ${
        effectiveOptions.failOnRowCountMismatch ? "strict" : "relaxed"
      }, batch-size: ${effectiveOptions.batchSize}`
    );

    if (!effectiveOptions.dryRun) {
      await client.query("begin");
      if (effectiveOptions.truncateBeforeLoad) {
        const truncateTargets = orderedTables.map((table) => `${quoteIdent(effectiveOptions.schema)}.${quoteIdent(table)}`);
        await client.query(`truncate table ${truncateTargets.join(", ")} restart identity cascade`);
      }
    }

    const stats: TableStats[] = [];
    for (const table of orderedTables) {
      const tableStats = await migrateTable(client, effectiveOptions, table);
      stats.push(tableStats);
      if (tableStats.skipped) {
        console.log(`[sqlite->pg] [${table}] skipped: ${tableStats.reason}`);
        continue;
      }
      if (effectiveOptions.dryRun) {
        console.log(
          `[sqlite->pg] [${table}] source rows: ${tableStats.sourceRows}, target rows(before): ${tableStats.targetRowsBefore}`
        );
      } else {
        console.log(
          `[sqlite->pg] [${table}] source rows: ${tableStats.sourceRows}, inserted rows: ${tableStats.insertedRows}, target rows(before->after): ${tableStats.targetRowsBefore}->${tableStats.targetRowsAfter}`
        );
      }
    }

    if (!effectiveOptions.dryRun) {
      await client.query("commit");
    }

    const totalSource = stats.reduce((sum, item) => sum + item.sourceRows, 0);
    const totalInserted = stats.reduce((sum, item) => sum + item.insertedRows, 0);
    console.log(
      `[sqlite->pg] completed. table_count=${stats.length}, source_rows=${totalSource}, inserted_rows=${totalInserted}`
    );
  } catch (error) {
    if (!effectiveOptions.dryRun && connected) {
      await client.query("rollback");
    }
    throw error;
  } finally {
    if (connected) {
      await client.end();
    }
    if (snapshotPath && fs.existsSync(snapshotPath)) {
      try {
        fs.unlinkSync(snapshotPath);
        console.log(`[sqlite->pg] source snapshot removed: ${snapshotPath}`);
      } catch (cleanupError) {
        console.warn(
          `[sqlite->pg] warning: failed to remove source snapshot ${snapshotPath}: ${
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }`
        );
      }
    }
  }
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage();
} else {
  main().catch((error) => {
    console.error("[sqlite->pg] migration failed");
    console.error(error);
    process.exit(1);
  });
}
