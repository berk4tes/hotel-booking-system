#!/usr/bin/env bash
set -euo pipefail

ports=(3000 3001 3002 3003 3004 3005 3006 5173)

for port in "${ports[@]}"; do
  pids="$(lsof -ti tcp:"$port" || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -9
    echo "Stopped process on port $port"
  fi
done
