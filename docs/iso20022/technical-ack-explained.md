# Explicación del ACK técnico

## Objetivo

Describir el XML de respuesta técnica actual utilizado por `Issuer B` para confirmar la recepción del mensaje `pacs.009`.

---

## Qué es en este proyecto

El ACK implementado en esta fase es un XML simplificado propio del MVP.

No representa todavía un mensaje ISO 20022 completo como `pacs.002`.

Su función actual es confirmar técnicamente que `Issuer B` ha recibido y procesado el mensaje base.

---

## Estructura del ACK

### `TechAck`

Elemento raíz del ACK.

### `MessageId`
Identificador propio del ACK.

### `OriginalMessageId`

Identificador del mensaje original al que responde el ACK.

### `OriginalCorrelationId`

Identificador de correlación asociado al flujo original.

### `Status`

Estado técnico de la respuesta.

Valores previstos en el prototipo:

- `ACCEPTED`
- `REJECTED`

En el estado actual del código, el ACK se genera como `ACCEPTED`.

### `Timestamp`

Marca temporal de creación del ACK.

---

## Uso en el flujo actual

1. `Issuer B` recibe un `pacs.009`
2. parsea y persiste el mensaje
3. genera un `TechAck`
4. devuelve el ACK en XML
5. `Issuer A` parsea ese ACK
6. actualiza el estado del `Payment` según el `Status`

---

## Relación con el código

Archivos principales:

- `apps/api/src/modules/iso20022/builders/technical-ack.builder.ts`
- `apps/api/src/modules/iso20022/parsers/technical-ack.parser.ts`

Ejemplo documental:

- `docs/iso-samples/technical-ack.sample.xml`

---

## Limitación actual

El ACK no modela todavía semántica completa de negocio ni validación avanzada.  
En esta fase se utiliza como confirmación técnica simplificada del intercambio.