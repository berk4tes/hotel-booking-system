\# Hotel Booking System - SE 4458 Final Project



Microservices-based hotel booking platform. \*\*Individual project.\*\* Goal: complete all functional + non-functional requirements from the assignment PDF and ship to cloud for high grade.



Developer: Berk Ates, Yaşar Üniversitesi, Software Engineering. Spring 2026.



\---



\## Status as of 2026-05-21



\### Done

\- GitHub repo + monorepo structure with 7 service folders + frontend + docs

\- Node.js + Express scaffolding for all services (express, dotenv, cors installed in each)

\- \*\*Neon PostgreSQL\*\* (Frankfurt) - schema and seed data deployed:

&#x20; - 6 hotels (Rome, Bodrum, Istanbul, Paris)

&#x20; - 10 rooms across hotels

&#x20; - 610 availability records (60 days forward, all rooms vacant)

&#x20; - 0 bookings

\- \*\*MongoDB Atlas\*\* (Frankfurt) - `hotel-booking` database:

&#x20; - `comments` collection with 32 sample comments across 6 hotels

&#x20; - Indexes on `hotel\_id` and `date`

\- \*\*Supabase Auth\*\* (Frankfurt):

&#x20; - Email/password provider on, email confirmation off

&#x20; - Test users:

&#x20;   - `admin@hotel.com` / `Admin12345!` (app\_metadata: `{role: "admin"}`)

&#x20;   - `user@hotel.com` / `User12345!`

\- \*\*Admin Service\*\* (port 3001) - functional:

&#x20; - `GET /health`

&#x20; - All `/api/v1/\*` require Bearer token + admin role (JWKS verification via `jose`)

&#x20; - Hotels CRUD: `GET/POST/PUT /api/v1/hotels`

&#x20; - Rooms CRUD: `GET/POST/PUT /api/v1/rooms`

&#x20; - Availability: `PUT /api/v1/rooms/:id/availability`

&#x20; - Verified end-to-end with real Supabase admin token: health, missing-token 401, normal-user 403, hotels list, rooms list, and `hotel_id` room filter

\- \*\*Search Service\*\* (port 3002) - functional:

&#x20; - `GET /health`

&#x20; - `GET /api/v1/hotels/search?city=&start_date=&end_date=&guests=&page=&limit=`

&#x20; - Search filters by city/date/guest availability and returns map fields (`lat`, `lng`)

&#x20; - Optional Bearer token enables 15% discounted prices in response

&#x20; - `GET /api/v1/hotels/:id` returns hotel + rooms using Upstash Redis REST cache-aside

&#x20; - Verified public search with Neon and Redis cache miss/hit (`hotel:6` miss then hit)

&#x20; - Verified authenticated Supabase user token smoke test; response includes `discounted_price` and `discounted_min_price`

&#x20; - Search service uses `.env` keys: `PORT`, `DATABASE_URL`, `SUPABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

\- \*\*Comments Service\*\* (port 3004) - functional:

&#x20; - `GET /health`

&#x20; - `GET /api/v1/hotels/:id/comments?page=&limit=` returns paginated MongoDB comments

&#x20; - `GET /api/v1/hotels/:id/comments/summary` returns MongoDB aggregation with total, `average_overall`, and category averages

&#x20; - `POST /api/v1/hotels/:id/comments` requires Bearer token and writes verified user comments

&#x20; - Verified public list/summary and authenticated write smoke test; temporary test comment was cleaned up

&#x20; - Comments service uses `.env` keys: `PORT`, `MONGODB_URI`, `SUPABASE_URL`

\- \*\*CloudAMQP RabbitMQ\*\* - configured:

&#x20; - Free `Loyal Lemming` LavinMQ instance in AWS Stockholm (`EU-North-1`)

&#x20; - `reservations` durable queue verified with `amqplib`

\- \*\*Booking Service\*\* (port 3003) - functional:

&#x20; - `GET /health`

&#x20; - All `/api/v1/*` require Bearer token (JWKS verification via `jose`)

&#x20; - `POST /api/v1/bookings` validates room capacity and date availability in a PostgreSQL transaction

&#x20; - Booking creation decrements `room_availability.available_count` and inserts into `bookings`

