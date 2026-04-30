import { parseServerEnv } from "@nihongo-bjt/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "reflect-metadata";

import { AppModule } from "../src/app.module.js";
import {
  AdminUserInviteRequestOpenApiDto,
  AdminUserInviteResponseOpenApiDto
} from "../src/openapi/dto/admin-user-invite-openapi.dto.js";
import { ApiConflictBodyDto, ApiErrorResponseDto } from "../src/openapi/dto/api-error.dto.js";
import { HealthStatusOpenApiDto, VersionOpenApiDto } from "../src/openapi/dto/health-openapi.dto.js";
import {
  BookmarkToggleOpenApiDto,
  FeatureFlagOpenApiDto,
  LearnerProfileEnvelopeOpenApiDto,
  LearnerProfileOpenApiDto
} from "../src/openapi/dto/backend-api-openapi.dto.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

async function main() {
  const env = parseServerEnv(process.env);
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api");

  const config = new DocumentBuilder()
    .setTitle("NihonGo BJT API")
    .setDescription("Generated OpenAPI contract for NihonGo BJT.")
    .setVersion(process.env.npm_package_version ?? "0.0.0")
    .addServer(env.API_PUBLIC_URL.replace(/\/$/u, ""), "This deployment")
    .addBearerAuth({ bearerFormat: "JWT", scheme: "bearer", type: "http" }, "bearer")
    .addApiKey({ in: "header", name: "x-admin-actor-id", type: "apiKey" }, "admin-actor")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      ApiErrorResponseDto,
      ApiConflictBodyDto,
      HealthStatusOpenApiDto,
      VersionOpenApiDto,
      LearnerProfileOpenApiDto,
      LearnerProfileEnvelopeOpenApiDto,
      BookmarkToggleOpenApiDto,
      FeatureFlagOpenApiDto,
      AdminUserInviteRequestOpenApiDto,
      AdminUserInviteResponseOpenApiDto
    ],
    operationIdFactory: (_ctrlKey, methodKey) => methodKey
  });

  const apiOutput = resolve(dirname(fileURLToPath(import.meta.url)), "../openapi/openapi.json");
  const docsOutput = resolve(dirname(fileURLToPath(import.meta.url)), "../../../docs/openapi.json");
  const payload = `${JSON.stringify(document, null, 2)}\n`;
  await mkdir(dirname(apiOutput), { recursive: true });
  await mkdir(dirname(docsOutput), { recursive: true });
  await writeFile(apiOutput, payload, "utf8");
  await writeFile(docsOutput, payload, "utf8");
  await app.close();
  console.log(`Generated OpenAPI document: ${apiOutput}`);
  console.log(`Generated OpenAPI document: ${docsOutput}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
