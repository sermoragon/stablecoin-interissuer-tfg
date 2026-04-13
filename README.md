# TFG - Sistema de pagos inter-emisor para stablecoins con mensajería ISO 20022

## Descripción

Este proyecto implementa un prototipo backend orientado al TFG del Grado en Ingeniería Informática. El objetivo del sistema es simular un flujo de pago inter-emisor entre dos entidades (`Issuer A` e `Issuer B`) utilizando mensajería ISO 20022, con persistencia de pagos, mensajes y eventos del proceso, y con una capa técnica de seguridad, idempotencia y reintentos seguros.

En el estado actual del prototipo, el sistema:

- recibe una solicitud de pago desde `Issuer A`
- construye un mensaje XML `pacs.009`
- persiste el pago, los mensajes ISO y los eventos del flujo
- envía ese mensaje a `Issuer B`
- protege la llamada con firma HMAC, timestamp y nonce
- valida duplicados mediante `Idempotency-Key`
- evita replay de mensajes
- persiste el envío en un outbox antes de entregarlo
- permite reintentos seguros ante fallos temporales
- genera y devuelve un ACK técnico simplificado
- actualiza el estado final del pago según el ACK recibido

La integración con XRPL no forma parte todavía de esta fase del prototipo. Primero se valida el flujo base de mensajería, seguridad técnica, idempotencia y persistencia.

* * *

## Estado actual del MVP

Actualmente el proyecto permite:

- iniciar un pago simulado desde `Issuer A`
- construir un mensaje ISO 20022 `pacs.009`
- enviar ese mensaje a `Issuer B` mediante HTTP local
- proteger el intercambio `A -> B` con HMAC-SHA256
- validar timestamp y nonce en el receptor
- deduplicar requests con `Idempotency-Key`
- evitar replay del mismo mensaje firmado
- persistir pagos, mensajes ISO y eventos de trazabilidad
- persistir mensajes salientes en una tabla de outbox
- reintentar entregas fallidas de forma segura
- responder con un ACK técnico básico
- actualizar el estado final del pago según el ACK recibido

* * *

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
- no se ha desplegado HTTPS real con certificados en local
- el “canal seguro” del prototipo se implementa con HMAC, timestamp y nonce sobre transporte HTTP local reproducible

* * *

## Stack principal

- TypeScript
- Node.js
- NestJS
- PostgreSQL
- Prisma ORM
- Docker Compose
- Jest

* * *

## Estructura principal del proyecto

    apps/api/                 Backend principal en NestJS
    prisma/schema.prisma      Modelo actual de datos con Prisma
    docs/                     Documentación técnica y diagramas
    docker-compose.yml        PostgreSQL local para desarrollo
    README.md                 Visión general y guía de arranque

* * *

## Puesta en marcha

### Requisitos previos

- Docker Desktop instalado y arrancado
- Node.js y npm instalados
- PowerShell en Windows 10

### 1. Levantar PostgreSQL

    docker compose up -d

Esto arranca el contenedor de PostgreSQL definido en `docker-compose.yml`.

### 2. Aplicar la estructura actual de base de datos

    npx prisma migrate dev
    npx prisma generate

Esto aplica las migraciones pendientes sobre PostgreSQL y genera/actualiza Prisma Client.

### 3. Configurar variables de entorno

El proyecto utiliza las siguientes variables:

    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tfg_db?schema=public
    ISSUER_B_BASE_URL=http://localhost:3000
    ISSUER_A_TO_ISSUER_B_HMAC_SECRET=dev-only-issuer-a-to-b-secret
    HMAC_MAX_CLOCK_SKEW_SECONDS=300
    OUTBOX_POLLING_ENABLED=true
    OUTBOX_POLL_INTERVAL_MS=2000
    OUTBOX_RETRY_BASE_DELAY_MS=2000
    OUTBOX_MAX_ATTEMPTS=5
    OUTBOX_PROCESSING_TIMEOUT_MS=15000

### 4. Arrancar la API

    npm run dev

### 5. Comprobar el healthcheck

    Invoke-RestMethod http://localhost:3000/health

Respuesta esperada aproximada:

    {
      "status": "ok",
      "service": "stablecoin-interissuer-api",
      "timestamp": "2026-04-08T18:00:00.000Z"
    }

* * *

## Flujo funcional actual

El flujo actual del MVP es el siguiente:

1. El cliente llama a `POST /issuer-a/payments/simulate`
2. La petición debe incluir `Idempotency-Key`
3. `Issuer A` valida la idempotencia del request
4. `Issuer A` construye un XML `pacs.009`
5. Se persiste el pago, el mensaje saliente y el evento de construcción
6. Se persiste un `OutboxMessage` con el envío saliente
7. El dispatcher intenta entregar el mensaje a `Issuer B`
8. La llamada `A -> B` se firma con HMAC, timestamp y nonce
9. `Issuer B` valida firma, ventana temporal, replay e idempotencia
10. `Issuer B` parsea el mensaje y lo mapea a un modelo interno
11. `Issuer B` persiste el mensaje entrante y genera un ACK técnico
12. `Issuer B` devuelve el ACK en XML
13. `Issuer A` registra el ACK recibido y actualiza el estado final del pago
14. El `OutboxMessage` se marca como `DELIVERED`
15. Si la entrega falla temporalmente, el mensaje queda pendiente para retry seguro sin duplicar efectos

* * *

## Canal seguro e idempotencia

### HMAC

La comunicación `Issuer A -> Issuer B` se protege con firma HMAC-SHA256.

Se firman:

- `issuerId`
- `idempotencyKey`
- `timestamp`
- `nonce`
- `method`
- `path`
- `sha256(body)`

Objetivo:

