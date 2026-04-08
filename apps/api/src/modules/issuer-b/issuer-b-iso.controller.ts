import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IssuerBIsoService } from './issuer-b-iso.service';

@Controller('issuer-b/iso')
export class IssuerBIsoController {
  constructor(private readonly issuerBIsoService: IssuerBIsoService) {}

  @Post('pacs009')
  async receivePacs009(
    @Body() body: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    if (typeof body !== 'string' || body.trim() === '') {
      throw new BadRequestException('XML body is required');
    }

    response.type('application/xml');

    return this.issuerBIsoService.receivePacs009(body);
  }
}