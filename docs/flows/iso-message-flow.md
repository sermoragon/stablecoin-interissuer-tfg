# Flujo actual de mensajería ISO

## Objetivo

Describir el recorrido actual del mensaje desde `Issuer A` hasta `Issuer B` y el ACK técnico de vuelta dentro del MVP.

---

## Resumen rápido

1. El cliente llama a `Issuer A`
2. `Issuer A` construye un `pacs.009`
3. `Issuer A` persiste el pago y el mensaje saliente
4. `Issuer A` envía el XML a `Issuer B`
5. `Issuer B` parsea y mapea el mensaje
6. `Issuer B` persiste el mensaje entrante
7. `Issuer B` genera y devuelve un ACK técnico
8. `Issuer A` parsea el ACK recibido y actualiza el estado final

---

## Paso a paso

### 1. Entrada del flujo

El cliente llama a:

```text
POST /issuer-a/payments/simulate
```

`Issuer A` recibe un JSON con los datos mínimos del pago.

---

### 2. Construcción del mensaje `pacs.009`

`Issuer A` genera un `messageId` y construye el XML `pacs.009` a partir de los datos del pago.

En esta fase todavía no se realiza validación XSD.

---

### 3. Persistencia inicial en `Issuer A`

Antes del envío, el sistema persiste:

- el `Payment`
- el `IsoMessage` saliente de tipo `pacs.009`
- un `PaymentEvent` indicando que el mensaje fue construido

Después actualiza el estado del pago a `ISO_SENT`.

---

### 4. Envío a `Issuer B`

`Issuer A` envía el XML por HTTP local a:

```text
POST /issuer-b/iso/pacs009
```

Esta llamada representa la simulación del envío entre emisores dentro del mismo backend.

---

### 5. Recepción y parsing en `Issuer B`

`Issuer B` recibe el XML como texto y lo parsea para extraer los campos relevantes:

- identificadores
- importes
- partes del pago
- BICs
- concepto

---

### 6. Mapeo a modelo interno

El contenido parseado del `pacs.009` se transforma a una estructura interna compatible con el modelo de `Payment`.

---

### 7. Persistencia en `Issuer B`

Dentro de una transacción, `Issuer B`:

- crea o actualiza el `Payment`
- persiste el `IsoMessage` entrante de tipo `pacs.009`
- registra un `PaymentEvent` de recepción

---

### 8. Generación del ACK técnico

`Issuer B` construye un XML de respuesta simplificado (`TechAck`) con:

- `OriginalMessageId`
- `OriginalCorrelationId`
- `Status`
- `Timestamp`

En el estado actual del MVP, el ACK generado es `ACCEPTED`.

---

### 9. Persistencia del ACK en `Issuer B`

También dentro de la transacción, `Issuer B`:

- persiste un `IsoMessage` saliente de tipo `tech_ack`
- registra un `PaymentEvent` asociado al envío del ACK
- actualiza el estado del pago a `ISO_ACK_ACCEPTED`

---

### 10. Procesamiento del ACK en `Issuer A`

`Issuer A` recibe el XML del ACK, lo parsea y persiste:

- el `IsoMessage` entrante de tipo `tech_ack`
- un `PaymentEvent` de ACK recibido

Finalmente actualiza el estado del pago según el valor del ACK.

---

## Resultado final del flujo

Al finalizar el proceso:

- existe un `Payment` persistido
- existe trazabilidad del mensaje saliente y entrante
- existe trazabilidad de eventos
- el estado del pago refleja el resultado del intercambio técnico

---

## Observaciones sobre el MVP

- `Issuer A` y `Issuer B` están simulados dentro de la misma aplicación
- el transporte real entre instituciones no está implementado
- el ACK no es un `pacs.002` completo
- no hay validación XSD
- no hay controles de idempotencia todavía