# Dispatch for Survey Explorer 2

## Task
Perform a detailed requirements and specification extraction from `d:/Profile/AutoFillSheet/ORIGINAL_REQUEST.md` and related docs in the project root.
Map out exact requirements for:
1. R1: AI Duplicate Detection (DeepSeek & Gemini APIs, prompt engineering, similarity scoring threshold, user interaction workflow: duplicate warning / merge vote / proceed anyway buttons)
2. R2: Developer Task Claiming & Workflow Lifecycle (Claim Task button, state transitions: Open -> In Progress -> Beta Testing -> Completed / Unclaim, UI status badges, Google Sheets status/milestones updates, permissions)
3. R3: Targeted Beta Tester Notifications (Extract voter user IDs from Sheet/cache, send personalized direct messages / mentions when idea moves to Beta Testing or Completed, test links & feedback forms)
4. R4: Tool Bounty & Crowdfunding Mechanism (Bounty setting / crowdfunding contributions, badge & total value display, Bounties sheet log, payment/pledge recording)
5. R5: Enterprise Architecture & Dual-Platform Sync (Sheets schema upgrade, RBAC: Member / Developer / Manager / Admin, Web Dashboard & Telegram Mini App real-time/periodic sync, Unit Tests, Git sync)

Write your structured requirement inventory, constraints, and dependencies to `d:/Profile/AutoFillSheet/.agents/survey_explorer_2/handoff.md`.
