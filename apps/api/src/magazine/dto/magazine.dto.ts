import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from "class-validator";
import { Type } from "class-transformer";

export class ListMagazineQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  widgetKind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class MarkReadBody {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quizScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quizTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  vocabSavedCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timeSpentSeconds?: number;
}

export class AdminGenerateBody {
  @ApiProperty({ type: String, example: "magazine_vocab" })
  @IsString()
  widgetKind!: string;

  @ApiProperty({ type: String, example: "2026-05-25" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ type: String, default: "vi" })
  @IsOptional()
  @IsString()
  locale?: string;
}
