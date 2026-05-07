import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SettleCrossCurrencyPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsOptional()
  @IsString()
  destinationAmount?: string;

  @IsOptional()
  @IsString()
  sendMax?: string;
}