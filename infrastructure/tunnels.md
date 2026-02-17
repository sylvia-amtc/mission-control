# Cloudflare Tunnels — Amtecco

**Tunnel:** `sylvia` (ID: `a1f1feea-3309-4283-8aac-a68320152a4d`)
**Config:** `/root/.cloudflared/config.yml`

## Active Services

| Subdomain | Port | Service | Access Policy | Allowed Users |
|---|---|---|---|---|
| `sylvia.amtc.tv` | 18789 | OpenClaw Gateway | None (internal) | — |
| `mc.amtc.tv` | 3000 | Mission Control Dashboard | Email auth | david@amtecco.com, sylvia@amtc.tv |
| `antfarm.amtc.tv` | 3333 | AntFarm Dashboard | Email auth | david@amtecco.com, sylvia@amtc.tv, viktor@amtc.tv |
| `crm.amtc.tv` | 3001 | Twenty CRM | Email auth | david@amtecco.com, sylvia@amtc.tv, elena@amtc.tv |

## Cloudflare API
- **Token:** stored in TOOLS.md
- **Zone ID (amtc.tv):** `83be070980b95c0e98322ef644c377bb`
- **Account ID:** `94571f9b5b4589310308d4bdfdfbc06f`

## Notes
- All services behind Cloudflare Access require email OTP login
- Catch-all rule returns 404
- Tunnel restart: `pkill cloudflared; sleep 1; nohup cloudflared tunnel run sylvia > /var/log/cloudflared.log 2>&1 &`

| `amtc.tv` | 3100 | Landing Page | Public (no auth) | — |
| `www.amtc.tv` | 3100 | Landing Page (www) | Public (no auth) | — |

*Last updated: 2026-02-17 01:45 UTC*
