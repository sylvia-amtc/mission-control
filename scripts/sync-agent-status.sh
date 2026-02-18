#!/usr/bin/env bash
# sync-agent-status.sh — Sync OpenClaw session data → Mission Control org page
# Run via cron every 60s: * * * * * bash /root/.openclaw/workspace/mission-control/scripts/sync-agent-status.sh
set -euo pipefail

MC_API="bash /root/.openclaw/workspace/shared/mc-api.sh"
AGENTS_DIR="/root/.openclaw/agents"
ACTIVE_THRESHOLD_SEC=300  # 5 minutes = "active"

# Get all org agents from MC
AGENTS_JSON=$($MC_API GET /api/org/agents 2>/dev/null)
AGENT_IDS=$(echo "$AGENTS_JSON" | python3 -c "import json,sys; [print(a['agent_id']) for a in json.load(sys.stdin) if a.get('model','') != 'human']")

NOW_MS=$(date +%s%3N)
BATCH='['
FIRST=true

for agent_id in $AGENT_IDS; do
  STORE="$AGENTS_DIR/$agent_id/sessions/sessions.json"
  [ -f "$STORE" ] || continue

  # Get most recent session for this agent (excluding subagent/cron run duplicates)
  SESSION_INFO=$(openclaw sessions --store "$STORE" --json 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
if not d['sessions']:
    sys.exit(0)
# Find the most recently updated primary session (prefer :main or :telegram, skip :run: duplicates)
best = None
for s in d['sessions']:
    k = s['key']
    # Skip cron run duplicates
    if ':run:' in k:
        continue
    if best is None or s['ageMs'] < best['ageMs']:
        best = s
if best:
    # Determine a task description from the session key
    key = best['key']
    parts = key.split(':')
    kind = parts[2] if len(parts) > 2 else 'unknown'
    if kind == 'subagent':
        task = 'Running subagent task'
    elif kind == 'cron':
        task = 'Running scheduled task'
    elif kind == 'telegram':
        task = 'Responding in Telegram'
    elif kind == 'main':
        task = 'Processing main session'
    else:
        task = f'Active ({kind})'
    print(json.dumps({
        'age_ms': best['ageMs'],
        'task': task,
        'model': best.get('model', ''),
        'key': best['key'],
        'updated_at': best['updatedAt']
    }))
" 2>/dev/null) || continue

  [ -z "$SESSION_INFO" ] && continue

  AGE_MS=$(echo "$SESSION_INFO" | python3 -c "import json,sys; print(json.load(sys.stdin)['age_ms'])")
  TASK=$(echo "$SESSION_INFO" | python3 -c "import json,sys; print(json.load(sys.stdin)['task'])")
  UPDATED_AT=$(echo "$SESSION_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); from datetime import datetime,timezone; print(datetime.fromtimestamp(d['updated_at']/1000,timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")
  AGE_SEC=$((AGE_MS / 1000))

  if [ "$AGE_SEC" -lt "$ACTIVE_THRESHOLD_SEC" ]; then
    STATUS="active"
    ENTRY="{\"agent_id\":\"$agent_id\",\"status\":\"active\",\"current_task\":\"$TASK\",\"last_active_at\":\"$UPDATED_AT\"}"
  else
    STATUS="sleeping"
    ENTRY="{\"agent_id\":\"$agent_id\",\"status\":\"sleeping\",\"current_task\":null,\"last_task\":\"$TASK\",\"last_active_at\":\"$UPDATED_AT\"}"
  fi

  if [ "$FIRST" = true ]; then
    BATCH="$BATCH$ENTRY"
    FIRST=false
  else
    BATCH="$BATCH,$ENTRY"
  fi
done

BATCH="$BATCH]"

if [ "$FIRST" = false ]; then
  RESULT=$($MC_API POST /api/org/agents/batch-status "$BATCH" 2>/dev/null)
  echo "$(date -Iseconds) Synced: $RESULT"
else
  echo "$(date -Iseconds) No agent sessions found"
fi
