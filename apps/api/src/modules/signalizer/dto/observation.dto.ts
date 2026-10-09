import { IsArray, IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

const ALLOWED_STATES = ['WATCH', 'SETUP_FORMING', 'READY', 'INVALIDATED', 'NO_TRADE'] as const;

export class ObservationDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  pairAnalyzed?: string;

  @IsOptional()
  @IsString()
  targetBotPair?: string;

  @IsOptional()
  @IsString()
  previousState?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_STATES as any)
  state?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number | null;

  @IsOptional()
  @IsISO8601()
  generatedAt?: string;

  @IsOptional()
  @IsBoolean()
  usdcAvailable?: boolean;

  @IsOptional()
  @IsArray()
  reasons?: string[];

  @IsOptional()
  @IsArray()
  rejectionReasons?: string[];

  // setup, aiAnalysis, pairValidation, market and other nested objects are allowed but not deeply validated here
  @IsOptional()
  setup?: any;

  @IsOptional()
  aiAnalysis?: any;

  @IsOptional()
  pairValidation?: any;

  @IsOptional()
  currentPrice?: number;

  @IsOptional()
  market?: any;
}
