# analytics-service

Registro de eventos e indicadores (ventas, merma, productores). Parte de **FarmToTable** (marketplace agrícola con microservicios orientados a eventos).

Estado: **Implementado** con PostgreSQL (Prisma) y RabbitMQ. Probado de punta a punta a través del API Gateway.

- Puerto local: `4008` · Ruta pública en el API Gateway: `/api/analytics`
- Base de datos propia (`DATABASE_URL`), nunca compartida con otro servicio
- Eventos por RabbitMQ (exchange topic `farmtotable.events`, ver `src/events.ts`)

## Contrato REST

Es lo que ya consume el frontend (y lo que simula su modo demo en `src/lib/mock/server.ts` del repo del frontend).
El API Gateway valida el JWT y reenvía `x-user-id` / `x-user-role`; usa `requireUser()` de `src/auth.ts`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/analytics/dashboard?days=7..90` | ADMIN | `{ revenue, commission, orders, avgTicket, ordersByStatus, salesByDay[], topProducts[], wasteKg, atRiskKg, deliveries{delivered,failed,inProgress,coldChainBreaches}, producers, buyers, recentEvents[] }` |

Errores: `{ "error": "mensaje" }` con 400 (validación zod), 401, 403, 404, 409 (estado inválido) o 422 (regla de negocio).

## Eventos

Publica:
- (ninguno)

Consume:
- `#` — todos los eventos: los guarda y actualiza las proyecciones

Todo consumidor debe envolverse en `idempotent()` (`src/db.ts`).

## Modelo de datos (Prisma)

- `EventLog` (eventId, eventType, source, occurredAt, data jsonb)
- Proyecciones: `DailySales` (date, revenue, orders), `ProductSales` (productId, name, kg, revenue), `BatchExpiry` para la merma

## Desarrollo

```bash
cp .env.example .env    # ajusta DATABASE_URL
npm install
npm run db:migrate      # crea/aplica migraciones
npm run dev
```

## Despliegue

`Dockerfile` + `render.yaml` (Render) y `.github/workflows/ci.yml`: compila en cada push/PR y, en `main`,
publica la imagen en GHCR y dispara el deploy hook de Render si existe el secreto `RENDER_DEPLOY_HOOK_URL`.
