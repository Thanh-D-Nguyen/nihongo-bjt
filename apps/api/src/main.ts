import { parseServerEnv } from "@nihongo-bjt/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { config as loadEnv } from "dotenv";
import helmet from "helmet";
import { ZodError } from "zod";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "reflect-metadata";

import { AppModule } from "./app.module.js";
import { GlobalExceptionFilter } from "./global-exception.filter.js";
import { setupSwagger } from "./openapi/setup-swagger.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

async function bootstrap() {
  let env: ReturnType<typeof parseServerEnv>;
  try {
    env = parseServerEnv(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`).join("; ");
      console.error(`Invalid server environment: ${issues}`);
      process.exit(1);
    }
    throw error;
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
    rawBody: true
  });
  app.useBodyParser("json", { limit: "5mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "5mb" });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"]
        }
      }
    })
  );
  app.enableCors({
    credentials: true,
    origin: env.CORS_ORIGINS
  });
  app.setGlobalPrefix("api");

  setupSwagger(app, env);

  await app.listen(env.API_PORT);
}

void bootstrap();
