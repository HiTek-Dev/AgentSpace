# Tek v0.3 Research Package

**Milestone:** v0.3 Desktop UX & Configuration
**Research Date:** 2026-02-22
**Overall Confidence:** MEDIUM-HIGH

## Quick Navigation

### For Project Managers / Roadmap Planners
**Start here:** [`SUMMARY_v03.md`](./SUMMARY_v03.md)
- Executive summary of all findings
- Phase structure recommendations
- Key dependencies and gaps
- Confidence assessment

### For Product Designers / UX Engineers
**Start here:** [`WORKFLOWS_v03.md`](./WORKFLOWS_v03.md)
- 9 detailed user workflows (onboarding, setup, monitoring, etc.)
- Step-by-step interaction flows
- UX patterns from 2026 research
- Expected user behavior by persona

### For Feature Planning / REQUIREMENTS.md
**Start here:** [`FEATURES_v03.md`](./FEATURES_v03.md)
- Table stakes (must-have features)
- Differentiators (competitive advantages)
- Anti-features (what NOT to build)
- Feature dependencies & prioritization
- Competitor analysis
- MVP definition

### For Backend / Desktop Engineers
**Start here:** [`IMPLEMENTATION_NOTES_v03.md`](./IMPLEMENTATION_NOTES_v03.md)
- Complexity estimates (LOW/MEDIUM/HIGH)
- Critical blockers
- Dependency graph
- Phase-by-phase breakdown
- Backend infrastructure changes
- Desktop component specs
- Testing strategy
- Risk mitigation
- Success criteria

---

## Key Findings Summary

### What Users Expect in 2026 AI Agent Desktop Apps

1. **Goal-first onboarding with escalating autonomy**
   - Start simple, increase complexity as users build confidence
   - Clear security boundaries (Full Control vs Limited Control)
   - Tek already has this philosophy — just needs UI

2. **Transparent, real-time visibility into operations**
   - See what tools are running, in hierarchical tree view
   - Inspect tool parameters before execution (approval gate)
   - Live logs, status indicators, timing information
   - This is Tek's core differentiator vs OpenClaw

3. **Multi-provider resilience as standard**
   - Model aliases, fallback chains, local alternatives (Ollama)
   - Show which model actually ran and why
   - Context preservation across model switches (MCP standard)
   - LiteLLM patterns now industry norm

### v0.3 Feature Categories (by dependency order)

| Category | Features | Complexity | Effort | Blocker? |
|----------|----------|------------|--------|----------|
| **Onboarding & Setup** | First-run detection, security mode, provider setup, Telegram | MEDIUM | 2-3 wks | No |
| **Configuration Management** | Providers CRUD, Telegram settings, agent config | MEDIUM | 2-3 wks | No |
| **Async Monitoring** | Task tree, live logs, tool inspection | HIGH | 3-4 wks | **YES: WebSocket events** |
| **Model Management** | Model selector, context carry-over, fallback chains | MEDIUM | 2 wks | No |
| **Polish & Export** | Approval modal, context dumps, error handling | MEDIUM | 2 wks | No (v0.3.1) |

### Critical Blockers to Resolve First

1. **WebSocket tool event stream** (gateway modification)
   - Must emit tool execution events in real-time
   - Required for async monitoring, approvals, logs
   - Effort: 2-3 days
   - Risk: MEDIUM (touches core infrastructure)

2. **Gateway status endpoint** (new endpoint)
   - `/api/gateway/status` for health monitoring
   - Required for gateway overview page
   - Effort: 1 day
   - Risk: LOW

3. **First-run flag** (config file)
   - Detect first app launch
   - Trigger onboarding modal
   - Effort: 0.5 days
   - Risk: LOW

### Phasing Recommendation

**Phase 1 (v0.3.0 MVP)** — 4-5 weeks
- Implement blockers (WebSocket, status endpoint, first-run flag)
- Onboarding flow + provider setup
- Telegram config UI
- Async tool monitoring (real-time tree + logs)
- Gateway overview
- Agent config UI
- Model switching + context carry-over

**Phase 2 (v0.3.1 Polish)** — 2 weeks
- Real-time approval modal (param inspection + editing)
- Sub-provider fallback UI
- Database context dumps/export
- Better error handling + retry UX
- Subprocess monitoring (if time permits)

**Phase 3+ (v1.0+)** — Defer
- Agent personality training (ML-heavy)
- Multi-workspace / team permissions
- Workflow builder in UI (vs code-first)

### Why This Order

1. **Onboarding first** — Blocking issue. Desktop app launch depends on it.
2. **Provider setup** — Unblocks users from CLI-only workflows.
3. **Async monitoring** — Transparency differentiator. Validates core execution.
4. **Model switching** — Completes provider feature set.
5. **Approvals (v0.3.1)** — Killer feature but validate async first.

