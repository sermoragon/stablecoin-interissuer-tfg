# Integración XRPL — MVP inicial

## 1. Resumen

Este documento describe el estado actual de la integración de XRPL en el backend del proyecto.

La implementación actual permite conectar la aplicación NestJS con XRPL Testnet, utilizar dos cuentas de prueba como tesorerías simuladas de los emisores, enviar una transacción real de XRP, esperar su validación en ledger y persistir la traza resultante en la base de datos mediante `PaymentEvent`.

El objetivo de este primer MVP no es implementar todavía el flujo completo de liquidación con stablecoins, sino validar la integración técnica mínima con XRPL antes de avanzar hacia IOUs, trust lines, DEX y pathfinding.

El flujo implementado actualmente es:

```text
Issuer A Treasury -> Issuer B Treasury
              XRP
```

El flujo objetivo del proyecto en fases posteriores será:

```text
Stablecoin_A -> XRP -> Stablecoin_B
```

---

## 2. Alcance actual

La integración XRPL actual incluye:

- Conexión del backend con XRPL Testnet.
- Configuración mediante variables de entorno.
- Generación y fondeo de wallets de prueba.
- Consulta de balances de las tesorerías.
- Envío de XRP desde la tesorería de Issuer A hacia la tesorería de Issuer B.
- Espera de validación de la transacción.
- Obtención del hash de transacción.
- Registro del resultado en `PaymentEvent`.
- Protección básica frente a doble liquidación del mismo `paymentId`.

La integración actual no incluye todavía:

- IOUs / issued currencies.
- Trust lines.
- Ofertas en el DEX de XRPL.
- Pathfinding.
- Conversión entre stablecoins de distintos emisores.
- Máquina de estados formal para la liquidación.
- Ledger de doble entrada.
- Reintentos específicos de liquidación XRPL.

---

## 3. Ubicación del módulo

El módulo XRPL se encuentra en:

```text
apps/api/src/modules/xrpl
```

Archivos principales:

```text
apps/api/src/modules/xrpl/xrpl.module.ts
apps/api/src/modules/xrpl/xrpl.config.ts
apps/api/src/modules/xrpl/xrpl-client.service.ts
apps/api/src/modules/xrpl/xrpl-settlement.service.ts
apps/api/src/modules/xrpl/xrpl.controller.ts
apps/api/src/modules/xrpl/dto/settle-xrp-payment.dto.ts
```

Scripts auxiliares:

```text
apps/api/src/modules/xrpl/scripts/fund-testnet-wallets.ts
apps/api/src/modules/xrpl/scripts/check-xrpl-balances.ts
```

El módulo se importa desde:

```text
apps/api/src/app.module.ts
```

---

## 4. Configuración

La configuración XRPL se gestiona mediante variables de entorno.

Archivo local:

```text
apps/api/.env
```

Variables utilizadas:

```env
XRPL_NETWORK=testnet
XRPL_SERVER_URL=wss://s.altnet.rippletest.net:51233

XRPL_ISSUER_A_TREASURY_SEED=
XRPL_ISSUER_B_TREASURY_SEED=

XRPL_DEFAULT_XRP_AMOUNT=1
```

El archivo de ejemplo:

```text
apps/api/.env.example
```

debe mantener las seeds vacías:

```env
XRPL_ISSUER_A_TREASURY_SEED=
XRPL_ISSUER_B_TREASURY_SEED=
```

Las seeds reales solo deben existir en el `.env` local y no deben subirse al repositorio.

---

## 5. Red utilizada

La integración utiliza XRPL Testnet:

```text
wss://s.altnet.rippletest.net:51233
```

La Testnet permite ejecutar transacciones reales en una red de pruebas sin utilizar fondos con valor económico.

---

## 6. Cuentas de prueba

Para este MVP se utilizan dos cuentas XRPL Testnet:

```text
Issuer A Treasury
Issuer B Treasury
```

Estas cuentas representan, de forma simplificada, las tesorerías técnicas de los dos emisores simulados.

Direcciones utilizadas durante la validación inicial:

```text
Issuer A Treasury: rsWod2WAytjnimCHbRn71n4pcTUayqUto2
Issuer B Treasury: rKHEKJ7zkDZP5HM7q3Krr9vc29UazfQqD
```

---

## 7. Scripts disponibles

### 7.1. Generar y fondear wallets Testnet

```powershell
npm run xrpl:fund -w apps/api
```

Este script genera dos wallets de prueba en XRPL Testnet y muestra por consola sus direcciones públicas y seeds.

Las seeds generadas deben copiarse manualmente en:

```text
apps/api/.env
```

### 7.2. Consultar balances

```powershell
npm run xrpl:balances -w apps/api
```

