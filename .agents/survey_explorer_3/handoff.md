# Handoff Report — Test Infrastructure, Simulation Environment & Test Scenarios

**Author**: Survey Explorer 3 (Test Architect & Verification Specialist)  
**Target File**: `d:/Profile/AutoFillSheet/.agents/survey_explorer_3/handoff.md`  
**Date**: 2026-08-28T10:48:00Z  
**Project**: ToolHunt Enterprise (`d:/Profile/AutoFillSheet`)

---

## 1. Observation

### 1.1. Workspace & Test File Inventory
Through filesystem analysis (`find_by_name`, `list_dir`, `view_file`), the current testing and execution environment comprises the following:
- **`package.json`** (lines 14–19): Defines test script `"scripts": { "test": "node scripts/test_simulator.js" }`.
- **`scripts/test_simulator.js`** (316 lines): Single standalone test script running in pure Node.js without third-party npm packages.
- **`google-apps-script/Code.js`** (801 lines): Primary backend business logic for Google Apps Script, including `doGet`, `doPost`, `handleTelegramMessage`, `handleTelegramCallbackQuery`, and `handleApiPostRequest`.
- **`google-apps-script/SetupHelper.js`** (199 lines): Spreadsheet initialization and UI webhook setup menu handlers.
- **`web-dashboard/app.js`** (469 lines) & **`web-dashboard/index.html`** (266 lines): Frontend Telegram Mini App & Web Dashboard.
- **`scripts/setup_webhook.js`** (162 lines) & **`scripts/setup_webhook.py`** (92 lines): CLI utilities for Telegram webhook management.

### 1.2. Baseline Test Execution Results
Running `node scripts/test_simulator.js` yields the following baseline execution:
```
======================================================
🧪 CHẠY KIỂM THỬ TỰ ĐỘNG (UNIT TESTS & LOGIC SIMULATOR)
======================================================

🔹 1. Kiểm tra xác thực cú pháp /idea:
  ✅ [PASS] Báo lỗi khi thiếu dấu gạch đứng (|)

🔹 2. Kiểm tra tạo ý tưởng mới:
  ✅ [PASS] Tạo thành công Idea #1
  ✅ [PASS] Tạo thành công Idea #2

🔹 3. Kiểm tra tính năng Upvote:
  ✅ [PASS] Voter 1 vote Idea #1 thành công -> Vote = 1
  ✅ [PASS] Voter 2 vote Idea #1 thành công -> Vote = 2

🔹 4. Kiểm tra chống gian lận & Rút lại vote (Toggle Unvote):
  ✅ [PASS] Voter 1 bấm lại -> Chuyển thành UNVOTE -> Vote giảm về 1
  ✅ [PASS] Voter 1 vote lại -> Vote tăng lại lên 2

🔹 5. Kiểm tra bảng xếp hạng /top:
  ✅ [PASS] Idea #2 dẫn đầu với 3 votes
  ✅ [PASS] Idea #1 đứng thứ hai với 2 votes

🔹 6. Kiểm tra thống kê /stats:
  ✅ [PASS] Tổng số ideas = 2
  ✅ [PASS] Tổng số votes trong hệ thống = 5

🔹 7. Kiểm tra phân quyền Admin /status:
  ✅ [PASS] Chặn người dùng thường đổi trạng thái
  ✅ [PASS] Admin cập nhật trạng thái thành công

------------------------------------------------------
📊 KẾT QUẢ: 13 PASSED / 0 FAILED
🎉 TẤT CẢ CÁC KIỂM THỬ ĐÃ VƯỢT QUA 100%!
------------------------------------------------------
```
Current test suite passes 13 out of 13 tests with exit code 0.

