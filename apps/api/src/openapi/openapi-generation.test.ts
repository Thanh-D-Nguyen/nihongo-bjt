import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestFactory } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";

describe("OpenAPI generation", () => {
  it("creates a document with registered paths", async () => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";
    process.env.API_PUBLIC_URL ??= "http://localhost:4000";

    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api");

    const config = new DocumentBuilder()
      .setTitle("NihonGo BJT API")
      .setVersion("test")
      .addBearerAuth({ bearerFormat: "JWT", scheme: "bearer", type: "http" }, "bearer")
      .build();
    const document = SwaggerModule.createDocument(app, config);

    expect(Object.keys(document.paths).length).toBeGreaterThan(0);
    expect(document.paths["/api/auth/profile"]).toBeDefined();
    expect(document.paths["/api/admin/operations/feature-flags"]).toBeDefined();
    expect(document.paths["/api/admin/module-contracts"]).toBeDefined();
    expect(document.paths["/api/admin/monetization/plans"]).toBeDefined();

    const contractsGet = document.paths["/api/admin/module-contracts"]?.get;
    expect(contractsGet).toBeDefined();
    const okResponse = contractsGet?.responses?.["200"] as
      | { content?: { "application/json"?: { schema?: { items?: { $ref?: string } } } } }
      | undefined;
    expect(okResponse?.content?.["application/json"]?.schema?.items?.$ref).toBe(
      "#/components/schemas/AdminModuleContractOpenApiDto"
    );

    const adminPlansPost = document.paths["/api/admin/monetization/plans"]?.post as
      | (Record<string, unknown> & { responses?: Record<string, unknown> })
      | undefined;
    expect(adminPlansPost?.["x-admin-group"]).toBe("monetization");
    expect(adminPlansPost?.["x-admin-requires"]).toContain("admin.monetization.write");

    await app.close();
  });
});
