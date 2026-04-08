import { Injectable } from '@nestjs/common';
import { IsoDirection, Issuer, PaymentStatus } from '@prisma/client';
import { TechnicalAckBuilder } from '../iso20022/builders/technical-ack.builder';
import { Pacs009ToPaymentMapper } from '../iso20022/mappers/pacs009-to-payment.mapper';
import { Pacs009Parser } from '../iso20022/parsers/pacs009.parser';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class IssuerBIsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pacs009Parser: Pacs009Parser,
    private readonly pacs009ToPaymentMapper: Pacs009ToPaymentMapper,
    private readonly technicalAckBuilder: TechnicalAckBuilder,
  ) {}

  async receivePacs009(xml: string): Promise<string> {
    const parsed = this.pacs009Parser.parse(xml);
    const mappedPayment = this.pacs009ToPaymentMapper.map(parsed);

    const ack = {
      originalMessageId: parsed.messageId,
      originalCorrelationId: parsed.correlationId,
      status: 'ACCEPTED' as const,
      timestamp: new Date().toISOString(),
    };

    const ackXml = this.technicalAckBuilder.build(ack);

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          ...mappedPayment,
          senderIssuer: Issuer.ISSUER_A,
          receiverIssuer: Issuer.ISSUER_B,
          status: PaymentStatus.ISO_INBOUND_RECEIVED,
        },
      });

      await tx.isoMessage.create({
        data: {
          paymentId: payment.id,
          direction: IsoDirection.INBOUND,
          messageType: 'pacs.009',
          messageId: parsed.messageId,
          relatedMessageId: null,
          correlationId: parsed.correlationId,
          sender: 'ISSUER_A',
          receiver: 'ISSUER_B',
          rawXml: xml,
          parsedJson: parsed,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'ISO_PACS009_RECEIVED',
          payload: parsed,
        },
      });

      await tx.isoMessage.create({
        data: {
          paymentId: payment.id,
          direction: IsoDirection.OUTBOUND,
          messageType: 'tech_ack',
          messageId: `ACK-${parsed.messageId}`,
          relatedMessageId: parsed.messageId,
          correlationId: parsed.correlationId,
          sender: 'ISSUER_B',
          receiver: 'ISSUER_A',
          rawXml: ackXml,
          parsedJson: ack,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'ISO_TECH_ACK_SENT',
          payload: ack,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.ISO_ACK_ACCEPTED,
        },
      });
    });

    return ackXml;
  }
}