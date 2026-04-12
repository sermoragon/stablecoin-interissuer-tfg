import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { HMAC_PATHS } from '../security/security.constants';
import { IssuerBIsoService } from './issuer-b-iso.service';

@Controller('issuer-b/iso')
export class IssuerBIsoController {
  constructor(private readonly issuerBIsoService: IssuerBIsoService) {}

  @Post('pacs009')
  @HttpCode(200)
  async receivePacs009(
    @Body() body: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-issuer-id') issuerId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-nonce') nonce: string | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    if (typeof body !== 'string' || body.trim() === '') {
      throw new BadRequestException('XML body is required');
    }

    if (!idempotencyKey || !issuerId || !timestamp || !nonce || !signature) {
      throw new BadRequestException('Missing required security headers');
    }

    response.type('application/xml');

    return this.issuerBIsoService.receivePacs009(body, {
      idempotencyKey,
      issuerId,
      timestamp,
      nonce,
      signature,
      method: 'POST',
      path: HMAC_PATHS.ISSUER_B_PACS009,
    });
  }
}