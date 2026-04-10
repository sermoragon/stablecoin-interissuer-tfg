# MVP - Alcance funcional y supuestos actuales

## Objetivo

Construir un prototipo mínimo que simule un pago FI-to-FI entre `Issuer A` y `Issuer B` mediante mensajería ISO 20022, persistiendo mensajes y eventos del flujo y devolviendo un ACK técnico básico.

---

## Alcance funcional actual

El MVP actual cubre:

- inicio de un pago simulado desde `Issuer A`
- construcción de un mensaje `pacs.009`
- envío del XML a `Issuer B`
- parsing del XML recibido
- mapeo del mensaje a un modelo interno
- persistencia del pago y de los mensajes ISO
- persistencia de eventos de trazabilidad
- generación y devolución de un ACK técnico
- actualización del estado final del pago

---

## Actores del sistema

- `Issuer A`
- `Issuer B`
- API NestJS que simula ambos actores
- PostgreSQL como base de datos de persistencia

---

## Caso de uso principal

1. `Issuer A` recibe una solicitud de pago simulada
2. el sistema construye un XML `pacs.009`
3. se persiste el pago inicial
4. se persiste el mensaje saliente
5. `Issuer A` envía el XML a `Issuer B`
6. `Issuer B` parsea el XML
7. `Issuer B` mapea el contenido a un modelo interno
8. `Issuer B` persiste el mensaje entrante
9. `Issuer B` genera un ACK técnico en XML
10. `Issuer B` devuelve el ACK
11. `Issuer A` parsea el ACK recibido
12. se persiste el ACK y se actualiza el estado final del pago

---

## Datos mínimos del pago

- `correlationId`
- `instructionId`
- `endToEndId`
- `amount`
- `currency`
- `senderIssuer`
- `receiverIssuer`
- `debtorName`
- `creditorName`
- `debtorBic`
- `creditorBic`
- `remittanceInfo`

---

## Estados actuales del flujo

- `CREATED`
- `ISO_OUTBOUND_BUILT`
- `ISO_SENT`
- `ISO_INBOUND_RECEIVED`
- `ISO_ACK_ACCEPTED`
- `ISO_ACK_REJECTED`
- `FAILED`

---

## Errores previstos a nivel de MVP

- XML inválido
- fallo de parsing
- fallo de mapeo
- indisponibilidad del receptor
- error de persistencia
- rechazo técnico del ACK

---

## Supuestos actuales del prototipo

- `Issuer A` y `Issuer B` se simulan dentro del mismo backend NestJS
- el transporte entre ambos se realiza mediante HTTP local
- el ACK implementado es técnico y simplificado
- la validación XSD no forma parte de esta fase
- la seguridad y la idempotencia quedan para fases posteriores
- la liquidación XRPL se integrará después del flujo base ISO

---

## Fuera de alcance en esta fase

- HMAC
- Idempotency-Key
- anti-replay
- outbox/retries
- ledger de doble entrada
- liquidación XRPL
- panel Next.js
- `pacs.002` completo
- validación XSD

---

## Resultado esperado de esta fase

Un intercambio simulado y reproducible entre `Issuer A` e `Issuer B` con:

- XML `pacs.009` visible
- ACK técnico visible
- persistencia del pago
- persistencia de mensajes ISO
- persistencia de eventos
- trazabilidad por `correlationId`