### 1.3. Analysis of Existing Mock Architecture in `test_simulator.js`
Direct inspection of `scripts/test_simulator.js` lines 10–193 reveals:
1. **`MockSpreadsheet` Class (lines 11–53)**:
   - In-memory database with 4 sheets: `Ideas` (12 columns), `Votes` (5 columns), `Config` (3 columns), `Admins` (4 columns).
   - Supported methods: `getSheetByName()`, `getDataRange().getValues()`, `getLastRow()`, `appendRow()`, `deleteRow()`, and `getRange(row, col).setValue()`.
   - **Missing methods**: `getRange(row, col).getValue()`, multi-cell ranges `getRange(r, c, nr, nc).getValues() / setValues()`, `getLastColumn()`, `insertSheet()`, UI interactions (`SpreadsheetApp.getUi()`), and range formatting.
2. **`BotEngine` Class (lines 56–193)**:
   - A localized duplicate class simulating Telegram message routing and callback handling.
   - Handled commands: `/idea` (syntax split by `|`), `/top` (sort top 5), `/stats` (count ideas & votes), `/status` (admin check against `Admins` sheet).
   - Handled callback queries: `vote_<id>` with toggle unvote logic.
3. **Missing GAS & External Service Mocks**:
   - **`UrlFetchApp`**: Completely absent. Cannot simulate external REST calls (Telegram Bot API, DeepSeek Chat Completions API, Google Gemini `generateContent` API).
   - **`LockService`**: Absent. Cannot simulate script mutex concurrency (`LockService.getScriptLock()`).
   - **`ContentService`**: Absent. Cannot simulate `createTextOutput()` MIME handling for `doGet` and `doPost`.
   - **`Utilities`**: Absent. Cannot simulate `Utilities.formatDate`, hash computation, or encoding.
   - **`PropertiesService` & `CacheService`**: Absent.

---

## 2. Logic Chain

### 2.1. Gap Analysis: Baseline Simulator vs. Enterprise Acceptance Criteria (R1–R5)
Connecting the user requirements in `ORIGINAL_REQUEST.md` (lines 39–48) to the existing test simulator:

```
[Requirement R1: AI Duplicate Detection]
 └── Observation: test_simulator.js lacks UrlFetchApp mock and AI deduplication logic.
 └── Need: MockUrlFetchApp with DeepSeek & Gemini endpoint interception, similarity score calculation, duplicate warning trigger, merge vote callback, and force create action.

[Requirement R2: Developer Task Claiming & Workflow]
 └── Observation: test_simulator.js only has /status; no claim_task, unclaim_task, or dev milestone transitions.
 └── Need: Simulation of [ 🛠 Nhận làm tool ] callback and API actions (claimTask, unclaimTask, updateTaskStatus), conflict prevention (double-claim), and status lifecycle (Open -> In Progress -> Beta Testing -> Completed).

[Requirement R3: Targeted Beta Tester Notifications]
 └── Observation: No mechanism in test_simulator.js checks voter extraction or targeted notification dispatch.
 └── Need: Voter query engine extracting active voters from Votes sheet, triggering targeted Telegram sendMessage calls with personalized beta links/review forms when status moves to Beta/Completed.

[Requirement R4: Tool Bounty & Crowdfunding]
 └── Observation: MockSpreadsheet lacks Bounties sheet; test_simulator.js has no bounty calculation or pledge handler.
 └── Need: Mock Bounties sheet schema, pledgeBounty action simulation, crowdfunding accumulation calculation, Telegram post bounty badge formatting, and reward allocation verification.

[Requirement R5: Enterprise Architecture & RBAC & Dual-Platform Sync]
 └── Observation: test_simulator.js only tests BotEngine messages; does not test doGet/doPost REST API contracts, 4-tier RBAC (Member, Developer, Manager, Admin), or dual-platform sync.
 └── Need: Full GAS Runtime Emulator executing doGet/doPost with rich request payloads, RBAC permission gate checks, and process.exitCode CI integration.
```

### 2.2. Architectural Blueprint for the Enhanced Test Harness

