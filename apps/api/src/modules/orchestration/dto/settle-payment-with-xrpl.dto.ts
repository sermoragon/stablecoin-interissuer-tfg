import { IsOptional, IsString } from 'class-validator';

export class SettlePaymentWithXrplDto {
  @IsOptional()
  @IsString()
  destinationAmount?: string;

  @IsOptional()
  @IsString()
  sendMax?: string;
}