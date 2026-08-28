# Dispatch for Implementation Worker 1

## Mission
Implement all Enterprise upgrades (R1 through R5) across backend, frontend, and documentation for ToolHunt Enterprise:
1. `google-apps-script/SetupHelper.js`: Upgrade `initSpreadsheet()` to initialize all 6 enterprise sheets (`Ideas` 17 cols, `Votes` 5 cols, `Bounties` 10 cols, `Config` 3 cols with 10 default keys, `Admins` 5 cols, `AuditLogs` 5 cols) with headers and styling.
2. `google-apps-script/Code.js`: Complete enterprise backend logic:
   - R1 AI Duplicate Detection (`checkAiDuplicate`, DeepSeek + Gemini + Heuristic fallback, `merge_vote_{id}` and `force_create_{hash}` inline keyboard buttons, `submitIdea` duplicate prevention).
   - R2 Developer Task Claiming (`claim_task_{id}`, `unclaim_task_{id}`, `devbeta_{id}`, `devdone_{id}`, `/claim` command, `claimIdea`, `unclaimIdea`, `updateProgress`).
   - R3 Targeted Beta Notifications (`notifyIdeaVoters`, distinct active voter query on `Votes` sheet, DM delivery with demo URL & feedback link, fallback group mention).
   - R4 Tool Bounty & Crowdfunding (`calculateTotalBounty`, `handlePledgeBounty`, `Bounties` sheet ledger, `Tổng Bounty` in `Ideas`, `/bounty` command, `bounty_{id}` callback, `getBounties`, `pledgeBounty`).
   - R5 Enterprise RBAC & API (`getUserRole`, `hasRole`: Member, Developer, Manager, Admin, `logAudit`, complete `doGet` and `doPost` endpoints).
3. `web-dashboard/index.html`, `web-dashboard/app.js`, `web-dashboard/styles.css`: Complete frontend upgrade:
   - Stats cards (Total Ideas, Total Votes, Active Devs, Total Bounty Pool).
   - 6 Filter tabs (All, Top Vote, Bounty, In Progress, Beta, Completed).
   - Developer cards, Milestones progress bar, Gold bounty badge, Claim Task button, Bounty contribute button.
   - AI Duplicate Warning Modal (Merge Vote & Force Create).
   - Bounty Pledge Modal (VND, Coffee ☕, Points).
   - Developer Milestones Progress Update Modal.
   - RBAC Role Switcher.
4. `README.md`, `docs/HUONG_DAN_ADMIN.md`, `docs/HUONG_DAN_CAI_DAT.md`, `docs/TELEGRAM_BOTFATHER.md`: Comprehensive enterprise documentation updates.
5. Verification: Run `node scripts/test_simulator.js` and ensure all 10 test suites (48 assertions) pass 100%.

## Input Blueprint References
- `d:/Profile/AutoFillSheet/ORIGINAL_REQUEST.md`
- `d:/Profile/AutoFillSheet/PROJECT.md`
- `d:/Profile/AutoFillSheet/TEST_READY.md`
- `d:/Profile/AutoFillSheet/.agents/impl_explorer_1/handoff.md` (Backend Blueprint)
- `d:/Profile/AutoFillSheet/.agents/impl_explorer_2/handoff.md` (Frontend Blueprint)
- `d:/Profile/AutoFillSheet/.agents/impl_explorer_3/handoff.md` (Docs & Verification Blueprint)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your completion report in `d:/Profile/AutoFillSheet/.agents/impl_worker_1/handoff.md`.
