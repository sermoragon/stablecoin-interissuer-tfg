import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSimulatedPaymentDto {
  @IsString()
  @IsNotEmpty()
  instructionId!: string;

  @IsString()
  @IsNotEmpty()
  endToEndId!: string;

  @IsString()
  @IsNotEmpty()
  correlationId!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  settlementDate!: string;

  @IsString()
  @IsNotEmpty()
  debtorName!: string;

  @IsString()
  @IsNotEmpty()
  creditorName!: string;

  @IsString()
  @IsNotEmpty()
  debtorBic!: string;

  @IsString()
  @IsNotEmpty()
  creditorBic!: string;

  @IsOptional()
  @IsString()
  remittanceInfo?: string;
}