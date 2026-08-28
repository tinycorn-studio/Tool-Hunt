# Project: ToolHunt Enterprise (v3.0.0)

## Architecture
ToolHunt Enterprise is a dual-platform community tool discovery, crowdfunding, and task-lifecycle management system bridging Telegram Bot / Mini Apps and Google Sheets / Web Dashboard.

### Core Architecture Components
1. **Google Apps Script Backend (`google-apps-script/Code.js`)**:
   - Webhook & Telegram Event Router (`doPost`): Handles messages (`/idea`, `/top`, `/claim`, `/bounty`, `/status`, `/stats`) and inline callback queries (`vote_`, `claim_`, `unclaim_`, `devbeta_`, `devdone_`, `bounty_`, `merge_vote_`, `force_create_`).
   - REST API Router (`doGet`, `doPost`): Endpoints for Web Dashboard / Mini App (`getIdeas`, `getUserVotes`, `getStats`, `getBounties`, `getUserRole`, `checkDuplicate`, `submitIdea`, `voteIdea`, `claimIdea`, `unclaimIdea`, `updateProgress`, `pledgeBounty`).
   - AI Deduplication Engine (`checkAiDuplicate`): Gemini Flash & DeepSeek Chat API integration with prompt engineering, semantic similarity scoring, and fallback heuristics.
   - Task Lifecycle & Notification Engine (`notifyIdeaVoters`): FSM status management, active voter extraction from `Votes` sheet, personalized direct messaging with group mention fallback.
   - Bounty Ledger & Crowdfunding Engine: Multi-currency accumulation (VND, USD, Coffee ☕, Points) and `Bounties` sheet management.
   - Role-Based Access Control (RBAC): 4-tier permissions (Member, Developer, Manager, Admin).

2. **Spreadsheet Persistence Layer (`google-apps-script/SetupHelper.js`)**:
   - `Ideas` sheet (17 columns: ID, Thời Gian, User ID, Username, Tên Ý Tưởng, Mô Tả Chi Tiết, Thể Loại, Tổng Vote, Message ID, Chat ID, Trạng Thái, Ghi Chú, Developer ID, Developer Username, Claim Date, Milestones, Tổng Bounty).
   - `Votes` sheet (5 columns: Thời Gian, Idea ID, User ID, Username, Hành Động).
   - `Bounties` sheet (10 columns: Thời Gian, Bounty ID, Idea ID, Sponsor User ID, Sponsor Username, Số Lượng, Đơn Vị, Lời Nhắn, Trạng Thái, Ghi Chú).
   - `Config` sheet (3 columns: Cấu Hình, Giá Trị, Mô Tả).
   - `Admins` sheet (5 columns: User ID Telegram, Username, Vai Trò, Trạng Thái, Ngày Thêm).

3. **Web Dashboard & Telegram Mini App (`web-dashboard/`)**:
   - `index.html`, `app.js`, `styles.css`: Full enterprise UI with Developer attribution, Milestones progress bar, Bounty gold badges, AI duplicate warning modal, and filters.

4. **Testing & Simulation Harness (`scripts/test_simulator.js`)**:
   - Comprehensive GAS runtime emulator (`MockSpreadsheetApp`, `MockUrlFetchApp`, `MockLockService`, `MockContentService`, `MockUtilities`) with 10 test suites and 35+ test assertions covering 100% of scenarios offline.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | GAS Emulator & Test Harness | Full mock runtime & 10 test suites (35+ test assertions) | M0 | Survey |