&#x20; - Publishes reservation confirmation payload to RabbitMQ `reservations` queue

&#x20; - `GET /api/v1/bookings/me?page=&limit=` returns paginated user bookings

&#x20; - Verified end-to-end with real Supabase user token, Neon transaction, and CloudAMQP publish; test booking and availability were cleaned up

&#x20; - Booking service uses `.env` keys: `PORT`, `DATABASE_URL`, `SUPABASE_URL`, `AMQP_URL`

\- \*\*Notification Service\*\* (port 3005) - functional:

&#x20; - `GET /health`

&#x20; - `GET /cron/check-capacity` checks next 30 days of room availability and logs low-capacity admin alerts

&#x20; - `GET /cron/process-reservations` consumes all messages from RabbitMQ `reservations` queue and logs reservation notifications

&#x20; - Verified capacity smoke test over 10 rooms and RabbitMQ consumer smoke test with a temporary message

&#x20; - Notification service uses `.env` keys: `PORT`, `DATABASE_URL`, `AMQP_URL`

\- \*\*AI Agent Service\*\* (port 3006) - functional:

&#x20; - `GET /health`

&#x20; - `POST /api/v1/ai/chat` calls OpenAI `gpt-4o-mini`

&#x20; - Tool definitions implemented: `search_hotels`, `get_hotel_details`, `get_comments_summary`, `book_hotel`

&#x20; - Tools route through `GATEWAY_URL`; booking tool requires and forwards `Authorization`

&#x20; - Verified OpenAI API key, non-tool chat smoke test, and gateway-routed `search_hotels` tool e2e smoke test

&#x20; - AI Agent service uses `.env` keys: `PORT`, `GATEWAY_URL`, `OPENAI_API_KEY`

\- \*\*API Gateway\*\* (port 3000) - functional:

&#x20; - `GET /health`

&#x20; - CORS open for frontend

&#x20; - Routes via `http-proxy-middleware`: `/api/v1/admin`, `/api/v1/search`, `/api/v1/bookings`, `/api/v1/comments`, `/api/v1/ai`

&#x20; - Forwards `Authorization` header to downstream services

&#x20; - Verified gateway smoke test for Search, Comments, Booking auth, AI chat, and AI tool routing

&#x20; - Gateway service uses `.env` keys: `PORT`, `ADMIN_SERVICE_URL`, `SEARCH_SERVICE_URL`, `BOOKING_SERVICE_URL`, `COMMENTS_SERVICE_URL`, `AI_AGENT_SERVICE_URL`

\- \*\*Frontend\*\* - implemented:

&#x20; - React + Vite + Tailwind CSS app in `frontend/`

&#x20; - Uses Supabase JS client for login/register/session state

&#x20; - All API calls go through `VITE_API_GATEWAY_URL`

&#x20; - Pages implemented: search home, hotel detail, login, register, my bookings, admin dashboard

&#x20; - Search results include member discount badge and Leaflet map toggle

&#x20; - Hotel detail includes rooms, booking action, comments, and rating-category progress bars

&#x20; - Sticky AI chat widget calls `/api/v1/ai/chat`

&#x20; - Production build verified with `npm run build`; visual browser smoke test tool was unavailable in this session

&#x20; - Frontend `.env` keys: `VITE_API_GATEWAY_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

\- \*\*Dockerfiles\*\* - added:

&#x20; - Dockerfile exists for all 7 backend services

&#x20; - Frontend Dockerfile uses Vite build stage and nginx static serving stage

&#x20; - Docker images were not built or pushed, per assignment note

\- \*\*GitHub Actions scheduler\*\* - added:

&#x20; - `.github/workflows/cron.yml` triggers notification cron endpoints daily at 02:00 UTC

&#x20; - Manual `workflow_dispatch` trigger included for demos

&#x20; - Requires GitHub secret `NOTIFICATION_URL` after Notification Service is deployed



\### Remaining (in priority order)

1\. \*\*Cloud deployment\*\* (Azure App Service for 7 backends, Vercel for frontend)

2\. \*\*README\*\* with deployed URLs, ER diagram, assumptions, video link

3\. \*\*Demo video\*\* (max 5 min)



\---



\## Tech Stack



| Layer | Technology |

|---|---|

| Backend | Node.js + Express (CommonJS) |