Este script lee las seeds configuradas en el `.env`, reconstruye las wallets correspondientes y consulta sus balances XRP en Testnet.

Ejemplo de salida:

```text
XRPL treasury balances

Network: testnet
Server: wss://s.altnet.rippletest.net:51233

Issuer A Treasury
Address: rsWod2WAytjnimCHbRn71n4pcTUayqUto2
Balance: 98.999988 XRP

Issuer B Treasury
Address: rKHEKJ7zkDZP5HM7q3Krr9vc29UazfQqD
Balance: 101 XRP
```

---

## 8. Endpoints

### 8.1. Health XRPL

```http
GET /xrpl/health
```

Comprueba la conectividad del backend con XRPL Testnet.

Respuesta de ejemplo:

```json
{
  "network": "testnet",
  "serverUrl": "wss://s.altnet.rippletest.net:51233",
  "connected": true,
  "validatedLedgerSeq": 17092858,
  "completeLedgers": "12929081-17092858"
}
```

### 8.2. Liquidación XRP mínima

```http
POST /xrpl/settlements/xrp
```

Body:

```json
{
  "paymentId": "cmorfyve50001vdaowldfe4al",
  "amountXrp": "1"
}
```

Este endpoint ejecuta una transferencia XRP desde `Issuer A Treasury` hacia `Issuer B Treasury`.

El `Payment` indicado debe existir en base de datos y estar en estado:

```text
ISO_ACK_ACCEPTED
```

Respuesta de ejemplo:

```json
{
  "alreadySettled": false,
  "paymentId": "cmorfyve50001vdaowldfe4al",
  "network": "testnet",
  "txHash": "282FDF3A6ABBED47EE9260A27F24E9EA4DC5CBE0BD4DBA3DBB6F171E15341C2A",
  "ledgerIndex": 17092898,
  "engineResult": "tesSUCCESS",
  "validated": true,
  "from": "rsWod2WAytjnimCHbRn71n4pcTUayqUto2",
  "to": "rKHEKJ7zkDZP5HM7q3Krr9vc29UazfQqD",
  "amountXrp": "1"
}
```

---

## 9. Flujo de liquidación implementado

El servicio de liquidación XRPL sigue el siguiente flujo:

1. Recibe un `paymentId`.
2. Busca el pago correspondiente en base de datos.
3. Comprueba que el pago existe.
4. Comprueba que el pago está en estado `ISO_ACK_ACCEPTED`.
5. Comprueba si ya existe un evento `XRPL_XRP_PAYMENT_CONFIRMED` para ese pago.
6. Si ya existe, devuelve la liquidación existente y no envía una nueva transacción.
7. Si no existe, envía una transacción XRP en XRPL Testnet.
8. Espera la validación de la transacción.
9. Persiste el resultado en `PaymentEvent`.
10. Devuelve los datos principales de la transacción confirmada.

---

## 10. Persistencia de eventos XRPL

La integración actual reutiliza la tabla existente:

```text
PaymentEvent
```

No se ha creado todavía una tabla específica para liquidaciones XRPL.

Eventos utilizados:

```text
XRPL_XRP_PAYMENT_REQUESTED
XRPL_XRP_PAYMENT_CONFIRMED
XRPL_XRP_PAYMENT_FAILED
```

### 10.1. Evento de solicitud

```text
XRPL_XRP_PAYMENT_REQUESTED
```

Indica que se ha iniciado una solicitud de liquidación XRPL para un pago.

Payload esperado:

```json
{
  "network": "testnet",
  "amountXrp": "1",
  "requestedAt": "2026-05-04T..."
}
```

### 10.2. Evento de confirmación

```text
XRPL_XRP_PAYMENT_CONFIRMED
```

Indica que la transacción XRPL ha sido validada correctamente.

Payload esperado:

```json
{
  "network": "testnet",
  "txHash": "282FDF3A6ABBED47EE9260A27F24E9EA4DC5CBE0BD4DBA3DBB6F171E15341C2A",
  "ledgerIndex": 17092898,
  "engineResult": "tesSUCCESS",
  "validated": true,
  "from": "rsWod2WAytjnimCHbRn71n4pcTUayqUto2",
  "to": "rKHEKJ7zkDZP5HM7q3Krr9vc29UazfQqD",
  "amountXrp": "1",
  "confirmedAt": "2026-05-04T..."
}
```

### 10.3. Evento de fallo

```text
XRPL_XRP_PAYMENT_FAILED
```

Indica que la liquidación XRPL no pudo completarse correctamente.

Payload esperado:

```json
{
  "network": "testnet",
  "amountXrp": "1",
  "error": "...",
  "failedAt": "2026-05-04T..."
}
```

---

## 11. Protección frente a doble liquidación

El endpoint de liquidación evita reenviar una transacción XRPL si el pago ya tiene un evento confirmado.

