import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt?schema=content";

export default defineConfig({
  schema: "packages/database/prisma/schema.prisma",
  migrations: {
    path: "packages/database/prisma/migrations"
  },
  datasource: {
    url: datasourceUrl
  }
});
