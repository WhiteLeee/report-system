import { sqlite, dbPath } from "../backend/database/client";

type TableTarget = {
  name: string;
  resetSequence?: boolean;
};

const BUSINESS_TABLES: TableTarget[] = [
  { name: "report_rectification_sync_log", resetSequence: true },
  { name: "report_rectification_sync_batch", resetSequence: true },
  { name: "report_rectification_order", resetSequence: true },
  { name: "report_review_log", resetSequence: true },
  { name: "report_inspection", resetSequence: true },
  { name: "report_issue", resetSequence: true },
  { name: "report_image", resetSequence: true },
  { name: "report_store", resetSequence: true },
  { name: "report", resetSequence: true }
];

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function countRows(tableName: string): number {
  const row = sqlite.prepare(`select count(*) as count from ${tableName}`).get() as { count?: number };
  return Number(row.count || 0);
}

function clearBusinessData(): Array<{ table: string; deleted: number }> {
  const beforeCounts = BUSINESS_TABLES.map((table) => ({
    table: table.name,
    deleted: countRows(table.name)
  }));

  const cleanup = sqlite.transaction(() => {
    for (const table of BUSINESS_TABLES) {
      sqlite.prepare(`delete from ${table.name}`).run();
      if (table.resetSequence) {
        sqlite.prepare("delete from sqlite_sequence where name = ?").run(table.name);
      }
    }
  });

  cleanup();

  return beforeCounts;
}

function main(): void {
  const dryRun = hasFlag("--dry-run");

  const existing = BUSINESS_TABLES.map((table) => ({
    table: table.name,
    count: countRows(table.name)
  }));
  const total = existing.reduce((sum, item) => sum + item.count, 0);

  console.log(`Business data database: ${dbPath}`);
  console.log("Business tables:");
  for (const item of existing) {
    console.log(`- ${item.table}: ${item.count}`);
  }
  console.log(`Total rows to clear: ${total}`);

  if (dryRun) {
    console.log("Dry run only, no data deleted.");
    return;
  }

  const deleted = clearBusinessData();
  console.log("Business data cleared.");
  for (const item of deleted) {
    console.log(`- ${item.table}: deleted ${item.deleted}`);
  }
}

main();
