# Amtecco Organization Structure
**Last Updated:** 2026-02-16
**Owner:** Sylvia (COO)

---

## Org Chart

```
David (CEO)
  └── Sylvia (COO)
        ├── Nadia (VP Research & Intelligence)
        │     └── 5 agents (Competitive Analyst, Market Researcher, Signal Tracker, Intel Synthesizer, Report Writer)
        ├── Max (VP Marketing & Content)
        │     └── 6 agents (SEO Specialist, Content Strategist, Content Writer, PPC Manager, Analytics Specialist, Social Media Manager)
        ├── Elena (VP Sales & Business Development)
        │     └── 5 agents (Lead Qualifier, Outbound SDR, Sales Ops, Partnership BD, Customer Success)
        ├── Zara (VP Design & Brand)
        │     └── 2 agents (Lars — UI/UX Designer, Elias — Graphic Designer)
        └── Viktor (VP Engineering & Product)
              ├── 5 agents (SRT Platform Track: Planner, Developer, Verifier, Tester, Reviewer)
              ├── 5 agents (CDN Product Track: Planner, Developer, Verifier, Tester, Reviewer) [DEFERRED]
              ├── 2 agents (Shared: DevOps, Security Auditor)
              └── 2 agents (Documentation: Technical Writer, KB Manager)
```

**Total Team:** 7 humans (CEO, COO, 5 VPs) + 35 AI agents (when fully deployed)

---

## Department Breakdown

### Research & Intelligence (Nadia)
**Mission:** Competitive intelligence, market research, C-level signal tracking, actionable insights for Marketing and Sales

**Team Structure:**
- **VP:** Nadia (AI)
- **Agents (5):**
  1. **Competitive Analyst** — Monitor competitors (Haivision, Zixi, Fastly, Limelight, Akamai), pricing, features
  2. **Market Researcher** — Industry trends, CDN/streaming market analysis
  3. **Signal Tracker** — C-level moves, funding rounds, strategic shifts
  4. **Intel Synthesizer** — Aggregate intel, identify patterns, prioritize insights
  5. **Report Writer** — Weekly competitive briefs, monthly market landscape reports

**Key Outputs:**
- Weekly competitive briefs (to Sylvia)
- Actionable intel items (to Marketing & Sales, ≥5/week)
- C-level signal reports (to Sylvia, 1/week)
- Monthly market landscape reports
- Ad-hoc intel responses (<24h turnaround)

**Status:** VP active, agents not yet deployed

---

### Marketing & Content (Max)
**Mission:** Organic traffic growth, content marketing, MQL generation, SEO/PPC execution

**Team Structure:**
- **VP:** Max (AI)
- **Agents (6):**
  1. **SEO Specialist** — Keyword research, on-page optimization, technical SEO
  2. **Content Strategist** — Content calendar, topic ideation, editorial planning
  3. **Content Writer** — Blog posts, case studies, landing pages, whitepapers
  4. **PPC Manager** — Google Ads, paid campaigns ($100/mo budget to start)
  5. **Analytics Specialist** — GA4, traffic analysis, conversion tracking
  6. **Social Media Manager** — LinkedIn, Twitter/X, community engagement

**Key Outputs:**
- 4 high-quality content pieces/month (blog posts, case studies, guides)
- Organic traffic growth (+15% MoM target)
- ≥10 MQLs/month
- SEO keyword rankings (top 20 tracked keywords)
- PPC ROI tracking and optimization

**Status:** VP active, agents not yet deployed

---

### Sales & Business Development (Elena)
**Mission:** Convert MQLs to SQLs, close deals, expand into SRT customer base, build partnerships

**Team Structure:**
- **VP:** Elena (AI)
- **Agents (5):**
  1. **Lead Qualifier** — MQL → SQL conversion (≥40% target)
  2. **Outbound SDR** — Cross-sell outreach to SRT customers
  3. **Sales Ops** — CRM/pipeline management, forecasting, reporting
  4. **Partnership BD** — Strategic partnerships (CDN providers, broadcast networks, integrators)
  5. **Customer Success** — Onboarding, retention, upsell

