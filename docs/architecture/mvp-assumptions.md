# Supuestos y simplificaciones del MVP

## Propósito

Dejar por escrito qué partes del sistema están simplificadas deliberadamente en esta fase del prototipo para evitar confusión entre un MVP académico y una implementación productiva.

---

## Supuestos actuales

### 1. Un único backend simula ambos actores

`Issuer A` y `Issuer B` están implementados dentro de la misma API NestJS.

No se han separado todavía en servicios independientes.

---

### 2. Transporte simplificado

El intercambio entre emisores se simula mediante HTTP local.

No se está modelando una red interbancaria real ni una infraestructura externa de mensajería.

---

### 3. ACK técnico simplificado

La respuesta actual no es un `pacs.002` completo.  
Se utiliza un XML técnico más simple para validar el flujo básico de ida y vuelta.

---

### 4. Sin validación XSD

Los mensajes XML no se validan todavía contra esquemas XSD oficiales.

En esta fase se prioriza la construcción, parsing y persistencia del flujo.

---

### 5. Persistencia centrada en trazabilidad

La persistencia actual se orienta a dejar trazabilidad de:

- pagos
- mensajes XML
- eventos

No se está modelando todavía un ledger completo ni balances.

---

### 6. Sin idempotencia ni seguridad avanzada

Todavía no están implementados:

- HMAC
- Idempotency-Key
- anti-replay
- outbox/retries

---

### 7. Sin XRPL en la fase actual

La parte de liquidación en XRPL no forma parte del bloque actual.

Primero se valida el flujo básico ISO 20022 entre emisores simulados.

---

## Motivo de estas simplificaciones

Estas decisiones permiten:

- validar la arquitectura base
- entender el flujo extremo a extremo
- demostrar persistencia y trazabilidad
- preparar el terreno para fases posteriores más realistas

---

## Consecuencia práctica

El MVP actual debe entenderse como:

- un prototipo funcional
- una base técnica sólida para iterar
- una simulación académica controlada

No como una implementación productiva completa.