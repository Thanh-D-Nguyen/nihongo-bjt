import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { ServerEnv } from "@nihongo-bjt/config";

import { applyAdminOpenApiExtensions } from "../admin/admin-openapi.schema.js";

import {
  AdminUserInviteRequestOpenApiDto,
  AdminUserInviteResponseOpenApiDto
} from "./dto/admin-user-invite-openapi.dto.js";
import { ApiConflictBodyDto, ApiErrorResponseDto } from "./dto/api-error.dto.js";
import { HealthStatusOpenApiDto, VersionOpenApiDto } from "./dto/health-openapi.dto.js";
import {
  BookmarkToggleOpenApiDto,
  FeatureFlagOpenApiDto,
  LearnerProfileEnvelopeOpenApiDto,
  LearnerProfileOpenApiDto,
  QuizRemediationCardOpenApiDto,
  QuizSessionRemediationItemOpenApiDto,
  ReviewRemediationLinkOpenApiDto,
  ReviewSubmitOutcomeOpenApiDto,
  SubmitReviewRequestOpenApiDto
} from "./dto/backend-api-openapi.dto.js";

const DESCRIPTION = `NihonGo BJT HTTP API. **Learner and admin** clients obtain access tokens from **Keycloak** (Authorization Code + PKCE) — paste a Bearer access token in Swagger for testing. Never commit or send **client secrets** or **refresh tokens** in API requests to this spec.

**Admin API:** Endpoints under \`/api/admin\` use internal RBAC (permission strings). With Keycloak enabled, also send a valid JWT and ensure the user has a linked \`authz.admin_actor\`. When Keycloak is **disabled** (local dev), you may set header \`x-admin-actor-id\` to a known admin actor UUID — **not for production**.

**Account status** (user profile): \`pending\` | \`active\` | \`disabled\` | \`suspended\` | \`deleted\`. **Sensitive** mutations (status, plan, support notes) require a **reason** for audit.

**Common errors (NestJS):** \`400\` validation, \`401\` missing/invalid auth, \`403\` missing RBAC, \`404\` not found, \`409\` conflict, \`429\` rate limits (if enforced), \`500\` server. Request validation uses Zod; bodies may be \`{ message, statusCode, error }\` for 400.`;

export function setupSwagger(app: INestApplication, env: ServerEnv) {
  if (!env.SWAGGER_ENABLED) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle("NihonGo BJT API")
    .setDescription(DESCRIPTION)
    .setVersion(process.env.npm_package_version ?? "0.0.0")
    .addServer(env.API_PUBLIC_URL.replace(/\/$/u, ""), "This deployment")
    .addBearerAuth(
      {
        bearerFormat: "JWT",
        description:
          "OAuth2 access token issued by **Keycloak** (realm authorization server). Use the token from your learner or admin app session, not a client secret.",
        in: "header",
        name: "Authorization",
        scheme: "bearer",
        type: "http"
      },
      "bearer"
    )
    .addApiKey(
      {
        description:
          "**Local dev only** when `KEYCLOAK_ISSUER_URL` is unset: UUID of `authz.admin_actor` (see seed). Omitted in production — use Bearer JWT.",
        in: "header",
        name: "x-admin-actor-id",
        type: "apiKey"
      },
      "admin-actor"
    )
    .addTag("System Health", "Liveness, readiness, version, Keycloak admin integration status (non-secret).")
    .addTag("Auth", "Keycloak user profile, token introspection, OAuth helpers.")
    .addTag("Users", "Learner profile and app-user identity (Keycloak `sub` ↔ profile).")
    .addTag("Admin", "Admin API: CMS, support users, audit — **RBAC per route** in operation text.")
    .addTag("Admin Users", "Admin user list, detail, status, plan, support notes, **invite / create**.")
    .addTag("RBAC", "Admin `me` / session — internal permissions and actor linkage.")
    .addTag("Content", "Public dictionary content listing (lexeme, kanji, grammar, examples).")
    .addTag("Search", "Meilisearch-backed search projection.")
    .addTag("BJT Questions", "Quiz / BJT question flows (see `quiz` module).")
    .addTag("Flashcards", "User flashcard decks and **SRS** reviews.")
    .addTag("Study", "Learner study progress and related.")
    .addTag("Daily Hub", "Daily life widgets and actions.")
    .addTag("Reading Assist", "Japanese tokenization, dictionary, preferences; **BJT timed** may hide glosses server-side.")
    .addTag("Media", "Uploads, presigned URLs, object storage (provenance in DB).")
    .addTag("Import", "Content import (when enabled).")
    .addTag("Analytics", "Event ingest and **rollups** (metrics vs raw events).")
    .addTag("Monetization", "Plans, entitlements, quotas, billing-facing learner/admin endpoints.")
    .addTag("Ads", "Ad placements and decisions (when enabled).")
    .addTag("Social Sharing", "Growth / share templates (admin and public).")
    .addTag("Battle", "Realtime battle (Socket.IO).")
    .addTag("Audit", "Admin audit log reads.")
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
      SubmitReviewRequestOpenApiDto,
      ReviewSubmitOutcomeOpenApiDto,
      ReviewRemediationLinkOpenApiDto,
      QuizRemediationCardOpenApiDto,
      QuizSessionRemediationItemOpenApiDto,
      AdminUserInviteRequestOpenApiDto,
      AdminUserInviteResponseOpenApiDto
    ],
    operationIdFactory: (_ctrlKey, methodKey) => methodKey
  });

  applyAdminOpenApiExtensions(document);

  SwaggerModule.setup("docs", app, document, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "NihonGo BJT API",
    /** With `useGlobalPrefix: true`, serves at `/api/docs/openapi.json` (not `/api/openapi.json`). */
    jsonDocumentUrl: "docs/openapi.json",
    useGlobalPrefix: true
  });
}