To achieve exhaustive coverage without external network dependencies, the upgraded test simulator must be structured in 4 decoupled layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAYER 4: TEST RUNNER & CLI                       │
│  - Suite runner with 10 modular test suites (35+ test assertions)      │
│  - Formatted colorized output, duration timer, and CI exit code handling │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│              LAYER 3: TELEGRAM & REST API EVENT DISPATCHER             │
│  - simulateTelegramMessage({ text, from, chat })                       │
│  - simulateTelegramCallback({ data, from, message })                   │
│  - simulateHttpGet({ action, ...params })                              │
│  - simulateHttpPost(payload)                                           │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│               LAYER 2: GAS RUNNER & SERVICE MOCKS                      │
│  - MockSpreadsheetApp: In-memory Sheets (Ideas, Votes, Bounties, etc.) │
│  - MockUrlFetchApp: DeepSeek, Gemini & Telegram API mock routes        │
│  - MockLockService, MockContentService, MockUtilities, MockLogger      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│                LAYER 1: SYSTEM UNDER TEST (CODEBASE)                   │
│  - google-apps-script/Code.js (doGet, doPost, business functions)      │
│  - google-apps-script/SetupHelper.js (initSpreadsheet)                 │
│  - Bot & API logic engine                                              │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3. Detailed Design of Enhanced Mocks

#### A. `MockSpreadsheetApp` (Enterprise Database Layer)
The mock database must initialize the following 6 standard sheets with complete enterprise column structures:
1. **`Ideas`**: `["ID", "Thời Gian", "User ID", "Username", "Tên Ý Tưởng", "Mô Tả Chi Tiết", "Thể Loại", "Tổng Vote", "Message ID", "Chat ID", "Trạng Thái", "Ghi Chú", "Developer ID", "Developer Username", "Claim Date", "Bounty Total", "Milestones"]`
2. **`Votes`**: `["Thời Gian", "Idea ID", "User ID", "Username", "Hành Động"]`
3. **`Bounties`**: `["Bounty ID", "Idea ID", "User ID", "Username", "Số Tiền / Loại", "Loại Tiền", "Ghi Chú", "Thời Gian", "Trạng Thái", "Thụ Hưởng"]`
4. **`Admins` / `RBAC_Users`**: `["User ID Telegram", "Username / Tên", "Vai Trò", "Ngày Thêm"]` (Roles: `Admin`, `Manager`, `Developer`, `Member`)
5. **`Config`**: `["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"]`
6. **`AuditLogs`**: `["Thời Gian", "User ID", "Username", "Hành Động", "Chi Tiết"]`

#### B. `MockUrlFetchApp` (Deterministic External HTTP Router)
Intercepts all `UrlFetchApp.fetch(url, options)` calls and dispatches to mock handlers:
- **Telegram Bot API** (`https://api.telegram.org/bot<TOKEN>/...`):
  - `sendMessage`: Records outgoing messages to `sentMessages` array; returns `{ ok: true, result: { message_id: nextMsgId++ } }`.
  - `editMessageReplyMarkup`: Records updated inline keyboards to `editedKeyboards` array; returns `{ ok: true }`.
  - `answerCallbackQuery`: Records alerts/toasts to `callbackAlerts` array; returns `{ ok: true }`.
  - `getMe`: Returns `{ ok: true, result: { id: 123456, is_bot: true, first_name: "ToolHunt Bot", username: "ToolHuntBot" } }`.
  - `setWebhook` / `deleteWebhook`: Returns `{ ok: true, description: "Webhook was set/deleted" }`.
- **Google Gemini API** (`https://generativelanguage.googleapis.com/...`):
  - Returns simulated semantic similarity JSON payload with score, duplicate flag, and matching idea reference.
- **DeepSeek API** (`https://api.deepseek.com/...`):
  - Returns simulated OpenAI-compatible JSON payload `{ choices: [{ message: { content: '{"similarity": 0.85, "duplicate": true, "matchedIdeaId": 1}' } }] }`.
  - Supports configurable failover triggers (e.g. status 500 / 429) to test fallback to Gemini or local heuristic algorithm.

---

### 2.4. Comprehensive Test Suite Matrix (10 Suites / 35+ Test Scenarios)