**Key Outputs:**
- SQL conversion rate (≥40% from MQLs)
- Weekly pipeline value tracking
- Cross-sell outreach (100% of SRT customers contacted within 30 days of CDN launch)
- Win rate (≥25% target)
- Deal cycle time tracking
- ≥1 partnership proposal per quarter

**Status:** VP active, agents not yet deployed

**Blocker:** Customer CSV not yet received (needed for cross-sell outreach)

---

### Design & Brand (Zara)
**Mission:** Own all visual identity, branded materials, website design, product UI, documentation design, presentations. Enforce Amtecco's design language across all departments.

**Design Language:** Modern Apple-like aesthetic, dark mode first.

**Team Structure:**
- **VP:** Zara (AI)
- **Agents (2):**
  1. **Lars** — UI/UX Designer: Product interfaces, dashboards, website layouts, user flows
  2. **Elias** — Graphic Designer: Marketing assets, social graphics, brand collateral, presentations

**Key Outputs:**
- Brand guide enforcement across all departments
- Website design & iteration
- Product UI/UX for SRT & CDN platforms
- Marketing asset production (social, ads, collateral)
- Presentation templates & executive decks
- Documentation styling & templates

**Brand Source of Truth:** `workspace-zara/brand/brand-guide.md`

**Policy:** All departments must route branded output through Zara for approval.

**Status:** VP active, workspace built, brand guide created. Sub-agents (Lars, Elias) configured.

---

### Engineering & Product (Viktor)
**Mission:** Build and ship products (SRT platform maintenance, CDN product development), DevOps, security, documentation

**Team Structure:**
- **VP:** Viktor (AI)
- **SRT Platform Track (5 agents):**
  1. **Planner** — Requirements, sprint planning, task breakdown
  2. **Developer** — Implementation
  3. **Verifier** — Code review, acceptance criteria validation
  4. **Tester** — QA, test automation, regression testing
  5. **Reviewer** — Final review, merge approval
- **CDN Product Track (5 agents) [DEFERRED]:**
  6. **Planner** — Requirements, sprint planning, task breakdown
  7. **Developer** — Implementation
  8. **Verifier** — Code review, acceptance criteria validation
  9. **Tester** — QA, test automation, regression testing
  10. **Reviewer** — Final review, merge approval
- **Shared Resources (2 agents):**
  11. **DevOps** — Infrastructure, CI/CD, deployment, monitoring, Cloudflare config
  12. **Security Auditor** — Security reviews, vulnerability assessment, compliance
- **Documentation Team (2 agents):**
  13. **Technical Writer** — User guides, API docs, developer docs, runbooks
  14. **KB Manager** — Customer support KB, internal knowledge base

**Key Outputs:**
- SRT platform assessment (framework complete, awaiting data)
- SRT platform uptime (≥99.5% target)
- Sprint completion rate (≥80% target)
- Security review coverage (100% pre-release)
- Documentation currency (within 1 sprint of code changes)
- CDN architecture proposal (deferred by CEO, 2-week target when approved)

**Status:** VP active, planning complete (SRT assessment framework, AntFarm deployment plan, infrastructure docs, docs team scope). Agents not yet deployed.

**Blocker:** Infrastructure access not granted (needed to complete SRT platform assessment)

---

### Mission Control (Sylvia)
**Mission:** COO operational dashboard, org-wide coordination, CEO reporting, strategic oversight

**Team Structure:**
- **COO:** Sylvia (AI)
- **Agents (3) [NOT YET DEFINED]:**
  - Potential: Ops Coordinator, Strategic Analyst, Reporting Specialist
  - To be defined based on Sylvia's needs

**Key Outputs:**
- Mission Control dashboard (org status, KPI tracking, blockers)
- Weekly ops report (to all VPs)
- Weekly executive summary (to CEO)
- Cross-functional coordination
- Strategic prioritization

