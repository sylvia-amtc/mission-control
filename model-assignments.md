# Amtecco — Ollama Cloud Model Assignments (v2)

## CRITICAL CONSTRAINT
Only models with confirmed tools tag on Ollama Cloud. All via `https://ollama.com/v1` (OpenAI-compatible).
Correct tag for DeepSeek: `deepseek-v3.1:671b-cloud` (not 671-cloud).

## Available Models
| Model | Tags | Best For |
|-------|------|----------|
| deepseek-v3.1:671b-cloud | tools, thinking | Premium reasoning, strategic decisions |
| qwen3-next:80b-cloud | tools, thinking | Workhorse — analysis, planning, writing |
| qwen3-coder-next:cloud | tools | Agentic coding, testing, technical docs |
| devstral-2:cloud | tools | Multi-file code review |
| nemotron-3-nano:cloud | tools, thinking | Efficient high-volume tasks |
| qwen3-vl:cloud | tools, thinking, vision | Visual processing + reasoning |

## Assignments

### Executive
| Agent | Model |
|-------|-------|
| Sylvia (COO) | deepseek-v3.1:671b-cloud (fallback: Claude Opus 4.6) |

### Engineering (Viktor)
| Agent | Model |
|-------|-------|
| Viktor (VP) | deepseek-v3.1:671b-cloud |
| SRT Planner | qwen3-next:80b-cloud |
| SRT Developer | qwen3-coder-next:cloud |
| SRT Verifier | qwen3-next:80b-cloud |
| SRT Tester | qwen3-coder-next:cloud |
| SRT Reviewer | devstral-2:cloud |
| CDN Planner | qwen3-next:80b-cloud |
| CDN Developer | qwen3-coder-next:cloud |
| CDN Verifier | qwen3-next:80b-cloud |
| CDN Tester | qwen3-coder-next:cloud |
| CDN Reviewer | devstral-2:cloud |
| DevOps | qwen3-coder-next:cloud |
| Security Auditor | deepseek-v3.1:671b-cloud |

### Research & Intelligence (Nadia)
| Agent | Model |
|-------|-------|
| Nadia (VP) | deepseek-v3.1:671b-cloud |
| Competitive Analyst | qwen3-next:80b-cloud |
| C-Level Tracker | qwen3-vl:cloud |
| Market Researcher | qwen3-next:80b-cloud |
| Tech Scout | deepseek-v3.1:671b-cloud |
| Industry Analyst | qwen3-next:80b-cloud |

### Marketing & Content (Max)
| Agent | Model |
|-------|-------|
| Max (VP) | deepseek-v3.1:671b-cloud |
| SEO Strategist | qwen3-next:80b-cloud |
| Content Writer | qwen3-next:80b-cloud |
| Brand & Positioning | qwen3-next:80b-cloud |
| Social & Community | nemotron-3-nano:cloud |
| Email & Nurture | nemotron-3-nano:cloud |
| PPC / Google Ads | qwen3-next:80b-cloud |

### Sales & Business Dev (Elena)
| Agent | Model |
|-------|-------|
| Elena (VP) | deepseek-v3.1:671b-cloud |
| Lead Generator | nemotron-3-nano:cloud |
| Lead Qualifier | qwen3-next:80b-cloud |
| Partnership Manager | qwen3-next:80b-cloud |
| Sales Ops | nemotron-3-nano:cloud |
| Account Manager | qwen3-next:80b-cloud |

### Documentation & KB
| Agent | Model |
|-------|-------|
| Technical Writer | qwen3-coder-next:cloud |
| KB Manager | nemotron-3-nano:cloud |

### Mission Control (Sylvia)
| Agent | Model |
|-------|-------|
| KPI Tracker | qwen3-next:80b-cloud |
| Dashboard Aggregator | nemotron-3-nano:cloud |
| Report Generator | qwen3-next:80b-cloud |

## Token Conservation Rules
1. deepseek-v3.1:671b-cloud (premium): Sylvia, VPs, Security Auditor, Tech Scout only
2. qwen3-next:80b-cloud (workhorse): 16 agents — analysis, planning, strategy, writing
3. qwen3-coder-next:cloud (coding): developers, testers, DevOps, technical docs
4. devstral-2:cloud (review): code reviewers only
5. nemotron-3-nano:cloud (efficient): high-volume — social, email, lead gen, data ops
6. qwen3-vl:cloud (vision): C-Level Tracker only
7. Only Sylvia falls back to Claude
