# MVP - Requisitos y modelo del flujo

## Objetivo
Construir un prototipo mínimo que simule un pago FI-to-FI entre Emisor A y Emisor B mediante mensajería ISO 20022 (pacs.009 + ACK básico), persistiendo mensajes y eventos del flujo.

## Alcance del MVP del punto 2
- Emisor A inicia un pago.
- Se genera un mensaje pacs.009 saliente.
- Emisor B recibe el mensaje.
- Emisor B parsea y mapea el contenido a un modelo interno.
- Emisor B responde con un ACK técnico básico.
- Se persisten mensajes ISO y eventos del flujo.
- El estado del pago queda trazado internamente.

## Fuera de alcance para este martes
- HMAC
- Idempotency-Key
- Anti-replay
- Outbox/retries
- Ledger de doble entrada
- Liquidación XRPL
- Panel Next.js

## Actores
- Emisor A
- Emisor B
- Orchestrator interno
- Base de datos PostgreSQL

## Caso de uso principal
1. Emisor A inicia un pago.
2. El sistema crea el registro Payment.
3. Se construye el XML pacs.009.
4. Se persiste el mensaje saliente.
5. Emisor B recibe el XML.
6. Emisor B parsea y mapea el mensaje.
7. Se persiste el mensaje entrante.
8. Emisor B responde ACK.
9. Se actualiza el estado final del flujo ISO.

## Datos mínimos del pago
- correlationId
- instructionId
- endToEndId
- amount
- currency
- senderIssuer
- receiverIssuer
- debtorName
- creditorName
- debtorBic
- creditorBic
- remittanceInfo

## Estados MVP
- CREATED
- ISO_OUTBOUND_BUILT
- ISO_SENT
- ISO_INBOUND_RECEIVED
- ISO_ACK_ACCEPTED
- ISO_ACK_REJECTED
- FAILED

## Errores MVP
- INVALID_XML
- MAPPING_FAILED
- REMOTE_ISSUER_UNAVAILABLE
- ACK_REJECTED
- PERSISTENCE_ERROR

## Supuestos
- Emisor A y Emisor B se simulan dentro del mismo backend NestJS.
- El ACK es técnico y básico, no pacs.002 completo.
- La validación XSD no forma parte del MVP inicial.
- La seguridad y la idempotencia se abordan en la siguiente fase.
- La liquidación XRPL se integra después del bloque ISO básico.

## Resultado esperado del punto 2
Un intercambio A↔B simulado y reproducible con:
- XML pacs.009 visible
- ACK visible
- mapping a modelo interno
- persistencia de mensajes y eventos
- trazabilidad por correlationId