| F02 | Dual-Engine AI Duplicate Detection | DeepSeek & Gemini API semantic similarity scoring with prompt template | M1 | Survey (R1) |
| F03 | AI Similarity Threshold & Warning UI | Configurable threshold (default 75%) and warning prompt on Telegram & Web | M1 | Survey (R1) |
| F04 | Duplicate Action Handlers | `merge_vote_{id}` (consolidate upvote) and `force_create` (proceed anyway) | M1 | Survey (R1) |
| F05 | Developer Claim Action | `[ 🛠 Nhận làm tool ]` callback & `/claim` command, assign Developer ID & Username | M2 | Survey (R2) |
| F06 | Task Status Lifecycle FSM | Open -> In Progress -> Beta Testing -> Completed / Unclaim transitions | M2 | Survey (R2) |
| F07 | Milestone & Progress Updates | Developer progress tracking (e.g. 50% - Core ready) and Telegram card updates | M2 | Survey (R2) |
| F08 | Active Voter Extraction Engine | Query `Votes` sheet for active distinct upvoters of an idea | M3 | Survey (R3) |
| F09 | Targeted Direct Message Dispatch | Send direct messages with demo URL and feedback link to all active voters | M3 | Survey (R3) |
| F10 | Group Mention Fallback | Fallback to group mention when direct message returns 403 / bot not started | M3 | Survey (R3) |
| F11 | Bounties Sheet Ledger Schema | Schema creation and recording of individual bounty pledges | M4 | Survey (R4) |
| F12 | Multi-Currency Crowdfunding | Support VND, USD, Coffee ☕, Points and total bounty sum calculation | M4 | Survey (R4) |
| F13 | Telegram & Web Bounty UI | Gold badge display on Telegram cards and Web Dashboard, `/bounty` command | M4 | Survey (R4) |
| F14 | Enterprise 5-Sheet Schema Setup | `SetupHelper.js` upgraded with `initSpreadsheet` for all 5 enterprise sheets | M5 | Survey (R5) |
| F15 | 4-Tier RBAC Permission Matrix | Role checks for Member, Developer, Manager, Admin across all commands & APIs | M5 | Survey (R5) |
| F16 | Extended REST API Endpoints | `doGet` and `doPost` support for all enterprise actions | M5 | Survey (R5) |
| F17 | Web Dashboard & Mini App Upgrade | Complete UI with Developer cards, Milestones, Bounty badges, AI duplicate modal | M5 | Survey (R5) |
| F18 | 100% E2E Verification & Git Sync | 100% test simulator pass, adversarial verification, docs and repo sync | M6 | Survey |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Test Infrastructure & E2E Suites | `scripts/test_simulator.js`, `TEST_INFRA.md`, `TEST_READY.md` | none | DONE |
| M1 | R1 AI Duplicate Detection | AI Integration, Gemini/DeepSeek prompts, Duplicate warning, Merge vote | M0 | DONE |
| M2 | R2 Developer Task Claiming & Lifecycle | Task claiming, FSM transitions, Milestones in Sheets, UI updates | M0 | DONE |
| M3 | R3 Targeted Beta Notifications | Voter extraction, DM alerts, Fallback group mentions | M0, M2 | DONE |
| M4 | R4 Tool Bounty & Crowdfunding | `Bounties` sheet, Multi-currency pool, Badge display, `/bounty` command | M0 | DONE |
| M5 | R5 Enterprise RBAC & Dual-Platform Sync | Schema upgrade (`SetupHelper.js`), RBAC matrix, Web Dashboard sync | M1, M2, M3, M4 | DONE |
| M6 | Final Verification & Git Sync | 100% test pass across all tiers, Adversarial coverage hardening, Git commit | M5 | DONE |

---

## Code Layout
- `google-apps-script/Code.js`: Main backend logic (doGet, doPost, commands, callbacks, AI, notifications, bounties, RBAC)
- `google-apps-script/SetupHelper.js`: Sheets initialization, headers, menu UI
- `scripts/test_simulator.js`: Complete in-memory unit/integration test suite
- `web-dashboard/index.html`: Web & Telegram Mini App HTML structure
- `web-dashboard/app.js`: Web & Telegram Mini App JavaScript client
- `web-dashboard/styles.css`: Enterprise CSS styling & badges
- `docs/`: Documentation guides

---

## Interface Contracts

### AI Deduplication Engine (`checkAiDuplicate`)
```typescript
interface DuplicateCheckResult {
  is_duplicate: boolean;
  similarity_score: number; // 0 - 100
  matched_idea_id: number | null;
  matched_title: string | null;
  reason: string;
  similar_ideas: Array<{ id: number; title: string; score: number }>;
}
```

### Developer Lifecycle State Machine
```
[⏳ Đang lấy ý kiến] ──(claim_task)──> [🚀 Đang phát triển]
[🚀 Đang phát triển] ──(devbeta)──────> [🧪 Beta Testing] (Triggers R3)
[🧪 Beta Testing] ───(devdone)──────> [✅ Hoàn thành] (Triggers R3 & Bounty release)
[🚀 Đang phát triển] ──(unclaim)──────> [⏳ Đang lấy ý kiến]
```

### Bounty Calculation Contract
```typescript
interface BountyRecord {
  bountyId: number;
  ideaId: number;
  userId: string | number;
  username: string;
  amount: number;
  unit: "VND" | "USD" | "COFFEE" | "POINTS";
  message: string;
  status: "PLEDGED" | "PAID" | "RELEASED";
}
```

### RBAC Hierarchy
- `Admin`: Full permissions (all commands, config, user roles, override).
- `Manager`: Manage tasks, bounties, idea statuses, view reports.
- `Developer`: Claim open tasks, update milestones, submit beta builds, release completed tools, unclaim own tasks.
- `Member`: Submit ideas, upvote/unvote, pledge bounties, test beta tools.