La comprobación se basa en la existencia previa de:

```text
XRPL_XRP_PAYMENT_CONFIRMED
```

para el mismo `paymentId`.

En ese caso, la respuesta indica:

```json
{
  "alreadySettled": true,
  "paymentId": "cmorfyve50001vdaowldfe4al",
  "eventId": "cmorg04gd000pvdaofej8vn0h",
  "payload": {
    "txHash": "282FDF3A6ABBED47EE9260A27F24E9EA4DC5CBE0BD4DBA3DBB6F171E15341C2A",
    "engineResult": "tesSUCCESS",
    "validated": true
  }
}
```

Esta protección es una medida mínima de seguridad para el MVP. La idempotencia completa de liquidación se podrá reforzar en fases posteriores.

---

## 12. Resultado validado

Durante la validación inicial se ejecutó correctamente una transacción XRP real en XRPL Testnet.

Resultado:

```text
Transaction hash: 282FDF3A6ABBED47EE9260A27F24E9EA4DC5CBE0BD4DBA3DBB6F171E15341C2A
Ledger index: 17092898
Engine result: tesSUCCESS
Validated: true
Amount: 1 XRP
Source: rsWod2WAytjnimCHbRn71n4pcTUayqUto2
Destination: rKHEKJ7zkDZP5HM7q3Krr9vc29UazfQqD
```

Balances posteriores:

```text
Issuer A Treasury: 98.999988 XRP
Issuer B Treasury: 101 XRP
```

La cuenta emisora reduce su saldo en algo más de `1 XRP` porque también asume la comisión de red.

---

## 13. Decisiones de diseño

### 13.1. Uso de `PaymentEvent`

No se ha creado una entidad específica para liquidaciones XRPL.

Para el alcance actual, `PaymentEvent` es suficiente porque permite registrar:

- hash de transacción;
- ledger index;
- resultado de validación;
- direcciones origen y destino;
- importe;
- red utilizada;
- timestamp de confirmación.

Una tabla específica de liquidación podrá tener sentido más adelante, cuando se incorporen IOUs, pathfinding, rutas, fees, slippage, estados y reintentos.

### 13.2. Sin transición a `SETTLED`

El estado del pago permanece como:

```text
ISO_ACK_ACCEPTED
```

después de la transacción XRPL.

Esto es intencionado. La transición formal a estados como `SETTLED`, `FAILED` o `REVERSED` pertenece a la fase de orquestación y máquina de estados.

### 13.3. Primero XRP directo

La primera integración utiliza XRP directo porque es la transacción XRPL más simple que permite validar:

- conexión con la red;
- reconstrucción de wallets desde seed;
- firma de transacciones;
- envío a XRPL;
- validación en ledger;
- obtención de hash;
- persistencia de evidencia técnica.

---

## 14. Comprobaciones

La integración se considera válida si pasan las siguientes comprobaciones:

```powershell
npm run build -w apps/api
npm run test -w apps/api
npx jest --config ./apps/api/test/jest-e2e.json
```

Comprobaciones operativas:

```powershell
npm run xrpl:balances -w apps/api
Invoke-RestMethod http://localhost:3000/xrpl/health
```

Comprobación funcional:

```text
Un pago en estado ISO_ACK_ACCEPTED puede liquidarse mediante POST /xrpl/settlements/xrp.
La respuesta incluye txHash, ledgerIndex, engineResult = tesSUCCESS y validated = true.
Una segunda llamada con el mismo paymentId no genera una segunda transacción XRPL.
```

---

## 15. Limitaciones actuales

La implementación actual es un MVP técnico.

Limitaciones:

1. La liquidación se realiza con XRP directo.
2. No representa todavía una stablecoin emitida.
3. No existen trust lines.
4. No se han configurado activos emitidos por cada emisor.
5. No se utiliza el DEX de XRPL.
6. No existe pathfinding.
7. No hay cálculo de slippage o rutas.
8. No se ha integrado todavía con una máquina de estados.
9. No se ha integrado todavía con ledger de doble entrada.
10. No hay reintentos específicos para liquidaciones XRPL fallidas.

---

## 16. Próximos pasos

La siguiente fase de la integración XRPL debería incorporar issued currencies y trust lines.

Objetivos del siguiente bloque:

```text
1. Definir cuentas emisoras para los activos de prueba.
2. Crear activos emitidos representando stablecoins internas.
3. Configurar trust lines entre cuentas.
4. Ejecutar una transferencia básica de IOU.
5. Preparar la base para DEX/pathfinding.
```

Después de esa fase, el proyecto podrá avanzar hacia el objetivo completo:

```text
Stablecoin_A -> XRP -> Stablecoin_B
```

mediante liquidez en XRPL y pathfinding.