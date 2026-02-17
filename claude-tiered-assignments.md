# Amtecco — Claude Model Assignments (Tiered Approach)

## Decision: Ollama failed for production use — inconsistent tool calling, timeout issues, unreliable subagent spawning.

## Tiered Model Strategy

### 🌐 Premium Tier — Claude Opus 4.6 (5 agents)
**Use:** Strategic decisions, complex reasoning, cross-department coordination
**Agents:**
- Sylvia (COO)
- Nadia (VP Research) 
- Max (VP Marketing)
- Elena (VP Sales)
- Viktor (VP Engineering)

### ⚡ Worker Tier — Claude Sonnet 4.5 (31 agents)  
**Use:** Execution, routine tasks, specialized work
**Agents: (organized by department)**

**Engineering (13 agents):**
- SRT Developer, CDN Developer
- SRT Tester, CDN Tester
- DevOps
- Technical Writer  
- SRT Reviewer, CDN Reviewer
- SRT Planner, CDN Planner
- SRT Verifier, CDN Verifier

**Research & Intelligence (5 agents):**
- Competitive Analyst
- Market Researcher  
- Industry Analyst
- Tech Scout
- C-Level Tracker

**Marketing & Content (7 agents):**
- SEO Strategist
- Content Writer
- Brand & Positioning
- PPC/Google Ads
- Social & Community
- Email & Nurture

**Sales & Business Dev (3 agents):**
- Lead Qualifier
- Partnership Manager
- Account Manager

**Mission Control (2 agents):**
- KPI Tracker
- Report Generator

**Shared Ops (1 agent):**
- Dashboard Aggregator

## Implementation
VPs configured as persistent agents with Opus model. Workers spawned as subagents with:
```bash
sessions_spawn(agentId=viktor, model=claude-sonnet-4.5, task="Describe something")
```

## Memory
Subagent spawning tested successfully with both models via standard OpenClaw session spawning.
