#!/bin/bash
# Wake Queue Processor — checks for wake requests from MC org chart
# Sylvia picks these up and spawns the requested agent

QUEUE_DIR="/root/.openclaw/workspace/mission-control/wake-queue"
PROCESSED_DIR="${QUEUE_DIR}/processed"
mkdir -p "$PROCESSED_DIR"

# Find JSON files in queue
FILES=$(find "$QUEUE_DIR" -maxdepth 1 -name "*.json" -type f 2>/dev/null)

if [ -z "$FILES" ]; then
  echo "No wake requests pending"
  exit 0
fi

# Output the requests for Sylvia to process
for f in $FILES; do
  cat "$f"
  echo "---"
  mv "$f" "$PROCESSED_DIR/"
done
