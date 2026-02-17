#!/usr/bin/env bash
# Hourly log check for Mission Control
# Scans the last hour of logs for errors, crashes, and memory warnings
# Writes summary to hourly-report.md

LOG_FILE="/root/.openclaw/workspace/mission-control/logs/mission-control.log"
REPORT_FILE="/root/.openclaw/workspace/mission-control/logs/hourly-report.md"
NOW=$(date -u '+%Y-%m-%d %H:%M UTC')
ONE_HOUR_AGO=$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M' 2>/dev/null || date -u -v-1H '+%Y-%m-%dT%H:%M')

if [ ! -f "$LOG_FILE" ]; then
  cat > "$REPORT_FILE" <<EOF
# Hourly Log Report
**Generated:** $NOW

⚠️ Log file not found: \`$LOG_FILE\`
EOF
  exit 0
fi

# Extract lines from the last hour (best-effort timestamp matching)
# Looks for ISO timestamps or common date formats
RECENT_LINES=$(awk -v since="$ONE_HOUR_AGO" '
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/ {
    ts = substr($0, 1, 16)
    if (ts >= since) print
    next
  }
  /^{/ {
    # JSON logs — extract timestamp field
    if (match($0, /"timestamp":"([^"]+)"/, m)) {
      ts = substr(m[1], 1, 16)
      if (ts >= since) print
    } else if (match($0, /"time":"([^"]+)"/, m)) {
      ts = substr(m[1], 1, 16)
      if (ts >= since) print
    }
    next
  }
  # If no timestamp detected, include line (conservative)
  { print }
' "$LOG_FILE")

ERROR_COUNT=$(echo "$RECENT_LINES" | grep -ciE '"level":"error"|"level":"fatal"|error|ERROR|exception|Exception' || true)
CRASH_COUNT=$(echo "$RECENT_LINES" | grep -ciE 'crash|CRASH|killed|SIGKILL|SIGTERM|unhandled|uncaught' || true)
MEMORY_COUNT=$(echo "$RECENT_LINES" | grep -ciE 'memory|heap|oom|out.of.memory|max_memory' || true)

ERROR_LINES=$(echo "$RECENT_LINES" | grep -iE '"level":"error"|"level":"fatal"|error|ERROR|exception|Exception' | tail -10)
CRASH_LINES=$(echo "$RECENT_LINES" | grep -iE 'crash|CRASH|killed|SIGKILL|SIGTERM|unhandled|uncaught' | tail -5)
MEMORY_LINES=$(echo "$RECENT_LINES" | grep -iE 'memory|heap|oom|out.of.memory|max_memory' | tail -5)

TOTAL_LINES=$(echo "$RECENT_LINES" | wc -l)

if [ "$ERROR_COUNT" -eq 0 ] && [ "$CRASH_COUNT" -eq 0 ] && [ "$MEMORY_COUNT" -eq 0 ]; then
  STATUS="✅ Healthy"
elif [ "$CRASH_COUNT" -gt 0 ]; then
  STATUS="🔴 Critical — crashes detected"
elif [ "$ERROR_COUNT" -gt 5 ]; then
  STATUS="🟠 Warning — elevated errors"
else
  STATUS="🟡 Minor issues"
fi

cat > "$REPORT_FILE" <<EOF
# Hourly Log Report
**Generated:** $NOW
**Status:** $STATUS
**Log lines (last hour):** $TOTAL_LINES

## Summary
| Category | Count |
|----------|-------|
| Errors | $ERROR_COUNT |
| Crashes | $CRASH_COUNT |
| Memory warnings | $MEMORY_COUNT |
EOF

if [ "$ERROR_COUNT" -gt 0 ]; then
  cat >> "$REPORT_FILE" <<EOF

## Recent Errors (last 10)
\`\`\`
$ERROR_LINES
\`\`\`
EOF
fi

if [ "$CRASH_COUNT" -gt 0 ]; then
  cat >> "$REPORT_FILE" <<EOF

## Crash Events (last 5)
\`\`\`
$CRASH_LINES
\`\`\`
EOF
fi

if [ "$MEMORY_COUNT" -gt 0 ]; then
  cat >> "$REPORT_FILE" <<EOF

## Memory Warnings (last 5)
\`\`\`
$MEMORY_LINES
\`\`\`
EOF
fi
