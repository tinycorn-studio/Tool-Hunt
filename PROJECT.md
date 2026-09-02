# Project: ToolHunt Enterprise Audit

## Architecture & Scope
ToolHunt is an enterprise-grade Telegram Mini App and Bot running on Google Apps Script (GAS) with Google Sheets backend and AI integration (Gemini/Groq/OpenAI).
This project executes an exhaustive technical audit across 4 core domains:
1. **Security & Authentication (R1)**: Secrets management, Webhook signature verification, WebApp initData HMAC-SHA256 validation, XSS/HTML injection sanitization.
2. **Concurrency & Platform Limits (R2)**: Burst traffic resilience, LockService contention & timeout handling, O(N) Sheet queries vs pagination/indexing, GAS 6-min execution limit, and UrlFetchApp quota consumption.
3. **Business Logic, FSM & Test Coverage (R3)**: Task/Bounty Lifecycle FSM (Claim/Beta/Complete/Unclaim), AI duplicate detection failover/heuristics, Vote fraud/Sybil protection, Multi-currency Bounty escrow/disbursement calculations, Test suite verification baseline (`scripts/test_simulator.js`, `scripts/test_adversarial_challenger.js`, `scripts/test_adversarial_challenger2.js`).
4. **Production Readiness & Documentation (R4)**: RBAC 4 tiers (SuperAdmin, Admin, Hunter, Viewer), CORS/redirect behavior in GAS WebApp, appsscript.json manifest synchronization, Documentation vs Code accuracy.

## Feature Inventory
| # | Feature / Area | Scope Description | Milestone | Source | Status |
|---|----------------|-------------------|-----------|--------|--------|
| 1 | Secrets & Auth Security | Bot Token, AI keys, Webhook signature, WebApp HMAC-SHA256, XSS | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 2 | Concurrency & Platform Limits | LockService, burst traffic, Sheet row scaling, GAS 6-min, UrlFetchApp | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 3 | Business Logic & FSM | Lifecycle state transitions, AI deduplication failover, voting, escrow | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 4 | Production Readiness & Docs | RBAC, GAS CORS/redirects, manifest sync, doc parity, test baseline | M4 | ORIGINAL_REQUEST §R4 | DONE |
| 5 | Authoritative Audit Synthesis | Compile comprehensive AUDIT_REPORT.md with code evidence & remediations | M5 | ORIGINAL_REQUEST §Deliverables | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Security & Auth Audit | Investigate R1 security vectors, token safety, HMAC, XSS | none | DONE |
| M2 | Concurrency & Limits Audit | Investigate R2 LockService, burst, GAS platform limits | none | DONE |
| M3 | Business Logic & Test Suite | Investigate R3/R4 logic, run 3 test suites, check RBAC & docs | none | DONE |
| M4 | Report Authoring | Synthesize findings into structured AUDIT_REPORT.md at project root | M1, M2, M3 | DONE |
| M5 | Review, Challenge & Audit Gate | 2 Reviewers (APPROVE), 2 Challengers (APPROVE), 1 Forensic Auditor (CLEAN) | M4 | DONE |

## Code Layout
- `src/` (or GAS files): Core backend logic, Telegram handlers, WebApp API, AI integrations.
- `scripts/`: Test simulator and adversarial challenger test suites.
- `AUDIT_REPORT.md`: Comprehensive enterprise audit report (1,058 lines, 7 exhaustive sections).