- autenticidad del emisor
- integridad del mensaje
- protección frente a manipulación del payload

### Timestamp

Se exige `X-Timestamp` y se valida frente a una ventana de tolerancia configurable.

Objetivo:

- impedir la aceptación de mensajes antiguos fuera de ventana

### Nonce y anti-replay

Se exige `X-Nonce` y se registra en la tabla `ReplayNonce`.

Objetivo:

- evitar replay del mismo mensaje firmado

### Idempotency-Key

Se usa en:

- `POST /issuer-a/payments/simulate`
- `POST /issuer-b/iso/pacs009`

Objetivo:

- evitar duplicados lógicos
- devolver la misma respuesta si el request ya fue procesado con el mismo contenido
- rechazar la misma key si llega con contenido distinto

* * *

## Outbox y reintentos

El envío saliente `A -> B` no depende únicamente de una llamada HTTP inline. Antes de entregarse, se persiste en `OutboxMessage`.

Ventajas:

- no se pierde el mensaje si falla la entrega
- se puede reintentar sin crear otro pago
- se desacopla el acto de construir el pago del acto de entregarlo

### Estados del outbox

- `PENDING`
- `PROCESSING`
- `DELIVERED`
- `FAILED`

### Política de reintentos

Se consideran reintentables:

- error de red
- HTTP `5xx`
- HTTP `408`
- HTTP `429`

Se consideran no reintentables:

- HTTP `4xx` permanentes como `400`, `401`, `403`, `404`

Además, al arrancar la aplicación se recuperan mensajes `OutboxMessage` atascados en estado `PROCESSING` cuyo `lastAttemptAt` excede el timeout configurado, devolviéndolos a `PENDING`.

* * *

## Persistencia actual

El sistema persiste actualmente las siguientes entidades principales:

- `Payment`: representa la operación de pago
- `IsoMessage`: almacena mensajes XML de entrada y salida
- `PaymentEvent`: registra hitos del flujo para trazabilidad
- `IdempotencyRecord`: controla peticiones idempotentes y cachea respuestas
- `ReplayNonce`: controla nonces ya utilizados para evitar replay
- `OutboxMessage`: persiste los mensajes salientes para su entrega y retry

### Resumen de responsabilidades

#### `Payment`

Representa la operación principal de pago simulado.

#### `IsoMessage`

Guarda cada mensaje ISO o ACK de entrada y salida.

#### `PaymentEvent`

Actúa como event log técnico del flujo.

Ejemplos actuales:

- `ISO_PACS009_BUILT`
- `ISO_PACS009_RECEIVED`
- `ISO_TECH_ACK_SENT`
- `ISO_TECH_ACK_RECEIVED`

#### `IdempotencyRecord`

Registra:

- ámbito del request
- `Idempotency-Key`
- hash del payload
- estado de procesamiento
- respuesta cacheada

#### `ReplayNonce`

Registra:

- emisor
- nonce
- `Idempotency-Key`
- hash del request
- timestamp de firma

#### `OutboxMessage`

Registra:

- el mensaje saliente
- sus intentos de entrega
- el estado actual de envío
- último error o respuesta recibida

* * *

## Endpoints principales

### `GET /health`

Healthcheck básico del servicio.

### `POST /issuer-a/payments/simulate`

Inicia un pago simulado desde `Issuer A`.

Requiere:

- header `Idempotency-Key`
- body JSON con los datos del pago

### `POST /issuer-b/iso/pacs009`

Endpoint interno que recibe un `pacs.009` en XML y responde con un ACK técnico.

Requiere, además del XML:

- `Idempotency-Key`
- `X-Issuer-Id`
- `X-Timestamp`
- `X-Nonce`
- `X-Signature`

* * *

## Ejemplo de petición al flujo actual

### Endpoint

`POST /issuer-a/payments/simulate`

### Headers de ejemplo

    Idempotency-Key: SIM-001

### Body de ejemplo

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
      "remittanceInfo": "TFG payment simulation"
    }

* * *

## Pruebas

### Unit tests

    npm run test -w apps/api

### E2E tests

    npx jest --config ./apps/api/test/jest-e2e.json

Los tests E2E se ejecutan en serie porque usan una base PostgreSQL compartida.

### Cobertura funcional actual de E2E

- `app.e2e-spec.ts`
- `iso-flow.e2e-spec.ts`
- `point-3-security-idempotency.e2e-spec.ts`
- `point-3-outbox-retries.e2e-spec.ts`

Estos tests validan, entre otras cosas:

- happy path completo del flujo ISO
- deduplicación por `Idempotency-Key`
- rechazo de firma inválida
- rechazo de timestamp vencido
- rechazo de replay
- retry seguro ante fallo temporal
- fallo final en errores HTTP no reintentables
- recuperación de mensajes atascados en `PROCESSING`

* * *

## Limitaciones conscientes del prototipo actual

En esta fase del proyecto:

- `Issuer A` y `Issuer B` siguen simulados dentro de una sola app
- no existe todavía despliegue HTTPS real con certificados
- no se usa todavía XRPL
- no existe aún una máquina de estados de negocio completa
- no existe todavía ledger de doble entrada
- no existe aún panel operativo
- la validación XSD de mensajes ISO no está incorporada en esta fase

Estas decisiones son deliberadas para mantener el prototipo reproducible y avanzar por bloques, validando primero la mensajería, la seguridad técnica, la idempotencia y la resiliencia básica del intercambio.

* * *

## Próximo bloque previsto

El siguiente bloque previsto del TFG es la integración con XRPL, incluyendo:

- cuentas en testnet
- trust lines
- IOUs de emisor A y emisor B
- pathfinding / DEX
- envío y confirmación de transacción
- hash confirmado dentro del flujo E2E