| Suite ID | Test Suite Name | Focus & Requirement | Specific Test Cases & Assertions |
|:---|:---|:---|:---|
| **Suite 1** | **Syntax & Command Validation** | Core Bot Baseline | 1.1 `/idea` without `\|` separator returns `INVALID_SYNTAX`<br>1.2 `/idea` with title < 3 characters rejected<br>1.3 Unknown command returns default help or ignored |
| **Suite 2** | **Idea Creation & Initialization** | Core Bot Baseline & Schema | 2.1 Create Idea #1 via `/idea` -> stored in `Ideas` sheet with ID 1, status "Đang lấy ý kiến"<br>2.2 Create Idea #2 -> stored with ID 2<br>2.3 Telegram notification post correctly formatted with HTML escaping |
| **Suite 3** | **AI Duplicate Detection (R1)** | R1 (DeepSeek & Gemini) | 3.1 High similarity input (>0.75) triggers duplicate warning, does NOT create new row<br>3.2 Duplicate warning provides `merge_vote_1` and `force_create` buttons<br>3.3 Low similarity input (<0.30) automatically creates new idea without prompt<br>3.4 Clicking `merge_vote_1` increments existing idea's vote count and logs voter<br>3.5 Clicking `force_create` proceeds with creating new idea<br>3.6 Primary AI failure (HTTP 500) triggers graceful fallback to secondary AI / heuristic |
| **Suite 4** | **Upvote & Anti-Fraud (Toggle Unvote)** | Community Voting | 4.1 First upvote by User A -> vote count increments from 0 to 1<br>4.2 Second upvote by User B -> vote count increments to 2<br>4.3 Re-vote by User A (duplicate click) -> toggles to UNVOTE, vote count decrements to 1<br>4.4 Subsequent vote by User A -> toggles back to UPVOTE, vote count increases to 2<br>4.5 Telegram inline keyboard markup updated with live vote count |
| **Suite 5** | **Developer Task Claiming Lifecycle (R2)** | R2 (Dev Claiming) | 5.1 Eligible Developer claims open task (`claim_task_1`) -> status becomes "🚀 Đang phát triển", dev username & claim date saved<br>5.2 Double-claim prevention: second developer attempting claim is rejected (`ALREADY_CLAIMED`)<br>5.3 Developer updates progress to Beta Testing (`dev_status_1_beta`) -> status becomes "🧪 Beta Testing"<br>5.4 Developer/Admin marks task as completed (`dev_status_1_completed`) -> status becomes "✅ Hoàn thành"<br>5.5 Developer releases task (`unclaim_task_1`) -> status reverts to "⏳ Đang lấy ý kiến", dev fields cleared<br>5.6 Unauthorized user cannot unclaim another developer's task |
| **Suite 6** | **Targeted Beta Notifications (R3)** | R3 (Targeted Alerts) | 6.1 Active voter extraction correctly retrieves only active voters (excludes unvoted users)<br>6.2 Transition to "🧪 Beta Testing" triggers targeted direct messages to all active voters with beta link<br>6.3 Transition to "✅ Hoàn thành" triggers completion announcement to active voters<br>6.4 Non-voters receive zero targeted notification messages |
| **Suite 7** | **Tool Bounty & Crowdfunding (R4)** | R4 (Tool Bounty) | 7.1 Sponsor pledges 500,000 VND -> logged in `Bounties` sheet, total bounty for Idea #1 = 500,000 VND<br>7.2 Second sponsor pledges 200,000 VND -> total bounty accumulates to 700,000 VND (2 sponsors)<br>7.3 Telegram post & API responses format bounty badge (`💰 Quỹ thưởng: 700.000 VNĐ`)<br>7.4 Completed task marks bounties as ready for payout to assigned developer |
| **Suite 8** | **Enterprise RBAC Permissions (R5)** | R5 (RBAC) | 8.1 Member cannot execute Admin `/status` or change system config<br>8.2 Developer can claim and update own assigned task<br>8.3 Manager can reassign tasks and manage bounties<br>8.4 Admin has full override authority on all ideas, statuses, and config |
| **Suite 9** | **REST API Contracts (`doGet` & `doPost`)** | R5 (API Integration) | 9.1 `doGet` with `action=getIdeas` returns enriched JSON list (votes, dev, bounty, status)<br>9.2 `doGet` with `action=getUserVotes` returns array of voted idea IDs for user<br>9.3 `doGet` with `action=getStats` returns total ideas, total votes, total bounties<br>9.4 `doPost` with `apiAction=submitIdea` creates idea from Web Dashboard<br>9.5 `doPost` with `apiAction=voteIdea` handles Web voting with Telegram button sync<br>9.6 `doPost` with `apiAction=claimTask` handles Web claiming |
| **Suite 10** | **Dual-Platform Sync & Concurrency (R5)** | R5 (Dual Sync) | 10.1 Web upvote synchronizes Telegram message reply markup<br>10.2 Telegram claim synchronizes Web Dashboard API output<br>10.3 Concurrency handling: `LockService` waitLock & releaseLock verification |