| SQL DB | Neon PostgreSQL (Frankfurt) |

| NoSQL | MongoDB Atlas (Frankfurt) |

| Cache | Upstash Redis (Frankfurt) |

| Auth | Supabase Auth - JWKS asymmetric ES256 |

| Queue | CloudAMQP (RabbitMQ) |

| AI | OpenAI GPT-4o-mini with tool calling |

| Frontend | React 18 + Vite + Tailwind CSS |

| Map | Leaflet (react-leaflet) - free, no API key |

| API Gateway | Express + http-proxy-middleware |

| Scheduler | GitHub Actions cron |

| Deploy (API) | Azure App Service (Linux, Node 20) |

| Deploy (Frontend) | Vercel |



\---



\## Repo Structure

hotel-booking-system/

├── CLAUDE.md

├── README.md

├── .gitignore

├── services/

│   ├── admin/          DONE  port 3001

│   ├── search/         DONE  port 3002

│   ├── booking/        DONE  port 3003

│   ├── comments/       DONE  port 3004

│   ├── notification/   DONE  port 3005

│   ├── ai-agent/       DONE  port 3006

│   └── gateway/        DONE  port 3000

├── frontend/           DONE

├── docs/               TODO (ER diagram, architecture diagram)

└── .github/workflows/  DONE (cron.yml)



Each service is flat (no `src/` subfolder): `index.js`, `db.js`, `auth.js` directly in the service root.



\---



\## Environment Variables



Real credentials are NOT in this file. They live in `C:\\Users\\berka\\Desktop\\hotel-secrets.txt` (local dev) and Azure App Service environment variables (production).



Each service has its own `.env` file (gitignored). Common pattern:

PORT=3XXX

DATABASE\_URL=postgresql://neondb\_owner:...@ep-young-credit-alj97g0s.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require

MONGODB\_URI=mongodb+srv://hoteladmin:...@cluster0.d0rqojv.mongodb.net/hotel-booking?retryWrites=true\&w=majority

SUPABASE\_URL=https://qqocixdnwjuvhkyarcte.supabase.co

SUPABASE\_SECRET\_KEY=sb\_secret\_...

AMQP\_URL=amqps://...

REDIS\_URL=rediss://...

OPENAI\_API\_KEY=sk-...

GATEWAY\_URL=http://localhost:3000



Each service only needs the env vars it uses.



\---



\## Database Schemas



\### Postgres (Neon)

\- `hotels(id SERIAL PK, name, city, country, address, lat DECIMAL(10,7), lng DECIMAL(10,7), description, rating DECIMAL(2,1), amenities TEXT\[], created\_at)`

\- `rooms(id SERIAL PK, hotel\_id FK->hotels, room\_type, capacity INT, price\_per\_night DECIMAL(10,2), total\_count INT, created\_at)`

\- `room\_availability(id SERIAL PK, room\_id FK->rooms, date DATE, available\_count INT, UNIQUE(room\_id, date))`

\- `bookings(id SERIAL PK, user\_id, user\_email, room\_id FK->rooms, start\_date, end\_date, guests INT, total\_price DECIMAL, status DEFAULT 'confirmed', created\_at)`



Indexes: `hotels(city)`, `rooms(hotel\_id)`, `room\_availability(room\_id, date)`, `bookings(user\_id)`.



\### MongoDB Atlas

Database: `hotel-booking`, Collection: `comments`:



```json

{

&#x20; "hotel\_id": "number",

&#x20; "user\_id": "string",

&#x20; "user\_country": "string",

&#x20; "ratings": { "cleanliness": 0, "staff": 0, "amenities": 0, "location": 0, "eco\_friendly": 0 },

&#x20; "text": "string",

&#x20; "verified": true,

&#x20; "date": "Date",

&#x20; "created\_at": "Date"

}

```



Indexes: `hotel\_id`, `date(desc)`.



\---



\## Authentication



Supabase issues JWTs signed with \*\*asymmetric ES256\*\* (new JWT Signing Keys system, not legacy HS256 secret). Backend verifies via JWKS endpoint:

${SUPABASE\_URL}/auth/v1/.well-known/jwks.json



Middleware pattern (already implemented in admin service, copy to others):



