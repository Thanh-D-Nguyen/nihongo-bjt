import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Common NestJS HTTP exception body (shape may vary for `message`: string or array from validation).
 */
export class ApiErrorResponseDto {
  @ApiProperty({ type: () => Number, example: 400, minimum: 400, maximum: 599 })
  statusCode!: number;

  @ApiProperty({
    type: "string",
    example: "Bad Request",
    description: "Error message, or (for class-validator) an array of validation messages in some responses."
  })
  message!: string | string[];

  @ApiPropertyOptional({ type: "string", example: "Bad Request" })
  error?: string;
}

/** Conflict with optional machine-readable payload (e.g. duplicate email on invite). */
export class ApiConflictBodyDto {
  @ApiProperty({ type: () => Number, example: 409 })
  statusCode!: number;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    example: { code: "email_taken", userId: "00000000-0000-4000-8000-000000000000" },
    description: "String or object payload; conflict codes are machine-readable when present."
  })
  message!: string | object;
}