**Status:** COO active, Mission Control dashboard operational

---

## Reporting Lines

### Direct Reports to CEO (David)
- Sylvia (COO)

### Direct Reports to COO (Sylvia)
- Nadia (VP Research & Intelligence)
- Max (VP Marketing & Content)
- Elena (VP Sales & Business Development)
- Zara (VP Design & Brand)
- Viktor (VP Engineering & Product)

### Shared Resources
- **Documentation Team (Technical Writer, KB Manager):** Report through Viktor, serve all departments
- **DevOps:** Reports through Viktor, serves all infrastructure needs
- **Security Auditor:** Reports through Viktor, reviews all products

---

## Agent Deployment Status

| Department | VP | Agents Planned | Agents Deployed | Status |
|---|---|---|---|---|
| R&I | Nadia | 5 | 0 | ⏳ Awaiting approval |
| Marketing | Max | 6 | 0 | ⏳ Awaiting approval |
| Sales | Elena | 5 | 0 | ⏳ Awaiting approval |
| Design & Brand | Zara | 2 | 0 | ✅ VP active, brand guide created |
| Engineering | Viktor | 12 | 0 | ⏳ Awaiting approval |
| Documentation | (via Viktor) | 2 | 0 | ⏳ Awaiting approval |
| Mission Control | Sylvia | 3 | 0 | ⏳ Not yet defined |
| **TOTAL** | **7** | **35** | **0** | **⏳ Planning complete** |

**Next Step:** Approve sub-agent deployment and begin rollout.

---

## Cross-Functional Workflows

### Lead Generation Pipeline (R&I → Marketing → Sales)
1. **R&I:** Competitive intel, market insights → actionable items
2. **Marketing:** Intel informs content strategy, SEO, PPC → MQLs generated
3. **Sales:** MQLs qualified → SQLs → closed deals

**Status:** Workflow designed, not yet operational (agents not deployed)

### Product Development (Marketing/Sales → Engineering)
1. **Marketing/Sales:** Customer feedback, market needs → requirements
2. **Engineering:** Product roadmap, architecture, development → shipped features

**Status:** SRT platform in maintenance mode. CDN product deferred.

### Customer Success (Sales → Engineering → Sales)
1. **Sales:** Customer onboarded
2. **Engineering:** Technical support, feature requests, bug fixes
3. **Sales:** Retention, upsell, expansion

**Status:** Not yet active (customers exist but workflows not formalized)

---

## Communication Channels

### Department VPs → COO (Sylvia)
- Weekly KPI updates (Thursdays EOD)
- Immediate blocker escalation (via `blockers.md`)
- Weekly department reports

### COO (Sylvia) → CEO (David)
- Weekly executive summary (Mondays)
- Critical issue escalation (immediate)
- Strategic decisions (as needed)

### Cross-Department Collaboration
- R&I intel to Marketing & Sales (weekly actionable items)
- Marketing MQLs to Sales (continuous handoff)
- Sales requirements to Engineering (as needed)
- Engineering docs to all departments (continuous updates)

---

## Decision Authority

### CEO (David)
- Strategic direction
- Budget and spend approval
- Product roadmap decisions (e.g., CDN timeline)
- Hiring and org structure changes

### COO (Sylvia)
- Operational priorities
- Cross-functional coordination
- Resource allocation (within budget)
- Process and workflow design
- Sub-agent deployment approval

### VPs (Nadia, Max, Elena, Zara, Viktor)
- Department execution
- Tactical decisions within scope
- Sub-agent task assignment
- Escalation to COO for blockers and strategic questions

---

**Notes:**
- All infrastructure runs through Cloudflare (DNS: sylvia.amtc.tv, Tunnels for access)
- Engineering uses AntFarm for dev team orchestration
- Documentation team serves all departments but reports through Viktor
- Mission Control (this system) owned by Sylvia, visible to all

**Last Updated:** 2026-02-16 by Viktor (built Mission Control)
