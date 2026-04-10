# Explicación de campos del XML `pacs.009`

## Objetivo

Explicar con palabras simples los principales campos XML utilizados en el mensaje `pacs.009` del prototipo y cómo se relacionan con el modelo interno del sistema.

---

## Idea general

El XML usa nomenclatura abreviada típica de ISO 20022.  
Muchos nombres parecen poco intuitivos porque están compactados.

Ejemplos:

- `GrpHdr` = Group Header
- `MsgId` = Message ID
- `CreDtTm` = Creation Date Time
- `DbtrAgt` = Debtor Agent
- `CdtrAgt` = Creditor Agent

---

## Estructura principal

### `Document`

Elemento raíz del XML.

### `FICdtTrf`

Bloque principal del mensaje de transferencia de crédito entre instituciones financieras.

---

## Cabecera del mensaje

### `GrpHdr`

Cabecera general del mensaje.

### `MsgId`

Identificador del mensaje completo.

En este proyecto se construye como:

```text
MSG-{instructionId}
```

### `CreDtTm`

Fecha y hora de creación del mensaje.

### `NbOfTxs`

Número de transacciones incluidas en el mensaje.

En el MVP actual siempre se trabaja con una sola transacción.

### `SttlmInf`

Bloque de información de liquidación.

### `SttlmMtd`

Método de liquidación.

En el prototipo actual se utiliza como parte de la estructura del mensaje, sin modelar todavía una liquidación real.

---

## Información de la transacción

### `CdtTrfTxInf`

Bloque principal de información de la transferencia.

---

## Identificadores del pago

### `PmtId`

Bloque que agrupa varios identificadores de la operación.

### `InstrId`

Identificador de la instrucción.

En el proyecto se corresponde con:

```text
instructionId
```

### `EndToEndId`

Identificador extremo a extremo.

En el proyecto se corresponde con:

```text
endToEndId
```

### `TxId`

Identificador de transacción.

En este MVP se utiliza como:

```text
correlationId
```

Esto es una decisión de diseño del prototipo.

---

## Importe y fecha

### `IntrBkSttlmAmt`

Importe de liquidación entre instituciones.

En el proyecto se corresponde con:

```text
amount
```

### `Ccy`

Divisa del importe.

En el proyecto se corresponde con:

```text
currency
```

### `IntrBkSttlmDt`

Fecha de liquidación prevista.

En el proyecto se corresponde con:

```text
settlementDate
```

---

## Partes y agentes

### `DbtrAgt`

Agente de la parte deudora.

En este MVP representa la institución del lado emisor.

### `CdtrAgt`

Agente de la parte acreedora.

En este MVP representa la institución del lado receptor.

### `FinInstnId`

Identificación de la institución financiera.

### `BICFI`

BIC de la institución financiera.

En el proyecto:

- `DbtrAgt/FinInstnId/BICFI` se mapea a `debtorBic`
- `CdtrAgt/FinInstnId/BICFI` se mapea a `creditorBic`

### `Dbtr`

Parte deudora.

### `Cdtr`

Parte acreedora.

### `Nm`

Nombre de la parte.

En el proyecto:

- `Dbtr/Nm` se mapea a `debtorName`
- `Cdtr/Nm` se mapea a `creditorName`

---

## Información de remesa

### `RmtInf`

Bloque de información de remesa o concepto.

### `Ustrd`

Texto libre no estructurado.

En el proyecto se corresponde con:

```text
remittanceInfo
```

---

## Tabla de equivalencias rápidas

| Campo XML | Significado | Campo interno en el proyecto |
|---|---|---|
| `MsgId` | ID del mensaje | `messageId` |
| `InstrId` | ID de instrucción | `instructionId` |
| `EndToEndId` | ID extremo a extremo | `endToEndId` |
| `TxId` | ID de transacción | `correlationId` |
| `IntrBkSttlmAmt` | Importe | `amount` |
| `Ccy` | Divisa | `currency` |
| `IntrBkSttlmDt` | Fecha de liquidación | `settlementDate` |
| `Dbtr/Nm` | Nombre del deudor | `debtorName` |
| `Cdtr/Nm` | Nombre del acreedor | `creditorName` |
| `DbtrAgt/FinInstnId/BICFI` | BIC emisor | `debtorBic` |
| `CdtrAgt/FinInstnId/BICFI` | BIC receptor | `creditorBic` |
| `RmtInf/Ustrd` | Concepto libre | `remittanceInfo` |

---

## Relación con el código

Los mensajes XML se construyen y parsean desde el módulo:

```text
apps/api/src/modules/iso20022/
```

Archivos principales:

- `builders/pacs009.builder.ts`
- `parsers/pacs009.parser.ts`
- `mappers/pacs009-to-payment.mapper.ts`

La muestra de XML de referencia está en:

```text
docs/iso-samples/pacs009.sample.xml
```