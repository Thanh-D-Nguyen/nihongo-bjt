import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../generated/client/index.js";

export { Prisma, PrismaClient };
export type {
  ContentImportBatch,
  ContentImportError,
  ContentImportMapping,
  ContentRawItem,
  BjtMockTest,
  BjtQuestion,
  BjtQuestionOption,
  BjtTestSection,
  QuizAnswer,
  QuizSession
} from "../generated/client/index.js";

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (connectionString === undefined || connectionString.trim() === "") {
    throw new Error("DATABASE_URL is required to create a Prisma client");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });
}

export {
  clearSqlFileCache,
  loadSqlFile,
  loadSqlFileSync,
  resolveMonorepoRoot,
  resolveSqlFilePath,
  type SqlScriptCategory
} from "./sql/load-sql.js";
