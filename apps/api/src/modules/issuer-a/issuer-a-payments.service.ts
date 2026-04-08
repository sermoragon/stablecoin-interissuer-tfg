import { Injectable } from '@nestjs/common';
import { IsoDirection, Issuer, PaymentStatus } from '@prisma/client';
import { Pacs009Builder } from '../iso20022/builders/pacs009.builder';
import { TechnicalAckParser } from '../iso20022/parsers/technical-ack.parser';
import { PrismaService } from '../persistence/prisma.service';
import { CreateSimulatedPaymentDto } from './dto/create-simulated-payment.dto';

@Injectable()
export class IssuerAPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pacs009Builder: Pacs009Builder,
    private readonly technicalAckParser: TechnicalAckParser,
  ) {}

  async simulatePayment(input: CreateSimulatedPaymentDto) {
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

    const response = await fetch('http://localhost:3000/issuer-b/iso/pacs009', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
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
        messageId: parsedAck.originalMessageId,
        relatedMessageId: messageId,
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

    return {
      paymentId: payment.id,
      messageId,
      correlationId: input.correlationId,
      ackStatus: parsedAck.status,
    };
  }
}