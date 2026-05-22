#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.demo-logs"
mkdir -p "$LOG_DIR"

services=(
  "admin"
  "search"
  "booking"
  "comments"
  "notification"
  "ai-agent"
  "gateway"
)

for service in "${services[@]}"; do
  (
    cd "$ROOT/services/$service"
    nohup node index.js > "$LOG_DIR/$service.out.log" 2> "$LOG_DIR/$service.err.log" &
  )
done

(
  cd "$ROOT/frontend"
  nohup npm run dev -- --host 127.0.0.1 > "$LOG_DIR/frontend.out.log" 2> "$LOG_DIR/frontend.err.log" &
)

sleep 5

echo "Demo services started."
echo "Frontend: http://127.0.0.1:5173"
echo "Gateway:  http://127.0.0.1:3000"
echo "Logs:     $LOG_DIR"
