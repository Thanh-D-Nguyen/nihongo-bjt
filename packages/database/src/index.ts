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
    // Avoid throwing at module import time so dev watch tools (tsx/turbo)
    // don't keep restarting the process. Return a proxy that will throw a
    // helpful error when any Prisma property/method is actually accessed.
    // This keeps the app running in dev so other non-DB routes remain available.
    const handler: ProxyHandler<object> = {
      get() {
        throw new Error(
          "DATABASE_URL is required to use Prisma. Set DATABASE_URL in your .env or start Postgres."
        );
      },
      apply() {
        throw new Error(
          "DATABASE_URL is required to use Prisma. Set DATABASE_URL in your .env or start Postgres."
        );
      }
    };
    return new Proxy({}, handler) as unknown as PrismaClient;
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
