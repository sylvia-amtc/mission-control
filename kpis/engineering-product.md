# Engineering & Product KPIs
**Department:** Engineering & Product
**VP:** Viktor
**Last Updated:** 2026-02-16

**Mission:** Build and ship products (SRT platform maintenance, CDN product development), DevOps, security, documentation

---

## KPI Summary

| KPI | Target | Current | Status | Trend | Last Update |
|---|---|---|---|---|---|
| Sprint completion rate | ≥80% | — | ⏳ Not started | — | 2026-02-16 |
| SRT platform uptime | ≥99.5% | — | ⏳ Baseline needed | — | 2026-02-16 |
| Security review coverage | 100% pre-release | — | ⏳ Not started | — | 2026-02-16 |
| Documentation currency | Within 1 sprint | — | ⏳ Not started | — | 2026-02-16 |
| CDN architecture proposal | 2 weeks (deferred) | — | 🔴 Blocked (CEO) | — | 2026-02-16 |

**Legend:**
- Status: ✅ On Track | 🟡 At Risk | 🔴 Missing Target | ⏳ Not Started
- Trend: ↗️ Improving | → Flat | ↘️ Declining | — No Data

---

## Detailed KPI Tracking

### 1. Sprint Completion Rate
**Target:** ≥80% (story points completed / story points committed)

**Purpose:** Measure team velocity and planning accuracy

**Sprint Cadence:** Bi-weekly sprints (2 weeks)

**Measurement:** (Completed Story Points) / (Committed Story Points) × 100%

**Tracked By Product Track:**
- SRT Platform Track (maintenance + improvements)
- CDN Product Track (deferred until CEO approval)

**Current State:** Not started (agents not deployed, no sprints run yet)

**Historical Data:**
| Sprint | Track | Committed SP | Completed SP | Completion Rate | Notes |
|---|---|---|---|---|---|
| Sprint 1 (TBD) | SRT Platform | — | — | — | Not started |

**Next Milestone:** First sprint after agent deployment (target: complete ≥80% of committed work)

---

### 2. SRT Platform Uptime
**Target:** ≥99.5% (measured monthly)

**Purpose:** Ensure production stability for existing customers

**Measurement:** (Total minutes - Downtime minutes) / Total minutes × 100%

**Uptime Tiers:**
- 99.9% = "three nines" = 43 minutes downtime/month
- 99.5% = 3.6 hours downtime/month (our target)
- 99.0% = 7.2 hours downtime/month

**Incident Classification:**
- **Critical:** Total outage, customer-facing
- **High:** Degraded performance, customer impact
- **Medium:** Internal service degraded, no customer impact
- **Low:** Non-production issue

**Current State:** Baseline not established (need monitoring access)

**Historical Data:**
| Month | Uptime % | Downtime (min) | Incidents | Critical Incidents | Notes |
|---|---|---|---|---|---|
| 2026-01 | — | — | — | — | Baseline needed |
| 2026-02 | — | — | — | — | Awaiting monitoring access |

**Next Milestone:** Gain monitoring access, establish baseline uptime for Jan/Feb

---

### 3. Security Review Coverage
**Target:** 100% (all releases reviewed by Security Auditor before production)

**Purpose:** Prevent security vulnerabilities in production

**Review Process:**
1. Feature development complete (Verifier approved)
2. Security Auditor reviews code, tests for vulnerabilities
3. Security Auditor approves or requests fixes
4. Only after security approval → Reviewer merges and deploys

**Review Scope:**
- Code review (SAST tools, manual review)
- Dependency scanning (vulnerable libraries)
- Infrastructure changes (Cloudflare config, server access)
- Authentication/authorization changes

**Current State:** Not started (agents not deployed)

**Historical Data:**
| Month | Releases | Security Reviews | Coverage % | Vulnerabilities Found | Critical Vulns | Notes |
|---|---|---|---|---|---|---|
| 2026-02 | 0 | 0 | — | — | — | Not started |

**Next Milestone:** First security review when first PR is ready for merge

