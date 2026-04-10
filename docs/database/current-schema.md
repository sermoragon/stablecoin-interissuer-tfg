# Base de datos actual - esquema funcional

## Visión general

La persistencia actual del prototipo se apoya en PostgreSQL y Prisma ORM.

El sistema utiliza tres entidades principales:

- `Payment`
- `IsoMessage`
- `PaymentEvent`

Estas tres tablas permiten separar:

- la operación de pago (`Payment`)
- los mensajes intercambiados (`IsoMessage`)
- la trazabilidad del flujo (`PaymentEvent`)

---

## Relación entre entidades

- Un `Payment` puede tener muchos `IsoMessage`
- Un `Payment` puede tener muchos `PaymentEvent`

### Esquema lógico simple

```text
Payment
 ├── IsoMessage (0..n)
 └── PaymentEvent (0..n)
```

---

## Tabla `Payment`

### Propósito

Representa la operación de pago a nivel de negocio dentro del sistema.

### Campos

- `id`: clave primaria generada con `cuid()`
- `correlationId`: identificador único para trazabilidad del flujo
- `instructionId`: identificador único de la instrucción
- `endToEndId`: identificador extremo a extremo
- `senderIssuer`: emisor de origen
- `receiverIssuer`: emisor de destino
- `amount`: importe del pago
- `currency`: divisa
- `debtorName`: nombre del deudor
- `creditorName`: nombre del acreedor
- `debtorBic`: BIC de la parte deudora
- `creditorBic`: BIC de la parte acreedora
- `remittanceInfo`: concepto o texto libre opcional
- `status`: estado actual del flujo
- `createdAt`: fecha de creación
- `updatedAt`: fecha de última actualización

### Uso dentro del flujo

`Payment` representa la operación principal que se va actualizando a medida que avanza el intercambio ISO.

---

## Tabla `IsoMessage`

### Propósito

Almacena cada mensaje XML enviado o recibido dentro del flujo.

### Campos

- `id`: clave primaria
- `paymentId`: referencia opcional al `Payment`
- `direction`: dirección del mensaje (`OUTBOUND` o `INBOUND`)
- `messageType`: tipo de mensaje (`pacs.009`, `tech_ack`, etc.)
- `messageId`: identificador del mensaje
- `relatedMessageId`: identificador del mensaje relacionado
- `correlationId`: identificador de correlación asociado
- `sender`: actor emisor del mensaje
- `receiver`: actor receptor del mensaje
- `rawXml`: XML original completo
- `parsedJson`: versión parseada o resumida del mensaje
- `createdAt`: fecha de persistencia

### Uso dentro del flujo

Esta tabla permite conservar tanto el XML saliente como el entrante, lo que facilita trazabilidad, depuración y demostración del funcionamiento del sistema.

---

## Tabla `PaymentEvent`

### Propósito

Registrar hitos o eventos relevantes ocurridos durante el flujo.

### Campos

- `id`: clave primaria
- `paymentId`: referencia al pago
- `type`: tipo de evento
- `payload`: información adicional asociada al evento
- `createdAt`: fecha del evento

### Ejemplos de eventos actuales

- `ISO_PACS009_BUILT`
- `ISO_PACS009_RECEIVED`
- `ISO_TECH_ACK_SENT`
- `ISO_TECH_ACK_RECEIVED`

### Uso dentro del flujo

Permite reconstruir la secuencia de acciones sobre un pago sin depender únicamente del estado final.

---

## Enums actuales

### `Issuer`

- `ISSUER_A`
- `ISSUER_B`

### `PaymentStatus`

- `CREATED`
- `ISO_OUTBOUND_BUILT`
- `ISO_SENT`
- `ISO_INBOUND_RECEIVED`
- `ISO_ACK_ACCEPTED`
- `ISO_ACK_REJECTED`
- `FAILED`

### `IsoDirection`

- `OUTBOUND`
- `INBOUND`

---

## Observaciones sobre el diseño actual

- La separación entre `Payment`, `IsoMessage` y `PaymentEvent` está bien planteada para un MVP
- `IsoMessage` permite conservar el XML original y además una versión parseada simplificada
- `PaymentEvent` da trazabilidad sin sobrecargar la tabla principal de pagos
- El esquema actual todavía no modela ledger, balances, idempotencia ni liquidación

---

## Archivo fuente del modelo

La definición actual del esquema se encuentra en:

```text
prisma/schema.prisma
```