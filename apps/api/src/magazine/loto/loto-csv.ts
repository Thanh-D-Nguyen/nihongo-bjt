import { LOTO_GAME_SPECS, type LotoDrawInput, type LotoGame } from "./loto-types.js";

type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/u, "").toLowerCase();
}

function optionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[,_\s円]/gu, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalBigInt(value: string | undefined): bigint | undefined {
  const parsed = optionalInt(value);
  return parsed === undefined ? undefined : BigInt(parsed);
}

function requireInt(row: CsvRow, keys: string[], rowNumber: number): number {
  for (const key of keys) {
    const value = optionalInt(row[key]);
    if (value !== undefined) return value;
  }
  throw new Error(`Row ${rowNumber}: missing ${keys.join("/")}`);
}

function readNumbers(row: CsvRow, prefix: string, count: number, rowNumber: number): number[] {
  return Array.from({ length: count }, (_, index) =>
    requireInt(row, [`${prefix}${index + 1}`, `${prefix}_${index + 1}`], rowNumber),
  );
}

function readBonus(row: CsvRow, count: number, rowNumber: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const value = optionalInt(row[`bonus${index + 1}`] ?? row[`bonus_${index + 1}`]);
    if (value === undefined && count === 1) {
      const single = optionalInt(row.bonus);
      if (single !== undefined) return single;
    }
    if (value === undefined) throw new Error(`Row ${rowNumber}: missing bonus${index + 1}`);
    return value;
  });
}

function validateDraw(input: LotoDrawInput, rowNumber: number): LotoDrawInput {
  const spec = LOTO_GAME_SPECS[input.game];
  if (input.mainNumbers.length !== spec.mainCount) {
    throw new Error(`Row ${rowNumber}: ${input.game} requires ${spec.mainCount} main numbers`);
  }
  if (input.bonusNumbers.length !== spec.bonusCount) {
    throw new Error(`Row ${rowNumber}: ${input.game} requires ${spec.bonusCount} bonus numbers`);
  }
  const unique = new Set(input.mainNumbers);
  if (unique.size !== input.mainNumbers.length) {
    throw new Error(`Row ${rowNumber}: main numbers must be unique`);
  }
  for (const n of [...input.mainNumbers, ...input.bonusNumbers]) {
    if (!Number.isInteger(n) || n < 1 || n > spec.maxNumber) {
      throw new Error(`Row ${rowNumber}: number ${n} is outside 1-${spec.maxNumber}`);
    }
  }
  return {
    ...input,
    mainNumbers: [...input.mainNumbers].sort((a, b) => a - b),
    bonusNumbers: [...input.bonusNumbers].sort((a, b) => a - b),
  };
}

export function parseLotoCsv(csvText: string, fallbackGame?: LotoGame): LotoDrawInput[] {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!).map(normalizeHeader);
  return lines.slice(1).map((line, index) => {
    const rowNumber = index + 2;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex] ?? ""]));
    const game = (normalizeHeader(row.game ?? "") || fallbackGame) as LotoGame | undefined;
    if (!game || !(game in LOTO_GAME_SPECS)) {
      throw new Error(`Row ${rowNumber}: game must be loto6 or loto7`);
    }
    const spec = LOTO_GAME_SPECS[game];
    return validateDraw(
      {
        game,
        drawNumber: requireInt(row, ["drawnumber", "draw_number", "round", "kai"], rowNumber),
        drawDate: row.drawdate ?? row.draw_date ?? row.date ?? "",
        mainNumbers: readNumbers(row, "n", spec.mainCount, rowNumber),
        bonusNumbers: readBonus(row, spec.bonusCount, rowNumber),
        carryoverAmount: optionalBigInt(row.carryoveramount ?? row.carryover_amount),
        salesAmount: optionalBigInt(row.salesamount ?? row.sales_amount),
        sourceUrl: row.sourceurl ?? row.source_url,
        sourceProvider: "csv_import",
      },
      rowNumber,
    );
  });
}
