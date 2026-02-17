# Process Management Plan

**Status:** ✅ Approved & Implemented (2026-02-17)

**Approved by:** David
**Implemented by:** Viktor
**Details:** PM2 installed globally, ecosystem.config.js created, MC running under PM2 with auto-restart, memory limits (256M), and boot persistence via `pm2 startup` + `pm2 save`.

## Problem

MC (and future apps) crash and stay down until manually restarted. We need auto-restart, health monitoring, and memory limits for all apps.

## Options Evaluated

### 1. PM2 (Node process manager)

**Pros:**
- Purpose-built for Node.js — zero config for basic use
- Auto-restart on crash, configurable restart delay and max restarts
- Built-in log management (but we'd use our shared logger instead)
- Cluster mode for multi-core utilization
- `ecosystem.config.js` — declarative config, easy to add new apps
- Memory limit restart (`max_memory_restart`)
- Health check via `pm2 monit` / `pm2 status`
- No root required, single `npm install -g pm2`

**Cons:**
- Another global dependency to manage
- Its own log system overlaps with ours (minor — can disable)
- No container isolation

### 2. systemd

**Pros:**
- Already on the system, no install needed
- Battle-tested, production-grade
- `Restart=always` with configurable backoff
- `MemoryMax=` for memory limits
- Integrates with journald for centralized logs
- Boot-time auto-start

**Cons:**
- Requires root to create/modify unit files
- More verbose config per app (one `.service` file each)
- Harder to iterate quickly during development
- journald log format differs from our structured JSON logs

### 3. Docker / Docker Compose

**Pros:**
- Full isolation per app
- `restart: always`, health checks, memory limits built in
- Reproducible environments
- `docker-compose.yml` — declarative, easy to add apps

**Cons:**
- Heavy — images, volumes, networking overhead
- Overkill for our current setup (few Node apps on one box)
- Adds Docker dependency and complexity
- Debugging is harder (exec into containers)
- DB file (SQLite) needs volume mounts, potential lock issues

### 4. Custom wrapper script (bash while-loop)

**Pros:**
- Zero dependencies

**Cons:**
- No memory limits, no health checks, fragile, doesn't scale

## Recommendation: **PM2**

**Why:**
- Fastest path to reliable auto-restart with minimal setup
- `ecosystem.config.js` makes adding new apps trivial (one entry per app)
- Memory limits via `max_memory_restart` catch the exact problem we have
- Works seamlessly with our shared logger (disable PM2's own log management)
- Health checks and monitoring built in (`pm2 monit`)
- Can add systemd integration later (`pm2 startup`) for boot persistence
- No root required for basic operation

**Proposed ecosystem.config.js:**
```js
module.exports = {
  apps: [
    {
      name: 'mission-control',
      script: './app/server.js',
      cwd: '/root/.openclaw/workspace/mission-control',
      max_memory_restart: '256M',
      restart_delay: 3000,
      max_restarts: 10,
      // Let our shared logger handle output
      merge_logs: true,
    },
    // Future apps go here — same pattern
  ],
};
```

**Setup steps (once approved):**
1. `npm install -g pm2`
2. Create `ecosystem.config.js` in mission-control root
3. `pm2 start ecosystem.config.js`
4. `pm2 startup` — persist across reboots
5. `pm2 save`

**Log integration:** PM2 captures stdout/stderr automatically. Our shared logger writes structured JSON to files. Both work in parallel — PM2 for quick `pm2 logs`, our logger for structured analysis.
