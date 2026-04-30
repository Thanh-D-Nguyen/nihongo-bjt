import { applyDecorators } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";

import { ApiConflictBodyDto, ApiErrorResponseDto } from "./dto/api-error.dto.js";

/**
 * Reusable error documentation for Zod- / Nest-validated routes (attach at **method** or **class**).
 * Does not affect runtime; Nest still returns the real exception shape.
 */
export function DocumentedHttpErrors() {
  return applyDecorators(
    ApiResponse({
      description: "Validation (Zod/Nest) or bad input.",
      status: 400,
      type: ApiErrorResponseDto
    }),
    ApiResponse({ description: "Missing or invalid Bearer / session.", status: 401, type: ApiErrorResponseDto }),
    ApiResponse({ description: "RBAC / scope denied.", status: 403, type: ApiErrorResponseDto }),
    ApiResponse({ description: "Resource not found.", status: 404, type: ApiErrorResponseDto }),
    ApiResponse({ description: "Conflict (e.g. duplicate, unique).", status: 409, type: ApiConflictBodyDto }),
    ApiResponse({
      description: "Unprocessable (if a dedicated pipe is used; otherwise 400 is common in this API).",
      status: 422,
      type: ApiErrorResponseDto
    }),
    ApiResponse({ description: "Rate limit (when enforced at gateway or Nest).", status: 429, type: ApiErrorResponseDto }),
    ApiResponse({ description: "Server error / DB.", status: 500, type: ApiErrorResponseDto })
  );
}
