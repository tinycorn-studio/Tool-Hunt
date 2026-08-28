# Dispatch for Test Writer (Milestone M0)

## Mission
Build the Enterprise Test Infrastructure and comprehensive in-memory test simulator for ToolHunt Enterprise at `d:/Profile/AutoFillSheet`.

## Target Artifacts
1. `scripts/test_simulator.js`: Complete rewrite/upgrade to include:
   - GAS Runtime Emulator (`MockSpreadsheetApp`, `MockUrlFetchApp`, `MockLockService`, `MockContentService`, `MockUtilities`)
   - 6 Standard Mock Sheets (`Ideas` 17 cols, `Votes` 5 cols, `Bounties` 10 cols, `Admins` 5 cols, `Config` 3 cols, `AuditLogs` 5 cols)
   - 10 Modular Test Suites with 35+ assertions covering:
     - Suite 1: Syntax & Command Validation
     - Suite 2: Idea Creation & Telegram Card Formatting
     - Suite 3: R1 AI Duplicate Detection (Gemini & DeepSeek mocking, similarity threshold, merge vote, force create, failover)
     - Suite 4: Upvote & Anti-Fraud (Toggle Unvote, real-time counter sync)
     - Suite 5: R2 Developer Task Claiming Lifecycle (claim_task, duplicate claim rejection, beta transition, completion, unclaim)
     - Suite 6: R3 Targeted Beta Notifications (active voter extraction from Votes sheet, DM alerts with demo link, non-voter isolation)
     - Suite 7: R4 Tool Bounty & Crowdfunding (bounty pledge, multi-sponsor accumulation in VND/Coffee, badge formatting)
     - Suite 8: R5 4-Tier RBAC (Member, Developer, Manager, Admin permissions)
     - Suite 9: R5 REST API Contracts (doGet getIdeas/getUserVotes/getStats/getBounties, doPost submitIdea/voteIdea/claimIdea/pledgeBounty)
     - Suite 10: R5 Dual-Platform Sync & Concurrency (Web upvote -> TG buttons, TG claim -> Web API)
   - Proper `process.exitCode` handling (`exitCode = failed > 0 ? 1 : 0`).
2. `TEST_INFRA.md` at project root documenting test philosophy, architecture, suites, and thresholds.
3. `TEST_READY.md` at project root summarizing the ready test runner command (`npm test` / `node scripts/test_simulator.js`) and coverage table.

## Constraints
- Do NOT cheat. All mocks and simulation scenarios must be authentic.
- Read `d:/Profile/AutoFillSheet/ORIGINAL_REQUEST.md` and `d:/Profile/AutoFillSheet/PROJECT.md`.
- Read findings from `.agents/survey_explorer_3/handoff.md`.
- Execute tests using `run_command` with `node scripts/test_simulator.js` to verify test harness runs and pass/fail behaviors are clear.
- Write your completion report in `d:/Profile/AutoFillSheet/.agents/test_writer_m0/handoff.md`.