```javascript

const { createRemoteJWKSet, jwtVerify } = require("jose");

const JWKS = createRemoteJWKSet(

&#x20; new URL(process.env.SUPABASE\_URL + "/auth/v1/.well-known/jwks.json")

);



async function verifyToken(req, res, next) {

&#x20; const authHeader = req.headers.authorization;

&#x20; if (!authHeader || !authHeader.startsWith("Bearer ")) {

&#x20;   return res.status(401).json({ error: "Missing token" });

&#x20; }

&#x20; const token = authHeader.substring(7);

&#x20; try {

&#x20;   const { payload } = await jwtVerify(token, JWKS);

&#x20;   req.user = payload;

&#x20;   next();

&#x20; } catch (e) {

&#x20;   return res.status(401).json({ error: "Invalid token" });

&#x20; }

}



function requireAdmin(req, res, next) {

&#x20; if (req.user?.app\_metadata?.role !== "admin") {

&#x20;   return res.status(403).json({ error: "Admin role required" });

&#x20; }

&#x20; next();

}



module.exports = { verifyToken, requireAdmin };

```



Token shape (relevant claims):

\- `sub`: user UUID

\- `email`

\- `app\_metadata.role`: `"admin"` for admin users (otherwise undefined)



Get a token (PowerShell test):



```powershell

$body = @{ email="admin@hotel.com"; password="Admin12345!" } | ConvertTo-Json

$resp = Invoke-RestMethod -Uri "https://qqocixdnwjuvhkyarcte.supabase.co/auth/v1/token?grant\_type=password" -Method POST -Body $body -ContentType "application/json" -Headers @{ apikey = "SUPABASE\_PUBLISHABLE\_KEY" }

$resp.access\_token

```



\---



\## API Conventions



\- Versioning: All routes prefixed with `/api/v1/`

\- Pagination: `?page=1\&limit=10` (default page=1, limit=10)

\- Response envelope (lists): `{ "data": \[...], "page": 1, "limit": 10, "total": 25 }`

\- Errors: `{ "error": "message", "detail": "optional" }` with HTTP status

\- Health: Every service exposes `GET /health` returning `{ service, status: "ok" }`

\- Auth: `Authorization: Bearer <jwt>` header



\---



\## Service Specifications



\### admin (DONE, port 3001)

Auth required for all `/api/v1/\*`. Admin role required.

\- `GET /api/v1/hotels` (paginated)

\- `POST /api/v1/hotels`

\- `PUT /api/v1/hotels/:id`

\- `GET /api/v1/rooms?hotel\_id=`

\- `POST /api/v1/rooms`

\- `PUT /api/v1/rooms/:id`

\- `PUT /api/v1/rooms/:id/availability` { start\_date, end\_date, is\_available }



\### search (TODO, port 3002)

Public. Optional Bearer token enables discount.

\- `GET /api/v1/hotels/search?city=\&start\_date=\&end\_date=\&guests=\&page=\&limit=`

&#x20; - Only returns hotels where at least one room has `available\_count >= guests` for every date in \[start\_date, end\_date]

&#x20; - If Authorization header is valid: prices include `discounted\_price` (15% off)

&#x20; - Includes `lat`, `lng` for map view

\- `GET /api/v1/hotels/:id`

&#x20; - MUST use Redis cache. Key: `hotel:{id}`, TTL: 300 seconds

&#x20; - Cache-aside: check Redis → fall back to DB → write to Redis

&#x20; - Returns hotel + rooms list



\### booking (TODO, port 3003)

Auth required.

\- `POST /api/v1/bookings` { room\_id, start\_date, end\_date, guests }

&#x20; - Validate availability for entire date range

&#x20; - Decrement `room\_availability.available\_count` by 1 for each date (atomic transaction)

&#x20; - Insert into `bookings`

&#x20; - Publish to `reservations` RabbitMQ queue: `{ booking\_id, user\_email, hotel\_name, room\_type, start\_date, end\_date, total\_price }`

\- `GET /api/v1/bookings/me?page=\&limit=`



\### comments (TODO, port 3004)

Public read, auth for write.

\- `GET /api/v1/hotels/:id/comments?page=\&limit=`

\- `GET /api/v1/hotels/:id/comments/summary` → MongoDB aggregation returning total, average\_overall, and average per rating category

