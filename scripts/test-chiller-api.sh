#!/bin/bash

HOST="3.16.135.140"
PORT=${1:-8080}
URL="http://${HOST}:${PORT}/predict"

echo "Testing Chiller API on $URL..."

curl -X POST \
  "$URL" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "Windspeed": 0,
  "CFM": 30000.0,
  "Orientation": 0.0,
  "Spacing": 10
}'

echo ""
