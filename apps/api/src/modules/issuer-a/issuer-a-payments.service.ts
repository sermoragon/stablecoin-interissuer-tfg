import { Injectable } from '@nestjs/common';
import { IsoDirection, Issuer, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashJson } from '../idempotency/request-hash.util';
import { Pacs009Builder } from '../iso20022/builders/pacs009.builder';
import { TechnicalAckParser } from '../iso20022/parsers/technical-ack.parser';
import { PrismaService } from '../persistence/prisma.service';
import {
  HMAC_PATHS,
  IDEMPOTENCY_SCOPES,
  ISSUER_IDS,
} from '../security/security.constants';
import { HmacService } from '../security/hmac.service';
import { CreateSimulatedPaymentDto } from './dto/create-simulated-payment.dto';

@Injectable()
export class IssuerAPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pacs009Builder: Pacs009Builder,
    private readonly technicalAckParser: TechnicalAckParser,
    private readonly idempotencyService: IdempotencyService,
    private readonly hmacService: HmacService,
  ) {}

  async simulatePayment(
    input: CreateSimulatedPaymentDto,
    idempotencyKey: string,
  ) {
    const requestHash = hashJson(input);

    const idempotency = await this.idempotencyService.begin(
      IDEMPOTENCY_SCOPES.ISSUER_A_SIMULATE_PAYMENT,
      idempotencyKey,
      requestHash,
    );

    if (idempotency.kind === 'replay_completed') {
      return JSON.parse(idempotency.record.responseBody ?? '{}');
    }

    try {
      const messageId = `MSG-${input.instructionId}`;

      const pacs009Xml = this.pacs009Builder.build({
        messageId,
        correlationId: input.correlationId,
        instructionId: input.instructionId,
        endToEndId: input.endToEndId,
        amount: input.amount,
        currency: input.currency,
        settlementDate: input.settlementDate,
        senderIssuer: 'ISSUER_A',
        receiverIssuer: 'ISSUER_B',
        debtorName: input.debtorName,
        creditorName: input.creditorName,
        debtorBic: input.debtorBic,
        creditorBic: input.creditorBic,
        remittanceInfo: input.remittanceInfo,
        createdAt: new Date().toISOString(),
      });

      const payment = await this.prisma.payment.create({
        data: {
          correlationId: input.correlationId,
          instructionId: input.instructionId,
          endToEndId: input.endToEndId,
          senderIssuer: Issuer.ISSUER_A,
          receiverIssuer: Issuer.ISSUER_B,
          amount: input.amount,
          currency: input.currency,
          debtorName: input.debtorName,
          creditorName: input.creditorName,
          debtorBic: input.debtorBic,
          creditorBic: input.creditorBic,
          remittanceInfo: input.remittanceInfo,
          status: PaymentStatus.ISO_OUTBOUND_BUILT,
        },
      });

      await this.prisma.isoMessage.create({
        data: {
          paymentId: payment.id,
          direction: IsoDirection.OUTBOUND,
          messageType: 'pacs.009',
          messageId,
          relatedMessageId: null,
          correlationId: input.correlationId,
          sender: 'ISSUER_A',
          receiver: 'ISSUER_B',
          rawXml: pacs009Xml,
          parsedJson: {
            instructionId: input.instructionId,
            endToEndId: input.endToEndId,
            correlationId: input.correlationId,
            amount: input.amount,
            currency: input.currency,
          },
        },
      });

      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'ISO_PACS009_BUILT',
          payload: {
            messageId,
            correlationId: input.correlationId,
          },
        },
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.ISO_SENT },
      });

      const issuerBIdempotencyKey = `PACS009:${messageId}`;
      const timestamp = Date.now().toString();
      const nonce = randomUUID();
      const path = HMAC_PATHS.ISSUER_B_PACS009;

      const signature = this.hmacService.signRequest({
        issuerId: ISSUER_IDS.ISSUER_A,
        idempotencyKey: issuerBIdempotencyKey,
        timestamp,
        nonce,
        method: 'POST',
        path,
        body: pacs009Xml,
      });

      const response = await fetch(`${this.getIssuerBBaseUrl()}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Idempotency-Key': issuerBIdempotencyKey,
          'X-Issuer-Id': ISSUER_IDS.ISSUER_A,
          'X-Timestamp': timestamp,
          'X-Nonce': nonce,
          'X-Signature': signature,
        },
        body: pacs009Xml,
      });

      const ackXml = await response.text();
      const parsedAck = this.technicalAckParser.parse(ackXml);

      await this.prisma.isoMessage.create({
        data: {
          paymentId: payment.id,
          direction: IsoDirection.INBOUND,
          messageType: 'tech_ack',
          messageId: parsedAck.messageId,
          relatedMessageId: parsedAck.originalMessageId,
          correlationId: parsedAck.originalCorrelationId,
          sender: 'ISSUER_B',
          receiver: 'ISSUER_A',
          rawXml: ackXml,
          parsedJson: parsedAck,
        },
      });

      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: 'ISO_TECH_ACK_RECEIVED',
          payload: parsedAck,
        },
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:
            parsedAck.status === 'ACCEPTED'
              ? PaymentStatus.ISO_ACK_ACCEPTED
              : PaymentStatus.ISO_ACK_REJECTED,
        },
      });

      const result = {
        paymentId: payment.id,
        messageId,
        correlationId: input.correlationId,
        ackStatus: parsedAck.status,
      };

      await this.idempotencyService.complete({
        recordId: idempotency.record.id,
        responseStatusCode: 201,
        responseContentType: 'application/json',
        responseBody: JSON.stringify(result),
        resourceType: 'payment',
        resourceId: payment.id,
      });

      return result;
    } catch (error) {
      await this.idempotencyService.fail(idempotency.record.id);
      throw error;
    }
  }

  private getIssuerBBaseUrl(): string {
    return process.env.ISSUER_B_BASE_URL ?? 'http://localhost:3000';
  }
}