\- `POST /api/v1/hotels/:id/comments` (auth) { ratings: {...}, text }



\### notification (TODO, port 3005)

\- `GET /cron/check-capacity` → for each room, sum `available\_count` for next 30 days. If sum < 20% of (total\_count \* 30), log "Admin alert: low capacity for room X (hotel Y)". (`console.log` is fine for grading.)

\- `GET /cron/process-reservations` → consume all messages from `reservations` queue, log "Notification sent to {user\_email}: reservation #{id} confirmed at {hotel\_name}".

\- Both endpoints triggered by GitHub Actions cron daily at 02:00 UTC.



\### ai-agent (DONE, port 3006)

Auth optional (required for booking action).

\- `POST /api/v1/ai/chat` { messages: \[{role, content}] }

&#x20; - OpenAI GPT-4o-mini with tool calling

&#x20; - Tools: `search\_hotels`, `get\_hotel\_details`, `get\_comments\_summary`, `book\_hotel` — all route through Gateway URL

&#x20; - Returns: `{ assistant\_message, tool\_calls, tool\_results }`



\### gateway (DONE, port 3000)

No auth at gateway — downstream services validate their own tokens. CORS open for frontend.

\- `GET /health`

\- Routes via `http-proxy-middleware`:

&#x20; - `/api/v1/admin/\*` → `http://localhost:3001`

&#x20; - `/api/v1/search/\*` → `http://localhost:3002`

&#x20; - `/api/v1/bookings/\*` → `http://localhost:3003`

&#x20; - `/api/v1/comments/\*` → `http://localhost:3004`

&#x20; - `/api/v1/ai/\*` → `http://localhost:3006`

\- Forward `Authorization` header

\- Production: use Azure App Service URLs instead of localhost



\---



\## Frontend (DONE)



Stack: React 18 + Vite + Tailwind CSS + Supabase JS client + react-leaflet.



Pages:

\- `/` - Search home: city autocomplete, date range picker, guests, "Ara" button, results list + "Haritada göster" toggle

\- `/hotels/:id` - Detail: photo, info, rooms, comments with progress bars per rating category (matches PDF mockup), "Rezervasyon yap" button

\- `/admin` - Admin dashboard: hotel/room CRUD forms, availability date range setter

\- `/login`, `/register` - Supabase auth

\- `/my-bookings` - User's bookings list



Components:

\- Sticky AI chat widget (bottom-right corner, all pages)

\- Header with login/user button

\- "Üye Fiyatı: %15 indirim" badge for logged-in users on prices



All API calls → `import.meta.env.VITE\_API\_GATEWAY\_URL`.



\---



\## Deployment



\### Backends → Azure App Service

Each of the 7 services as a separate App Service (Linux, Node 20). Env vars in App Service Configuration.



\### Frontend → Vercel

Connect GitHub repo, root: `frontend/`. Env: `VITE\_API\_GATEWAY\_URL`.



\### Scheduler → GitHub Actions

`.github/workflows/cron.yml`:



```yaml

on:

&#x20; schedule:

&#x20;   - cron: '0 2 \* \* \*'

jobs:

&#x20; trigger:

&#x20;   runs-on: ubuntu-latest

&#x20;   steps:

&#x20;     - run: curl ${{ secrets.NOTIFICATION\_URL }}/cron/check-capacity

&#x20;     - run: curl ${{ secrets.NOTIFICATION\_URL }}/cron/process-reservations

```



\---



\## Grading Requirements Checklist (from PDF)



\- \[x] Service-oriented framework, multiple services

\- \[x] REST web services

\- \[x] Versioning (`/api/v1/`)

\- \[x] Pagination on list endpoints

\- \[x] API gateway as single entry point

\- \[x] IAM (Supabase, no local auth)

\- \[x] Distributed cache for hotel details (Redis via Upstash REST)

\- \[x] Queue (RabbitMQ for reservations)

\- \[x] Comments in NoSQL (MongoDB)

\- \[x] Nightly scheduled task endpoints

\- \[x] AI Agent service with tool calling

\- \[x] Dockerfile per service (NOT docker image)

\- \[x] Cloud DB (Neon + Mongo, no SQLite)

\- \[ ] Cloud API hosting (Azure)

