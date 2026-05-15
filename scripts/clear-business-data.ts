import { sql } from "drizzle-orm";

import { db, dbUrl } from "../backend/database/client";

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

function hasFlag(flag: string): any {
  return process.argv.includes(flag);
}

async function countRows(tableName: string): Promise<any> {
  const rows = await db.execute<{ count: number }>(sql.raw(`select count(*)::int as count from ${tableName}`));
  return Number(rows.rows[0]?.count || 0);
}

async function clearBusinessData(): Promise<any> {
  const beforeCounts = await Promise.all(
    BUSINESS_TABLES.map(async (table): Promise<any> => ({
      table: table.name,
      deleted: await countRows(table.name)
    }))
  );

  await db.transaction(async (tx): Promise<any> => {
    for (const table of BUSINESS_TABLES) {
      if (table.resetSequence) {
        await tx.execute(sql.raw(`truncate table ${table.name} restart identity cascade`));
      } else {
        await tx.execute(sql.raw(`delete from ${table.name}`));
      }
    }
  });

  return beforeCounts;
}

async function main(): Promise<any> {
  const dryRun = hasFlag("--dry-run");

  const existing = await Promise.all(
    BUSINESS_TABLES.map(async (table): Promise<any> => ({
      table: table.name,
      count: await countRows(table.name)
    }))
  );
  const total = existing.reduce((sum, item) => sum + item.count, 0);

  console.log(`Business data database: ${dbUrl}`);
  console.log("Business tables:");
  for (const item of existing) {
    console.log(`- ${item.table}: ${item.count}`);
  }
  console.log(`Total rows to clear: ${total}`);

  if (dryRun) {
    console.log("Dry run only, no data deleted.");
    return;
  }

  const deleted = await clearBusinessData();
  console.log("Business data cleared.");
  for (const item of deleted) {
    console.log(`- ${item.table}: deleted ${item.deleted}`);
  }
}

await main();
