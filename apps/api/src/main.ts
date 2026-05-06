import { parseServerEnv } from "@nihongo-bjt/config";
import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { config as loadEnv } from "dotenv";
import helmet from "helmet";
import { ZodError } from "zod";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "reflect-metadata";

import { AppModule } from "./app.module.js";
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
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  app.useWebSocketAdapter(new IoAdapter(app));

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
