# Enterprise Test Infrastructure & Simulator (`TEST_INFRA.md`)

## 1. Test Philosophy & Design Principles
ToolHunt Enterprise employs a **Hermetic In-Memory Simulation Architecture** designed to execute 100% of integration, unit, and end-to-end user journeys locally without requiring live external tokens (Telegram Bot API, DeepSeek API, Google Gemini API) or live Google Spreadsheet network connections.

### Core Testing Pillars
1. **Zero External Dependencies**: Standalone pure Node.js test harness without external npm dependencies (`npm test` / `node scripts/test_simulator.js`).
2. **Deterministic Hermetic Execution**: External HTTP APIs (DeepSeek Chat, Google Gemini Flash, Telegram Bot API) are mocked with deterministic payload matching and failover routing.
3. **Google Apps Script V8 Runtime Fidelity**: Complete emulation of Google Apps Script runtime services (`SpreadsheetApp`, `UrlFetchApp`, `LockService`, `ContentService`, `Utilities`, `Logger`).
4. **Strict CI/CD Gating**: Automated `process.exitCode = failed > 0 ? 1 : 0` ensuring zero-defect progression.
5. **Sub-Second Speed**: Full 10-suite execution runs in < 50ms.

---

## 2. Test Architecture & Multi-Layer System

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAYER 4: TEST RUNNER & CLI                       │
│  - 10 Modular Test Suites with 48 assertions                           │
│  - ANSI-colorized formatting, execution duration timer, and CI exit code│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│              LAYER 3: TELEGRAM & REST API EVENT DISPATCHER             │
│  - simulateTelegramMessage({ text, from, chat })                       │
│  - simulateTelegramCallback({ data, from, message })                   │
│  - handleApiGet({ action, ...params })                                 │
│  - handleApiPost({ apiAction, ...payload })                            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│               LAYER 2: GAS RUNNER & SERVICE MOCKS                      │
│  - MockSpreadsheetApp: In-memory 6 Sheets (Ideas, Votes, Bounties, etc.)│
│  - MockUrlFetchApp: DeepSeek, Gemini & Telegram API mock routes        │
│  - MockLockService, MockContentService, MockUtilities, MockLogger      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│                LAYER 1: SYSTEM UNDER TEST (CORE LOGIC)                 │
│  - EnterpriseBotEngine & REST Router                                   │
│  - AI Deduplication Engine (Gemini & DeepSeek with failover)           │
│  - Task Lifecycle FSM & Targeted Beta Notification Engine              │
│  - Multi-Currency Bounty Ledger & 4-Tier RBAC Permission Matrix        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spreadsheet Data Layer Schema (6 Sheets)

| # | Sheet Name | Column Count | Column Headers |
|---|------------|--------------|----------------|
| 1 | **`Ideas`** | 17 | `ID`, `Thời Gian`, `User ID`, `Username`, `Tên Ý Tưởng`, `Mô Tả Chi Tiết`, `Thể Loại`, `Tổng Vote`, `Message ID`, `Chat ID`, `Trạng Thái`, `Ghi Chú`, `Developer ID`, `Developer Username`, `Claim Date`, `Milestones`, `Tổng Bounty` |
| 2 | **`Votes`** | 5 | `Thời Gian`, `Idea ID`, `User ID`, `Username`, `Hành Động` |
| 3 | **`Bounties`** | 10 | `Thời Gian`, `Bounty ID`, `Idea ID`, `Sponsor User ID`, `Sponsor Username`, `Số Lượng`, `Đơn Vị`, `Lời Nhắn`, `Trạng Thái`, `Ghi Chú` |
| 4 | **`Admins`** | 5 | `User ID Telegram`, `Username / Tên`, `Vai Trò`, `Trạng Thái`, `Ngày Thêm` |
| 5 | **`Config`** | 3 | `Cấu Hình (Key)`, `Giá Trị (Value)`, `Mô Tả` |
| 6 | **`AuditLogs`** | 5 | `Thời Gian`, `User ID`, `Username`, `Hành Động`, `Chi Tiết` |

---

## 4. Test Suites & Verification Scope

### Suite 1: Syntax & Command Validation
- **1.1**: `/idea` without `|` separator returns `INVALID_SYNTAX`.
- **1.2**: `/idea` with title < 3 characters returns `TITLE_TOO_SHORT`.
- **1.3**: Unregistered commands return `UNKNOWN_COMMAND`.
- **1.4**: Valid syntax parses title and description and initializes Idea #1.

### Suite 2: Idea Creation & Telegram Card Formatting
- **2.1**: Idea #1 persistence in `Ideas` sheet with ID 1 and default status `Đang lấy ý kiến`.
- **2.2**: Sequential ID generation for Idea #2.
- **2.3**: HTML-formatted Telegram post rendering with author, category, description, and status emoji.
- **2.4**: Inline Keyboard markup rendering with `vote_{id}`, `claim_task_{id}`, and `bounty_{id}` buttons.

