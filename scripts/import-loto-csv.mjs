// Import Loto6/Loto7 historical draws from CSV into PostgreSQL.
// Usage: node scripts/import-loto-csv.mjs ./loto.csv [loto6|loto7]
//
// CSV headers:
// game,drawNumber,drawDate,n1,n2,n3,n4,n5,n6,n7,bonus,bonus1,bonus2,carryoverAmount,salesAmount,sourceUrl

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../packages/database/generated/client/index.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const specs = {
  loto6: { mainCount: 6, bonusCount: 1, maxNumber: 43 },
  loto7: { mainCount: 7, bonusCount: 2, maxNumber: 37 },
};

function cells(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === "\"" && quoted && line[i + 1] === "\"") {
      current += "\"";
      i += 1;
    } else if (c === "\"") {
      quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  out.push(current.trim());
  return out;
}

function intValue(value) {
  if (!value) return undefined;
  const parsed = Number(String(value).replace(/[,_\s円]/gu, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bigintValue(value) {
  const parsed = intValue(value);
  return parsed === undefined ? undefined : BigInt(parsed);
}

function parseRows(text, fallbackGame) {
  const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const headers = cells(lines.shift() ?? "").map((header) => header.replace(/^\uFEFF/u, "").toLowerCase());
  return lines.map((line, index) => {
    const row = Object.fromEntries(headers.map((header, i) => [header, cells(line)[i] ?? ""]));
    const game = (row.game || fallbackGame || "").toLowerCase();
    const spec = specs[game];
    if (!spec) throw new Error(`Row ${index + 2}: game must be loto6 or loto7`);
    const mainNumbers = Array.from({ length: spec.mainCount }, (_, i) => intValue(row[`n${i + 1}`]));
    const bonusNumbers = spec.bonusCount === 1
      ? [intValue(row.bonus ?? row.bonus1)]
      : [intValue(row.bonus1), intValue(row.bonus2)];
    if (mainNumbers.some((n) => n === undefined) || bonusNumbers.some((n) => n === undefined)) {
      throw new Error(`Row ${index + 2}: missing numbers`);
    }
    const allNumbers = [...mainNumbers, ...bonusNumbers];
    for (const n of allNumbers) {
      if (!Number.isInteger(n) || n < 1 || n > spec.maxNumber) {
        throw new Error(`Row ${index + 2}: number ${n} outside 1-${spec.maxNumber}`);
      }
    }
    return {
      game,
      drawNumber: intValue(row.drawnumber ?? row.draw_number),
      drawDate: row.drawdate ?? row.draw_date ?? row.date,
      mainNumbers: mainNumbers.sort((a, b) => a - b),
      bonusNumbers: bonusNumbers.sort((a, b) => a - b),
      carryoverAmount: bigintValue(row.carryoveramount ?? row.carryover_amount),
      salesAmount: bigintValue(row.salesamount ?? row.sales_amount),
      sourceUrl: (row.sourceurl ?? row.source_url) || undefined,
    };
  });
}

async function main() {
  const [, , filePath, fallbackGame] = process.argv;
  if (!filePath) throw new Error("CSV path is required");
  const rows = parseRows(await readFile(filePath, "utf8"), fallbackGame);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.drawNumber || !row.drawDate) throw new Error("drawNumber and drawDate are required");
    const existing = await prisma.lotoDraw.findUnique({
      where: { game_drawNumber: { game: row.game, drawNumber: row.drawNumber } },
    });
    await prisma.lotoDraw.upsert({
      where: { game_drawNumber: { game: row.game, drawNumber: row.drawNumber } },
      create: { ...row, drawDate: new Date(`${row.drawDate.slice(0, 10)}T00:00:00.000Z`) },
      update: { ...row, drawDate: new Date(`${row.drawDate.slice(0, 10)}T00:00:00.000Z`), importedAt: new Date() },
    });
    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`Imported ${rows.length} rows. Created: ${created}. Updated: ${updated}.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
