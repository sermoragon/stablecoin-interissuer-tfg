import { Injectable } from '@nestjs/common';
import { IsoDirection, Issuer, PaymentStatus } from '@prisma/client';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashJson } from '../idempotency/request-hash.util';
import { Pacs009Builder } from '../iso20022/builders/pacs009.builder';
import { OutboxDispatcherService } from '../outbox/outbox-dispatcher.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../persistence/prisma.service';
import { IDEMPOTENCY_SCOPES } from '../security/security.constants';
import { CreateSimulatedPaymentDto } from './dto/create-simulated-payment.dto';

@Injectable()
export class IssuerAPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pacs009Builder: Pacs009Builder,
    private readonly idempotencyService: IdempotencyService,
    private readonly outboxService: OutboxService,
    private readonly outboxDispatcherService: OutboxDispatcherService,
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

      const outboxMessage = await this.outboxService.enqueuePacs009({
        paymentId: payment.id,
        messageId,
        correlationId: input.correlationId,
        payload: pacs009Xml,
      });

      const dispatchResult = await this.outboxDispatcherService.dispatchById(
        outboxMessage.id,
      );

      const result =
        dispatchResult.kind === 'delivered'
          ? {
              paymentId: payment.id,
              messageId,
              correlationId: input.correlationId,
              ackStatus: dispatchResult.ackStatus,
            }
          : {
              paymentId: payment.id,
              messageId,
              correlationId: input.correlationId,
              deliveryStatus: 'QUEUED' as const,
              outboxMessageId: outboxMessage.id,
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
}