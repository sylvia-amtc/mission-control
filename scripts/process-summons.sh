#!/bin/bash
# Process VP summon queue files and output JSON for OpenClaw to act on
QUEUE_DIR="/root/.openclaw/workspace/mission-control/summon-queue"
if [ -z "$(ls -A "$QUEUE_DIR" 2>/dev/null)" ]; then
  echo "EMPTY"
  exit 0
fi
for f in "$QUEUE_DIR"/*.json; do
  [ -f "$f" ] || continue
  cat "$f"
  echo ""
  rm "$f"
done
