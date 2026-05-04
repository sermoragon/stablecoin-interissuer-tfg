import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SettleXrpPaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsOptional()
  @IsString()
  amountXrp?: string;
}