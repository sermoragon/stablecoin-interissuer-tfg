import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IsoDirection, Issuer, PaymentStatus } from '@prisma/client';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashText } from '../idempotency/request-hash.util';
import { TechnicalAckBuilder } from '../iso20022/builders/technical-ack.builder';
import { Pacs009ToPaymentMapper } from '../iso20022/mappers/pacs009-to-payment.mapper';
import { Pacs009Parser } from '../iso20022/parsers/pacs009.parser';
import { PrismaService } from '../persistence/prisma.service';
import { IDEMPOTENCY_SCOPES, ISSUER_IDS } from '../security/security.constants';
import { HmacService, SignedRequestInput } from '../security/hmac.service';
import { ReplayProtectionService } from '../security/replay-protection.service';

type ReceivePacs009SecurityInput = Omit<SignedRequestInput, 'body'> & {
  signature: string;
};

@Injectable()
export class IssuerBIsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pacs009Parser: Pacs009Parser,
    private readonly pacs009ToPaymentMapper: Pacs009ToPaymentMapper,
    private readonly technicalAckBuilder: TechnicalAckBuilder,
    private readonly idempotencyService: IdempotencyService,
    private readonly hmacService: HmacService,
    private readonly replayProtectionService: ReplayProtectionService,
  ) {}

  async receivePacs009(
    xml: string,
    security: ReceivePacs009SecurityInput,
  ): Promise<string> {
    if (security.issuerId !== ISSUER_IDS.ISSUER_A) {
      throw new UnauthorizedException('Unknown issuer');
    }

    this.hmacService.verifyRequest({
      ...security,
      body: xml,
    });

    const requestHash = hashText(xml);

    const idempotency = await this.idempotencyService.begin(
      IDEMPOTENCY_SCOPES.ISSUER_B_INBOUND_PACS009,
      security.idempotencyKey,
      requestHash,
    );

    if (idempotency.kind === 'replay_completed') {
      return idempotency.record.responseBody ?? '';
    }

    await this.replayProtectionService.registerNonceOrThrow({
      issuer: Issuer.ISSUER_A,
      nonce: security.nonce,
      idempotencyKey: security.idempotencyKey,
      requestHash,
      signatureTimestamp: security.timestamp,
    });

    try {
      const parsed = this.pacs009Parser.parse(xml);
      const mappedPayment = this.pacs009ToPaymentMapper.map(parsed);

      const ackMessageId = `ACK-${parsed.messageId}`;
      const ack = {
        messageId: ackMessageId,
        originalMessageId: parsed.messageId,
        originalCorrelationId: parsed.correlationId,
        status: 'ACCEPTED' as const,
        timestamp: new Date().toISOString(),
      };

      const ackXml = this.technicalAckBuilder.build(ack);
      let paymentId = '';

      await this.prisma.$transaction(async (tx) => {
        const existingPayment = await tx.payment.findUnique({
          where: { correlationId: parsed.correlationId },
        });

        const payment = existingPayment
          ? await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                debtorName: parsed.debtorName,
                creditorName: parsed.creditorName,
                debtorBic: parsed.debtorBic,
                creditorBic: parsed.creditorBic,
                remittanceInfo: parsed.remittanceInfo,
                status: PaymentStatus.ISO_INBOUND_RECEIVED,
              },
            })
          : await tx.payment.create({
              data: {
                ...mappedPayment,
                senderIssuer: Issuer.ISSUER_A,
                receiverIssuer: Issuer.ISSUER_B,
                status: PaymentStatus.ISO_INBOUND_RECEIVED,
              },
            });

        paymentId = payment.id;

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
            messageId: ack.messageId,
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

      await this.idempotencyService.complete({
        recordId: idempotency.record.id,
        responseStatusCode: 200,
        responseContentType: 'application/xml',
        responseBody: ackXml,
        resourceType: 'payment',
        resourceId: paymentId,
      });

      return ackXml;
    } catch (error) {
      await this.idempotencyService.fail(idempotency.record.id);
      throw error;
    }
  }
}