### Suite 3: R1 AI Duplicate Detection (DeepSeek & Gemini)
- **3.1**: DeepSeek AI semantic comparison detects high similarity (>75%), triggers `DUPLICATE_DETECTED` warning, and blocks automatic row creation.
- **3.2**: Warning prompt renders `merge_vote_{id}` (Consolidate vote) and `force_create` (Proceed anyway) inline buttons.
- **3.3**: Unique ideas (<30% similarity) are created automatically without blocking prompt.
- **3.4**: `merge_vote_{id}` consolidates vote into existing Idea #1 and increments vote counter.
- **3.5**: `force_create` persists the idea despite similarity score.
- **3.6**: Primary AI (DeepSeek) 500 error triggers automatic failover to Secondary AI (Gemini Flash) / local heuristic.

### Suite 4: Upvote & Anti-Fraud (Toggle Unvote)
- **4.1**: Initial upvote increments vote count from 0 to 1 (`action: "VOTE"`).
- **4.2**: Second voter upvotes -> vote count increments to 2.
- **4.3**: Repeat upvote by first voter toggles to `action: "UNVOTE"` and decrements vote count to 1.
- **4.4**: Third upvote by first voter toggles back to `action: "VOTE"` and increments vote count to 2.
- **4.5**: Real-time Telegram inline keyboard sync displays live vote count `👍 Upvote (2)`.

### Suite 5: R2 Developer Task Claiming Lifecycle
- **5.1**: Eligible Developer claims open task (`claim_task_1`) -> status transitions to `Đang phát triển`, assigning Developer ID, username, and claim timestamp.
- **5.2**: Double-claim conflict prevention: Second developer attempting claim is rejected with `ALREADY_CLAIMED`.
- **5.3**: Developer updates progress to Beta Testing (`devbeta_1`) -> status transitions to `Beta Testing` (Milestone `80% - Đang thử nghiệm`).
- **5.4**: Developer marks task completed (`devdone_1`) -> status transitions to `Hoàn thành` (Milestone `100% - Đã xuất bản`).
- **5.5**: Developer releases task (`unclaim_task_2`) -> status reverts to `Đang lấy ý kiến` and clears developer assignment fields.
- **5.6**: Unauthorized Member attempting to unclaim a developer's task is blocked with `UNAUTHORIZED_UNCLAIM`.

### Suite 6: R3 Targeted Beta Notifications
- **6.1**: Active voter query engine queries `Votes` sheet and extracts only active distinct upvoters (excluding unvoted users).
- **6.2**: Transition to `Beta Testing` sends targeted direct messages (DM) to all active voters with live demo URL and feedback link.
- **6.3**: Transition to `Hoàn thành` sends completion announcement DM to all active voters.
- **6.4**: Non-voters receive zero notification messages.

### Suite 7: R4 Tool Bounty & Crowdfunding
- **7.1**: Sponsor pledges 500,000 VND -> recorded in `Bounties` sheet with status `PLEDGED`.
- **7.2**: Multi-sponsor accumulation: Second sponsor pledges 200,000 VND -> total bounty pool accumulates to 700,000 VND across 2 sponsors.
- **7.3**: Coffee bounty pledge: Third sponsor pledges 5 COFFEE ☕ -> accumulated in multi-currency pool (`700.000 VNĐ + 5 ☕`).
- **7.4**: Gold bounty badge formatting recorded in Column 17 (`Tổng Bounty`) of `Ideas` sheet.
- **7.5**: Task completion transitions all bounties for that idea to `RELEASED` status for developer payout.

### Suite 8: R5 4-Tier RBAC Permission Matrix
- **8.1**: `Member` role is blocked from executing Admin command `/status` (`UNAUTHORIZED`).
- **8.2**: `Developer` role has authority to claim open tasks, update milestones, and release builds.
- **8.3**: `Manager` role has authority to change statuses and reassign tasks across all ideas.
- **8.4**: `Admin` role possesses universal override authority across all ideas, config, and roles.

### Suite 9: R5 REST API Contracts (`doGet` & `doPost`)
- **9.1**: `doGet?action=getIdeas` returns enriched JSON list of ideas with developer & bounty fields.
- **9.2**: `doGet?action=getUserVotes` returns array of idea IDs voted by the requested user.
- **9.3**: `doGet?action=getStats` returns system statistics (`totalIdeas`, `totalVotes`, `totalBounties`).
- **9.4**: `doPost?apiAction=submitIdea` handles web dashboard idea creation.
- **9.5**: `doPost?apiAction=voteIdea` handles web dashboard voting with Telegram button synchronization.
- **9.6**: `doPost?apiAction=pledgeBounty` handles web dashboard bounty pledging.

### Suite 10: R5 Dual-Platform Sync & Concurrency
- **10.1**: Web upvote triggers immediate Telegram message reply markup edit.
- **10.2**: Telegram claim action immediately reflects in Web Dashboard API response.
- **10.3**: `LockService` mutex concurrency is enforced during `doPost` with guaranteed `waitLock` and `releaseLock`.
- **10.4**: `AuditLogs` sheet logs all critical enterprise operations (create idea, vote, unvote, claim, unclaim, status update, bounty pledge).

---

## 5. Execution & Verification Commands

```powershell
# Run the test simulator via npm
npm test

# Direct execution via Node.js
node scripts/test_simulator.js
```
