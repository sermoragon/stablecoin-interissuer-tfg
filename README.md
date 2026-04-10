# TFG - Sistema de pagos inter-emisor para stablecoins con mensajería ISO 20022

## Descripción

Este proyecto implementa un prototipo backend orientado al TFG del Grado en Ingeniería Informática. El objetivo del sistema es simular un flujo de pago inter-emisor entre dos entidades (`Issuer A` e `Issuer B`) utilizando mensajería ISO 20022, con persistencia de pagos, mensajes y eventos del proceso.

En el estado actual del MVP, el sistema:

- recibe una solicitud de pago desde `Issuer A`
- construye un mensaje XML `pacs.009`
- envía ese mensaje a `Issuer B`
- parsea y mapea el contenido a un modelo interno
- persiste el flujo en PostgreSQL
- genera y devuelve un ACK técnico simplificado

La integración con XRPL no forma parte de esta fase actual del prototipo. Primero se valida el flujo base de mensajería y persistencia.

---

## Estado actual del MVP

Actualmente el proyecto permite:

- iniciar un pago simulado desde `Issuer A`
- construir un mensaje ISO 20022 `pacs.009`
- enviar ese mensaje a `Issuer B` mediante HTTP local
- parsear el XML en el receptor
- mapear el mensaje a una estructura interna de pago
- persistir pagos, mensajes ISO y eventos de trazabilidad
- responder con un ACK técnico básico
- actualizar el estado final del pago según el ACK recibido

---

## Arquitectura actual

El prototipo se ejecuta actualmente como una única API NestJS.

Dentro de esa misma API se simulan dos actores:

- `Issuer A`: inicia el pago y envía el mensaje ISO
- `Issuer B`: recibe el mensaje, lo procesa y devuelve un ACK técnico

La persistencia se realiza en PostgreSQL mediante Prisma ORM.  
La base de datos se levanta con Docker Compose.

### Importante

En esta fase del proyecto:

- `Issuer A` y `Issuer B` no son servicios desplegados por separado
- el intercambio entre ambos se simula dentro del mismo backend
- el ACK devuelto no es un `pacs.002` completo, sino un XML técnico simplificado definido para el MVP
- no se está realizando todavía validación XSD de los mensajes ISO

---

## Stack principal

- TypeScript
- Node.js
- NestJS
- PostgreSQL
- Prisma ORM
- Docker Compose
- Jest

---

## Estructura principal del proyecto

```text
apps/api/                 Backend principal en NestJS
prisma/schema.prisma      Modelo actual de datos con Prisma
docs/                     Documentación técnica y diagramas
docker-compose.yml        PostgreSQL local para desarrollo
README.md                 Visión general y guía de arranque
```

---

## Puesta en marcha

### Requisitos previos

- Docker Desktop instalado y arrancado
- Node.js y npm instalados
- PowerShell en Windows 10

### 1. Levantar PostgreSQL

```powershell
docker compose up -d
```

Esto arranca el contenedor de PostgreSQL definido en `docker-compose.yml`.

### 2. Aplicar la estructura actual de base de datos

```powershell
npx prisma migrate dev
```

Este comando aplica las migraciones pendientes sobre PostgreSQL y genera/actualiza Prisma Client.

### 3. Arrancar la API

```powershell
npm run dev
```

### 4. Comprobar el healthcheck

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Respuesta esperada aproximada:

```json
{
  "status": "ok",
  "service": "stablecoin-interissuer-api",
  "timestamp": "2026-04-08T18:00:00.000Z"
}
```

---

## Flujo funcional actual

El flujo actual del MVP es el siguiente:

1. El cliente llama a `POST /issuer-a/payments/simulate`
2. `Issuer A` construye un XML `pacs.009`
3. Se persiste el pago y el mensaje saliente
4. `Issuer A` envía el XML a `Issuer B`
5. `Issuer B` parsea el mensaje y lo mapea a un modelo interno
6. `Issuer B` persiste el mensaje entrante y genera un ACK técnico
7. `Issuer B` devuelve el ACK en XML
8. `Issuer A` parsea el ACK y actualiza el estado final del pago

---

## Persistencia actual

El sistema persiste tres entidades principales:

- `Payment`: representa la operación de pago
- `IsoMessage`: almacena mensajes XML de entrada y salida
- `PaymentEvent`: registra hitos del flujo para trazabilidad

---

## Endpoints principales

### `GET /health`

Healthcheck básico del servicio.

### `POST /issuer-a/payments/simulate`

Inicia un pago simulado desde `Issuer A`.

### `POST /issuer-b/iso/pacs009`

Endpoint interno que recibe un `pacs.009` en XML y responde con un ACK técnico.

---

## Ejemplo de petición al flujo actual

### Endpoint

`POST /issuer-a/payments/simulate`

### Body de ejemplo

```json
{
  "instructionId": "INST-001",
  "endToEndId": "E2E-001",
  "correlationId": "CORR-001",
  "amount": "125.50",
  "currency": "EUR",
  "settlementDate": "2026-04-10",
  "debtorName": "Issuer A Treasury",
  "creditorName": "Issuer B Treasury",
  "debtorBic": "AAAABBCCDDD",
  "creditorBic": "EEEFFFGGHHH",
  "remittanceInfo": "TFG prototype payment"
}
```

### Respuesta esperada aproximada

```json
{
  "paymentId": "cm...",
  "messageId": "MSG-INST-001",
  "correlationId": "CORR-001",
  "ackStatus": "ACCEPTED"
}
```

---

## Testing

Tests principales disponibles:

```powershell
npm run test
```

```powershell
npm run test -w apps/api -- --runTestsByPath test/iso-flow.e2e-spec.ts
```

También puede ejecutarse:

```powershell
npm run test:e2e -w apps/api
```

---

## Limitaciones actuales del MVP

Este estado del proyecto es un prototipo funcional orientado a validar el flujo básico ISO 20022. Todavía no incluye:

- validación XSD
- `pacs.002` real
- seguridad HMAC
- idempotencia
- anti-replay
- outbox/retries
- ledger de doble entrada
- integración XRPL
- panel de visualización

---

## Documentación adicional

- `docs/architecture/mvp-assumptions.md`
- `docs/database/current-schema.md`
- `docs/flows/iso-message-flow.md`
- `docs/api/current-endpoints.md`
- `docs/iso20022/pacs009-fields-explained.md`
- `docs/iso20022/technical-ack-explained.md`
- `docs/diagrams/flow-mvp-mermaid.md`

---

## Muestras XML

Los ejemplos de XML se encuentran en:

- `docs/iso-samples/pacs009.sample.xml`
- `docs/iso-samples/technical-ack.sample.xml`

Estos archivos son referencias visuales/documentales.  
Los mensajes reales del sistema se construyen y parsean desde código dentro del módulo `iso20022`.