---

### 4. Documentation Currency
**Target:** Within 1 sprint of code changes (docs updated before or during the sprint after code ships)

**Purpose:** Prevent documentation debt, ensure onboarding and support quality

**Tracked Documentation:**
- User-facing docs (API reference, user guide, troubleshooting)
- Developer docs (architecture, setup, contribution guide)
- Operations docs (runbooks, deployment procedures)

**Measurement:** Age of oldest undocumented change (in sprints)

**Definition of "Current":**
- Docs updated in same sprint as code change: ✅ Excellent
- Docs updated 1 sprint after: ✅ Acceptable (target)
- Docs updated 2+ sprints after: 🔴 Lagging (documentation debt)

**Current State:** Not started (no code changes yet)

**Historical Data:**
| Sprint | Code Changes | Docs Updated Same Sprint | Docs Updated Next Sprint | Docs >1 Sprint Behind | Notes |
|---|---|---|---|---|---|
| Sprint 1 (TBD) | — | — | — | — | Not started |

**Next Milestone:** Define "Definition of Done" (includes docs) for all stories

---

### 5. CDN Architecture Proposal
**Target:** 2 weeks (deferred by CEO)

**Purpose:** Deliver comprehensive CDN architecture design to enable product development

**Deliverables:**
- Architecture document (system design, component diagram, tech stack)
- MVP scope definition
- Timeline estimate (realistic, with assumptions)
- Resource requirements (team, infrastructure, budget)
- Risk assessment

**Current State:** 🔴 Blocked — CEO deferred CDN work to prioritize internal/corporate setup

**Status History:**
| Date | Status | Notes |
|---|---|---|
| 2026-02-16 | Blocked (CEO deferral) | Focus on internal setup first. CDN work resumes when CEO approves. |

**Next Milestone:** Await CEO approval to begin CDN architecture work

---

## Team Status

### SRT Platform Track (5 agents)
| Agent | Role | Status | Last Activity |
|---|---|---|---|
| Planner | Requirements, sprint planning | ⏳ Not deployed | — |
| Developer | Implementation | ⏳ Not deployed | — |
| Verifier | Code review, acceptance criteria | ⏳ Not deployed | — |
| Tester | QA, test automation | ⏳ Not deployed | — |
| Reviewer | Final review, merge approval | ⏳ Not deployed | — |

### CDN Product Track (5 agents) [DEFERRED]
| Agent | Role | Status | Last Activity |
|---|---|---|---|
| Planner | Requirements, sprint planning | 🔴 Deferred | — |
| Developer | Implementation | 🔴 Deferred | — |
| Verifier | Code review, acceptance criteria | 🔴 Deferred | — |
| Tester | QA, test automation | 🔴 Deferred | — |
| Reviewer | Final review, merge approval | 🔴 Deferred | — |

### Shared Resources (2 agents)
| Agent | Role | Status | Last Activity |
|---|---|---|---|
| DevOps | Infrastructure, CI/CD, deployment, Cloudflare | ⏳ Not deployed | — |
| Security Auditor | Security reviews, vulnerability assessment | ⏳ Not deployed | — |

### Documentation Team (2 agents)
| Agent | Role | Status | Last Activity |
|---|---|---|---|
| Technical Writer | User guides, API docs, developer docs | ⏳ Not deployed | — |
| KB Manager | Customer support KB, internal KB | ⏳ Not deployed | — |

**Total:** 0/14 agents deployed (12 eng + 2 docs)

---

## Blockers & Risks

### Active Blockers
1. **Sub-agent deployment not approved** (B003)
   - Impact: Cannot begin engineering work until agents deployed
   - Owner: Sylvia (approval)
   - ETA: TBD

2. **Infrastructure access not granted** (B002)
   - Impact: Cannot complete SRT platform assessment with real data. Cannot establish uptime baseline.
   - Owner: Sylvia to grant access
   - ETA: TBD

