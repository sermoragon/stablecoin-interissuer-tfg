# TFG - Sistema de pagos inter-emisor para stablecoins con ISO 20022 y XRPL

## Estado actual
Base del proyecto preparada en Windows 10:
- NestJS funcionando
- PostgreSQL con Docker Compose
- Prisma conectado
- Healthcheck operativo
- Definición inicial del flujo MVP

## Stack
- NestJS
- PostgreSQL
- Prisma
- Docker Compose
- TypeScript

## Arranque del proyecto
1. Abrir Docker Desktop

En powershell
2. Levantar la BD:
> docker compose up -d

3. Ejecutar migraciones:
> npx prisma migrate dev

4. Arrancar la API:
> npm run dev

5. Healthcheck
> Invoke-RestMethod http://localhost:3000/health







