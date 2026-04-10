# Endpoints actuales del prototipo

## `GET /health`

### Propósito

Comprobar que la API está levantada.

### Respuesta esperada

```json
{
  "status": "ok",
  "service": "stablecoin-interissuer-api",
  "timestamp": "2026-04-10T10:00:00.000Z"
}
```

---

## `POST /issuer-a/payments/simulate`

### Propósito

Iniciar un pago simulado desde `Issuer A`.

### Tipo de body

JSON

### Campos esperados

- `instructionId`
- `endToEndId`
- `correlationId`
- `amount`
- `currency`
- `settlementDate`
- `debtorName`
- `creditorName`
- `debtorBic`
- `creditorBic`
- `remittanceInfo` opcional

### Ejemplo de petición

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

### Qué hace

- valida el body recibido
- construye un XML `pacs.009`
- persiste el pago y el mensaje saliente
- envía el XML a `Issuer B`
- recibe el ACK
- persiste el ACK y actualiza el estado final

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

## `POST /issuer-b/iso/pacs009`

### Propósito

Recibir un mensaje `pacs.009` en XML y responder con un ACK técnico.

### Tipo de body

XML (`application/xml`)

### Qué hace

- recibe el XML como texto
- parsea su contenido
- mapea los datos a modelo interno
- persiste mensaje y eventos
- genera un ACK técnico
- devuelve ese ACK en XML

### Tipo de respuesta

XML (`application/xml`)

### Observación

Este endpoint forma parte de la simulación interna del receptor (`Issuer B`) dentro del MVP actual.