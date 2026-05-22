# Demo Runbook

This project can be demonstrated locally while using cloud-managed services for auth, SQL, NoSQL, cache, queue, and AI.

## Start Everything

From the repository root on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1
```

From the repository root on macOS/Linux:

```bash
chmod +x scripts/start-demo.sh scripts/stop-demo.sh
./scripts/start-demo.sh
```

Open:

```text
http://127.0.0.1:5173
```

## Demo Flow

1. Open the frontend and search for Rome with two guests.
2. Toggle the map view and show hotel markers.
3. Log in with the test user and repeat the search to show member discount prices.
4. Open a hotel detail page and show rooms, comments, and rating summaries.
5. Create a booking from a room card.
6. Open My Bookings and show the reservation.
7. Use the AI chat widget to search hotels or ask for a recommendation.
8. Call the notification endpoints from PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3005/cron/check-capacity"
Invoke-RestMethod -Uri "http://127.0.0.1:3005/cron/process-reservations"
```

## Smoke Checks

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/health"
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/search/hotels/search?city=Rome&start_date=2026-05-23&end_date=2026-05-24&guests=2"
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/comments/hotels/1/comments/summary"
```

## Stop Everything

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-demo.ps1
```

On macOS/Linux:

```bash
./scripts/stop-demo.sh
```
