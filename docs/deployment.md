# Deployment Runbook

## Backend Target

Azure App Service, Linux, Node 20. Create one App Service per backend folder.

| App Service | Root folder | Port | Startup command |
|---|---|---:|---|
| hotel-admin-service | `services/admin` | 3001 | `node index.js` |
| hotel-search-service | `services/search` | 3002 | `node index.js` |
| hotel-booking-service | `services/booking` | 3003 | `node index.js` |
| hotel-comments-service | `services/comments` | 3004 | `node index.js` |
| hotel-notification-service | `services/notification` | 3005 | `node index.js` |
| hotel-ai-agent-service | `services/ai-agent` | 3006 | `node index.js` |
| hotel-gateway-service | `services/gateway` | 3000 | `node index.js` |

## Backend Environment Variables

### Admin

```text
PORT=3001
DATABASE_URL=...
SUPABASE_URL=...
```

### Search

```text
PORT=3002
DATABASE_URL=...
SUPABASE_URL=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### Booking

```text
PORT=3003
DATABASE_URL=...
SUPABASE_URL=...
AMQP_URL=...
```

### Comments

```text
PORT=3004
MONGODB_URI=...
SUPABASE_URL=...
```

### Notification

```text
PORT=3005
DATABASE_URL=...
AMQP_URL=...
```

### AI Agent

```text
PORT=3006
GATEWAY_URL=https://<gateway-app-service-url>
OPENAI_API_KEY=...
```

### Gateway

```text
PORT=3000
ADMIN_SERVICE_URL=https://<admin-app-service-url>
SEARCH_SERVICE_URL=https://<search-app-service-url>
BOOKING_SERVICE_URL=https://<booking-app-service-url>
COMMENTS_SERVICE_URL=https://<comments-app-service-url>
AI_AGENT_SERVICE_URL=https://<ai-agent-app-service-url>
```

## Scheduler Target

Azure Functions, Node 20, Consumption plan. Deploy the folder `scheduler/azure-functions`.

Required Function App setting after Notification Service deployment:

```text
NOTIFICATION_URL=https://<notification-app-service-url>
```

The timer trigger schedule is `0 0 2 * * *`, which runs daily at 02:00 UTC.

## Frontend Target

Azure Static Web Apps.

```text
App location: frontend
Output location: dist
Build command: npm run build
```

```text
VITE_API_GATEWAY_URL=https://<gateway-app-service-url>
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Smoke Test Order

1. Gateway: `GET /health`
2. Search through gateway: `GET /api/v1/search/hotels/search?city=Rome&start_date=2026-05-22&end_date=2026-05-24&guests=2`
3. Comments through gateway: `GET /api/v1/comments/hotels/1/comments/summary`
4. Booking through gateway with user Bearer token: `GET /api/v1/bookings/bookings/me`
5. AI through gateway: `POST /api/v1/ai/chat`
6. Notification directly: `GET /cron/check-capacity`
7. Azure Functions: run the `notificationCron` function or wait for the 02:00 UTC timer