---

## Feature Analysis at a Glance

### Table Stakes (Non-Negotiable)
- ✓ First-run onboarding
- ✓ Provider setup UI (add API keys)
- ✓ Telegram configuration
- ✓ Async tool monitoring (what's running?)
- ✓ Agent configuration (model, personality)
- ✓ Model switching

### Differentiators (Set Tek Apart)
- ✓ Transparent approval gates (see params, modify, approve/deny)
- ✓ Hierarchical task tree (not flat logs)
- ✓ Real-time subprocess monitoring
- ✓ Database context dumps (inspect what gets sent)
- ✓ Sub-provider fallback visibility (show why model changed)

### Anti-Features (Don't Build)
- ✗ "Real-time everything" (kills performance)
- ✗ Drag-drop workflow builder (out of scope)
- ✗ Multi-user permissions (v1.0+)
- ✗ Auto-approve trusted tools (breaks transparency)
- ✗ Multiple export formats (JSON only)

---

## Workflows at a Glance

### Workflow 1: Onboarding (2-3 minutes)
App launch → First-run detected → Security mode choice → API key setup → Optional Telegram → Start chatting

### Workflow 2: Adding a Provider (1 minute)
Settings → Providers → Add → Select provider → Enter key → Verify → Save → Available immediately

### Workflow 3: Async Tool Execution (5-60 seconds)
Send message → Agent runs tools → Real-time tree in sidebar → See tool params → Approve if needed → Results stream back

### Workflow 4: Model Switching (< 1 second)
Click model selector → Choose model → Carry-over context or drop → Next message uses new model

### Workflow 5: Telegram Setup (2-3 minutes)
Settings → Shared Services → Telegram → Paste token → Verify → Add allowlist → Save

### Workflow 6: Agent Config (5-10 minutes)
Agents → [Agent] → Settings → Edit personality → Select model → Save → Config persists

### Workflow 7: Approval Gate (5-30 seconds)
Tool call requires approval → Modal appears → User sees params → Can edit params → Approve/Skip/Deny → Result recorded

### Workflow 8: Context Dump (10-30 seconds)
Settings → Advanced → Export conversation → Choose format (JSON/markdown) → Preview → Save locally

### Workflow 9: Gateway Overview (1-2 minutes)
Sidebar → Gateway → See status → View live logs → Can restart if needed

---

## Implementation Requirements

### Backend (Gateway) Changes
1. **WebSocket tool events** — New message type, emit on tool start/end/error
2. **Status endpoint** — GET /api/gateway/status (uptime, connections, health)
3. **Config persistence** — Store Telegram token, Ollama endpoint, etc.
4. **Agent config storage** — Per-agent model, soul file, knowledge base

### Desktop (Tauri) Changes
1. **Onboarding modal** — Flow + form validation
2. **Provider setup form** — Add/edit providers, validate keys
3. **Async monitoring panel** — Right sidebar tree view, WebSocket listener
4. **Gateway overview page** — Status + logs + restart button
5. **Agent config panel** — Soul editor, model selector
6. **Model selector** — Chat header dropdown
7. **Approval modal** — Tool call inspection + param editing (v0.3.1)

### Testing Required
- Unit: Config parsing, validation, provider API calls
- Component: Form state, tree rendering, WebSocket updates
- Integration: Onboarding → chat, provider setup → model selector
- E2E: Full user workflows (onboarding to monitoring)
- Load: 1000+ tasks in tree, 100+ events/sec, 10K+ log lines

### Risk Mitigation
- Event debouncing (avoid overwhelming network)
- Tree depth limiting (prevent deep recursion)
- Log truncation (keep memory reasonable)
- Token encryption (never plaintext)
- Config backup (prevent file corruption)
- User testing (validate UX decisions)

---

## Confidence Levels by Area

| Area | Confidence | Why | Gap |
|------|------------|-----|-----|
| Onboarding patterns | HIGH | UserGuiding, LogRocket, Smashing Magazine all align | None — well-documented pattern |
| Provider setup UX | HIGH | Google Cloud, OneUpTime, API Stronghold confirm best practices | None — industry standard |
| Telegram integration | MEDIUM-HIGH | Home Assistant, OpenClaw docs confirm | Specific desktop UX less documented |
| Async monitoring | MEDIUM-HIGH | LogRocket + Braintrust confirm | Hierarchical tree less common |
| Model switching/context | MEDIUM | MCP protocol standard, Claude Desktop example | User workflow needs validation |
| Approval modal UX | MEDIUM | Microsoft AG-UI pattern exists | Real-time + param editing less documented |
| Sub-provider UI | MEDIUM | LiteLLM confirms routing patterns | Visual fallback chains less common |
| Context dumps UI | MEDIUM | Technical docs abundant | UI/UX patterns barely documented |

---

## Next Steps

### For Roadmap Planning
1. Review [`SUMMARY_v03.md`](./SUMMARY_v03.md) for phase recommendations
2. Check [`IMPLEMENTATION_NOTES_v03.md`](./IMPLEMENTATION_NOTES_v03.md) for effort estimates
3. Decide: Implement blockers in parallel or sequence?
4. Validate phase durations with engineering team

### For UX/Product Design
1. Review [`WORKFLOWS_v03.md`](./WORKFLOWS_v03.md) for user journeys
2. Design mockups for:
   - Onboarding flow (5 screens)
   - Provider setup form
   - Async monitoring tree
   - Approval modal
3. User test with 5-10 people (especially approval modal)

### For Engineering
1. Review [`IMPLEMENTATION_NOTES_v03.md`](./IMPLEMENTATION_NOTES_v03.md) for architecture
2. Prioritize blocker work (WebSocket, status endpoint, first-run flag)
3. Set up component/integration test structure
4. Validate design for WebSocket stability under load

### For Feature Planning (REQUIREMENTS.md)
1. Use [`FEATURES_v03.md`](./FEATURES_v03.md) as reference
2. Move table stakes to MUST (v0.3.0)
3. Move differentiators to SHOULD (v0.3.0) or NICE (v0.3.1)
4. Mark anti-features as explicitly out of scope

---

## Research Validation Notes

### High-Confidence Findings (Can proceed with)
- First-run onboarding pattern (goal-first, escalating autonomy)
- Provider setup best practices (secure storage, validation, aliases)
- Async monitoring patterns (task trees, live logs, drill-down on demand)
- Multi-provider fallback strategies (LiteLLM, OpenRouter standards)

### Medium-Confidence Findings (Needs user testing)
- Real-time approval modal UX (param editing flow, decision workflow)
- Hierarchical task tree visualization (depth, complexity, performance)
- Sub-provider fallback UI (do users want to see why model changed?)
- Context carry-over toggle (do users expect this or want it automatic?)

### Low-Confidence Findings (Needs deeper research in phase)
- Database context dump UI/UX (format, preview, size handling)
- Telegram allowlist workflow (user ID lookup, deny list priority)
- Agent personality training UX (document upload, indexing feedback)

### Validation Strategy During v0.3 Execution
1. **After onboarding is done:** User test with 5 new users
2. **After approval modal is done:** User test with power users
3. **After async monitoring is done:** Validate performance under load
4. **Mid-phase:** Iterate on low-confidence areas based on feedback

---

## Document Structure

```
.planning/research/
├─ README_v03.md (this file)
│  └─ Navigation, quick findings, next steps
├─ SUMMARY_v03.md
│  └─ Executive summary, roadmap implications, confidence
├─ FEATURES_v03.md
│  └─ Feature landscape, dependencies, MVP, prioritization
├─ WORKFLOWS_v03.md
│  └─ User workflows, interaction flows, 2026 patterns
└─ IMPLEMENTATION_NOTES_v03.md
   └─ Complexity, blockers, backend/frontend specs, testing
```

---

**Research Type:** v0.3 Features for Desktop UX & Configuration
**Researcher:** Claude Agent (Phase 6 Research)
**Date:** 2026-02-22
**Status:** COMPLETE — Ready for REQUIREMENTS.md planning

### How to Use This Research

1. **For Roadmap:** Reference SUMMARY_v03.md phase structure
2. **For UX Design:** Use WORKFLOWS_v03.md as interaction specification
3. **For REQUIREMENTS.md:** Copy relevant features from FEATURES_v03.md
4. **For Technical Planning:** Use IMPLEMENTATION_NOTES_v03.md for complexity/blockers
5. **For Risk Management:** Check IMPLEMENTATION_NOTES_v03.md mitigation section

### Questions This Research Answers

- ✓ What do users expect in v0.3 setup/config UX?
- ✓ What workflows are typical (8 detailed examples)?
- ✓ Which features are table stakes vs differentiators?
- ✓ What's the recommended phase structure?
- ✓ What are the critical blockers?
- ✓ How much effort does each feature require?
- ✓ What could go wrong (risks) and how to mitigate?
- ✓ How do similar tools (OpenClaw, Claude, LM Studio) handle these?
- ✓ What do 2026 industry standards show (MCP, LiteLLM, etc.)?

---

*This research package informs the v0.3 REQUIREMENTS.md and phase planning. See SUMMARY_v03.md for immediate next steps.*