---

## 3. Caveats

1. **No Live Telegram or AI Network Calls in Unit Tests**:
   - All tests in `test_simulator.js` must execute 100% hermetically in-memory using `MockUrlFetchApp` and `MockSpreadsheetApp`. Live API keys (Telegram Bot Token, DeepSeek API Key, Gemini API Key) should not be required to run or pass `npm test`.
2. **Google Apps Script V8 vs. Node.js V8 Runtime Nuances**:
   - Node.js execution uses standard JavaScript V8, matching modern Google Apps Script V8 runtime. However, GAS-specific globals (`SpreadsheetApp`, `ContentService`, `Utilities`, `LockService`, `Logger`) must be provided by the mock harness during simulation.
3. **Frontend DOM Execution**:
   - `web-dashboard/app.js` runs in browser/Telegram WebApp environments. Unit testing for `app.js` logic (state management, filtering, optimistic voting) should be validated via JS logic assertions or headless verification.
4. **No Direct Source Modification during Investigation**:
   - In accordance with explorer constraints, no production files were modified. All proposals are documented in this handoff for subsequent implementation by the developer/orchestrator team.

---

## 4. Conclusion

1. **Test Infrastructure Readiness**:
   - The baseline test suite (`scripts/test_simulator.js`) provides an excellent foundation with fast, dependency-free execution (`npm test`), but is currently limited to 13 basic tests on an isolated `BotEngine` class.
2. **Required Upgrade Scope**:
   - Upgrade `scripts/test_simulator.js` to incorporate a complete GAS Runtime Emulator (`MockSpreadsheetApp`, `MockUrlFetchApp`, `MockLockService`, `MockContentService`, `MockUtilities`), with dedicated mock handlers for Gemini/DeepSeek AI APIs and Telegram Bot API.
   - Implement the 10 modular test suites comprising 35+ test assertions covering 100% of R1 (AI Deduplication), R2 (Dev Claiming Lifecycle), R3 (Targeted Beta Notifications), R4 (Tool Bounty), and R5 (Enterprise RBAC & Dual-Platform Sync).
   - Ensure `process.exitCode` is strictly set (`failed > 0 ? 1 : 0`) to guarantee automated CI/CD gating.

---

## 5. Verification Method

### 5.1. Test Execution Commands
The test suite can be verified independently using either of the following commands:
```powershell
# 1. Standard npm test runner
npm test

# 2. Direct Node.js script execution
node scripts/test_simulator.js
```

### 5.2. Success & Pass Criteria
- **Pass Rate**: 100% (All test suites pass, 0 failures, exit code 0).
- **Execution Speed**: Full suite execution completes in < 500ms.
- **Hermetic Guarantee**: Runs offline with zero network connectivity or external API token requirements.
- **Coverage**:
  - Semantic duplicate detection with threshold matching and warning/merge/force flows (R1).
  - Claim, milestone update, completion, and unclaim flows (R2).
  - Active voter extraction and targeted notification dispatch (R3).
  - Bounty creation, crowdfunding accumulation, badge formatting, and payout linking (R4).
  - 4-tier RBAC enforcement and REST API contract compliance for all `doGet`/`doPost` endpoints (R5).