\- \[x] Cloud queue (CloudAMQP)

\- \[x] Cloud scheduler workflow (GitHub Actions; `NOTIFICATION_URL` secret needed after deploy)

\- \[x] Search returns only vacant rooms

\- \[x] Search applies 15% discount when logged in (verified with real Supabase token)

\- \[x] Search has map view ("Haritada göster") data (`lat`, `lng`)

\- \[x] Booking decreases capacity

\- \[x] Comments have distribution graph per rating category data

\- \[x] Notification: capacity alert + reservation queue consumer

\- \[ ] README with deployed URLs, ER diagram, assumptions, video link



\---



\## Code Style Conventions



\- CommonJS (`require`, `module.exports`) — NOT ESM

\- Flat file structure per service: `index.js`, `db.js`, `auth.js` directly in service root

\- Async/await everywhere; no callbacks, no `.then()` chains

\- try/catch with `res.status(500).json({error: e.message})` for DB ops

\- Turkish inline comments OK in development; English only for shared code

\- No docstrings, no decorative section banners

\- camelCase for JS variables; snake\_case for DB columns and JSON keys (match DB)

\- Every service starts with `require("dotenv").config();`



\---



\## Reusable Code Patterns



\### Postgres query

```javascript

const result = await pool.query("SELECT \* FROM hotels WHERE city=$1", \[city]);

res.json(result.rows);

```



\### Mongo query

```javascript

const docs = await db.collection("comments").find({ hotel\_id: parseInt(id) }).toArray();

```



\### Redis cache-aside

```javascript

const cacheKey = `hotel:${id}`;

const cached = await redis.get(cacheKey);

if (cached) return res.json(JSON.parse(cached));

const result = await pool.query("SELECT \* FROM hotels WHERE id=$1", \[id]);

await redis.set(cacheKey, JSON.stringify(result.rows\[0]), { EX: 300 });

res.json(result.rows\[0]);

```



\### RabbitMQ publish (booking)

```javascript

const amqp = require("amqplib");

const conn = await amqp.connect(process.env.AMQP\_URL);

const ch = await conn.createChannel();

await ch.assertQueue("reservations", { durable: true });

ch.sendToQueue("reservations", Buffer.from(JSON.stringify(payload)), { persistent: true });

```



\### RabbitMQ consume (notification)

```javascript

const ch = await conn.createChannel();

await ch.assertQueue("reservations", { durable: true });

ch.consume("reservations", (msg) => {

&#x20; if (msg) {

&#x20;   const payload = JSON.parse(msg.content.toString());

&#x20;   console.log("Notification:", payload);

&#x20;   ch.ack(msg);

&#x20; }

}, { noAck: false });

```



\### Gateway proxy route

```javascript

const { createProxyMiddleware } = require("http-proxy-middleware");

app.use("/api/v1/search", createProxyMiddleware({

&#x20; target: process.env.SEARCH\_SERVICE\_URL,

&#x20; changeOrigin: true,

&#x20; pathRewrite: { "^/api/v1/search": "/api/v1" }

}));

```



\---



\## Dev Environment Notes



\- Windows + PowerShell

\- File creation pattern: `@'...'@ | Set-Content -Path X -Encoding utf8`

\- Each service runs in its own terminal: `cd services/X; node index.js`

\- Quick HTTP test: `Invoke-RestMethod -Uri http://localhost:PORT/health`

\- With auth header: `Invoke-RestMethod -Uri http://... -Headers @{Authorization="Bearer $token"}`



\---



\## Critical Don'ts



\- Don't commit `.env` files (already in `.gitignore`)

\- Don't put secrets in CLAUDE.md or README

\- Don't use SQLite (assignment forbids it)

\- Don't use local auth (must use Supabase)

\- Don't create a Docker image — just Dockerfile per service

\- Don't skip pagination on list endpoints

\- Don't skip `/api/v1/` versioning prefix

\- Don't forget the Redis cache on hotel detail endpoint — explicit grading requirement

\- Don't make the AI agent require real-time messaging (explicit assignment note)



\---



\## Next Immediate Task



Prepare \*\*cloud deployment\*\* next: Azure App Service environment variables for each backend, Vercel frontend env vars, and GitHub Actions cron secrets.

