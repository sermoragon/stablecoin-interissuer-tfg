# Testing actual del proyecto

## Objetivo

Recoger qué tipos de tests existen actualmente y qué cubren dentro del MVP.

---

## Tests unitarios

El proyecto incluye tests unitarios sobre piezas concretas del sistema, especialmente dentro del módulo `iso20022`.

Ejemplos relevantes:

- `pacs009.builder.spec.ts`
- `pacs009.parser.spec.ts`
- `pacs009.mapper.spec.ts`
- `technical-ack.builder.spec.ts`
- `technical-ack.parser.spec.ts`

También existen tests generados por scaffold para otros módulos, algunos de ellos todavía básicos.

---

## Test end-to-end principal

El test más representativo del flujo actual es:

```text
apps/api/test/iso-flow.e2e-spec.ts
```

Este test verifica de forma integrada el recorrido principal del MVP.

---

## Qué cubre el flujo e2e

A nivel general, el test e2e principal valida que:

- se puede iniciar el flujo desde `Issuer A`
- se construye y procesa el `pacs.009`
- `Issuer B` responde con ACK
- la información queda persistida
- el flujo se completa correctamente

---

## Comandos útiles

### Ejecutar tests unitarios

```powershell
npm run test
```

### Ejecutar el test e2e principal por archivo

```powershell
npx jest --config ./apps/api/test/jest-e2e.json --runTestsByPath apps/api/test/iso-flow.e2e-spec.ts
```

### Ejecutar toda la suite e2e

```powershell
npm run test:e2e -w apps/api
```

---

## Observaciones

- La cobertura actual se centra en el flujo ISO básico
- todavía no hay tests de validación XSD
- todavía no hay tests de seguridad, idempotencia o XRPL
- algunos tests generados por Nest siguen siendo de scaffold y no representan lógica real del negocio