3. **CDN timeline unclear** (B005)
   - Impact: Product roadmap uncertainty. CDN team deployment deferred.
   - Owner: David (CEO decision)
   - ETA: After internal setup complete

### Risks
1. **AntFarm dev team performance unknown** (R001)
   - Risk: AI dev agents may produce low-quality code, require heavy intervention
   - Mitigation: Pilot approach (start with non-critical tasks), validate workflows, iterate
   - Owner: Viktor

2. **Cloudflare dependency** (R002)
   - Risk: Cloudflare outage blocks all infrastructure access
   - Mitigation: Disaster recovery plan (documented in infrastructure-cloudflare.md), fallback DNS
   - Owner: Viktor (DevOps agent when deployed)

3. **Documentation lag** (R004)
   - Risk: Docs fall behind code changes
   - Mitigation: Docs as part of Definition of Done, Technical Writer reviews all PRs
   - Owner: Viktor (Documentation team)

---

## Priorities (Next 2 Weeks)

### Immediate (Pending Infrastructure Access)
1. **Gain production infrastructure access** (monitoring, codebase, Cloudflare)
2. **Complete SRT platform assessment** (with real data, metrics, technical debt inventory)
3. **Establish uptime baseline** (Jan/Feb uptime data from monitoring)

### Short-Term (Pending Agent Deployment Approval)
1. **Deploy SRT platform team** (5 agents via AntFarm)
2. **Deploy shared resources** (DevOps, Security Auditor)
3. **Deploy documentation team** (Technical Writer, KB Manager)
4. **Run first maintenance sprint** (SRT platform: small fixes, tech debt)
5. **Validate AntFarm workflows** (feature-dev, bug-fix, security-audit)

### Long-Term (Deferred)
1. **CDN architecture proposal** (2 weeks after CEO approval)
2. **Deploy CDN product team** (5 agents, when CDN work approved)
3. **Begin CDN MVP development** (timeline TBD based on architecture)

---

## Cross-Functional Dependencies

### From Sales (Elena)
- **Customer feedback** → Product requirements, feature requests
- **Bug reports** → Prioritization and fixes

### From Marketing (Max)
- **Product updates** → Release notes, feature announcements, content
- **Technical review needed** → Ensure marketing content is technically accurate

### To All Departments
- **Documentation** → User guides, API docs, runbooks (Technical Writer + KB Manager serve all)
- **Infrastructure support** → DevOps agent serves all internal infrastructure needs

---

## Engineering Planning Status

### Completed
- ✅ SRT platform assessment framework (`product/srt-platform-assessment.md`)
- ✅ Cloudflare infrastructure documentation (`engineering/infrastructure-cloudflare.md`)
- ✅ AntFarm deployment plan (`engineering/antfarm-deployment-plan.md`)
- ✅ Documentation team scope (`engineering/docs-team-scope.md`)

### In Progress
- ⏳ SRT platform assessment (awaiting infrastructure access to complete with real data)
- ⏳ AntFarm installation and validation (awaiting approval)

### Blocked
- 🔴 CDN architecture proposal (deferred by CEO)

---

## Notes

- **Infrastructure constraint:** All services run through Cloudflare (DNS: sylvia.amtc.tv, Tunnels for access). Every dev agent must understand this.
- **AntFarm workflow orchestration:** Dev teams managed via AntFarm (github.com/snarktank/antfarm). Fresh context per step, retry logic, escalation to Viktor on failure.
- **Security-first:** 100% security review coverage before production. Non-negotiable.
- **Documentation as first-class citizen:** Docs updated within 1 sprint of code changes. Part of Definition of Done.

---

**For Viktor (VP Engineering):**
- Update this file weekly (Thursdays EOD)
- Add sprint data, uptime metrics, security reviews as they occur
- Flag blockers in `blockers.md` immediately

**For Sylvia (COO):**
- Review this file weekly (Fridays)
- Monitor uptime (SRT platform stability = customer trust)
- Track engineering velocity (sprint completion rate)
- Approve infrastructure budget when needed (scaling, tools, etc.)
