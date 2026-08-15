#!/bin/bash
export PATH=$PATH:$(pwd)/node22_env/bin:$(pwd)/node_env/bin

echo "Starting persistent tunnel auto-restarter on port 5050..."

while true; do
    echo "[$(date)] Starting localtunnel..."
    npx localtunnel --port 5050
    echo "[$(date)] Tunnel disconnected. Reconnecting in 3 seconds..."
    sleep 3
done
