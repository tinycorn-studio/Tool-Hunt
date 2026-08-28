# ToolHunt Enterprise Codebase Survey & Architecture Mapping Report

**Author**: Survey Explorer 1  
**Date**: 2026-08-28T10:44:00Z  
**Scope**: Comprehensive analysis of ToolHunt codebase (`google-apps-script/`, `web-dashboard/`, `scripts/`, `docs/`, `package.json`) and architectural design for Enterprise expansion (R1 - R5).

---

## 1. Observation

Direct code observations across all repository modules:

### 1.1 Repository Structure & File Inventory
The workspace at `d:/Profile/AutoFillSheet` contains:
- `package.json`: NPM package defining metadata, entry point (`google-apps-script/Code.js`), and scripts (`test`: `node scripts/test_simulator.js`, `setup`: `node scripts/setup_webhook.js`, `setup:py`: `python scripts/setup_webhook.py`, `dashboard`: `npx serve web-dashboard -p 3000`).
- `google-apps-script/Code.js` (801 lines, 28,911 bytes): Main Google Apps Script backend engine handling REST API (`doGet`), Webhooks (`doPost`), Telegram messages, callbacks, and Telegram Bot API requests.
- `google-apps-script/SetupHelper.js` (199 lines, 7,484 bytes): Spreadsheet menu integrations (`onOpen`), automatic sheet generation (`initSpreadsheet`), webhook setup UI, bot info validator (`getMe`), and header formatting.
- `google-apps-script/appsscript.json` (11 lines): V8 runtime configuration, WebApp deploy settings (`USER_DEPLOYING`, `ANYONE_ANONYMOUS`).
- `scripts/test_simulator.js` (316 lines, 11,854 bytes): Standalone in-memory unit test suite simulating Google Sheets and Telegram Bot Engine with 13 automated test assertions.
- `scripts/setup_webhook.js` & `setup_webhook.py`: Node.js and Python interactive CLI tools for Telegram Webhook setup and health checks.
- `web-dashboard/index.html` (266 lines): Mobile-first web app and Telegram Mini App dashboard interface using Tailwind CSS and FontAwesome.
- `web-dashboard/app.js` (469 lines): Client-side state manager (`STATE`), Telegram WebApp SDK connector, REST API sync, optimistic UI voting, search, and category filters.
- `web-dashboard/styles.css` (76 lines): Styling, glassmorphism cards, status badges, and button animations.
- `docs/` (`HUONG_DAN_ADMIN.md`, `HUONG_DAN_CAI_DAT.md`, `TELEGRAM_BOTFATHER.md`): Setup guides, admin role docs, BotFather command specifications.

---

### 1.2 Google Apps Script Backend (`google-apps-script/Code.js`)

#### A. Configuration & Utilities (Lines 17–53)
- `DEFAULT_CONFIG` (lines 17–22):
  ```javascript
  const DEFAULT_CONFIG = {
    BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN_HERE",
    ADMIN_IDS: [],
    WEBAPP_URL: "",
    COMMUNITY_GROUP_ID: ""
  };
  ```
- `getConfig(key)` (lines 27–43): Reads config dynamically from the `Config` sheet (Column A: Key, Column B: Value) with fallback to `DEFAULT_CONFIG`.
- `getBotToken()` (lines 45–48) & `getTelegramApiUrl()` (lines 50–52): Constructs Telegram Bot API root URL (`https://api.telegram.org/bot<token>`).

#### B. REST API Endpoints (`doGet`, Lines 57–154)
`doGet(e)` parses query parameter `action`:
1. `action === "getIdeas" || action === "list"` (lines 64–104):
   - Reads rows 2..N of sheet `Ideas`.
   - Returns `{ ok: true, count: N, data: [...] }` sorted descending by `votes` (`b.votes - a.votes`).
   - Fields extracted: `id`, `timestamp`, `userId`, `username`, `title`, `description`, `category`, `votes`, `messageId`, `chatId`, `status`, `note`.
2. `action === "getUserVotes"` (lines 107–124):
   - Accepts `userId`.
   - Filters sheet `Votes` for matching `User ID` (Column C, index 2) and returns array of `Idea IDs` (Column B).
3. `action === "getStats"` (lines 127–142):
   - Returns `{ totalIdeas, totalVotes, updatedAt }`.
4. `action === "ping"` (lines 145–147):
   - Returns health status message.

#### C. Webhook & Mutation Handlers (`doPost`, Lines 159–197)
- Employs `LockService.getScriptLock()` with 15,000ms wait lock (lines 160–165).
- Dispatches payload according to structure:
  - `contents.apiAction` -> `handleApiPostRequest(contents, ss)` (lines 176–178)
  - `contents.message` -> `handleTelegramMessage(contents.message, ss)` (lines 181–183)
  - `contents.callback_query` -> `handleTelegramCallbackQuery(contents.callback_query, ss)` (lines 185–187)

#### D. Web API Post Handlers (`handleApiPostRequest`, Lines 202–332)
1. `apiAction === "submitIdea"` (lines 206–260):
   - Validates `title` and `description`.
   - Appends new row to `Ideas` sheet with `Tong_Vote = 0`, `Trạng Thái = "Đang lấy ý kiến"`, `Ghi Chú = "Đăng từ Web Dashboard"`.
   - If `COMMUNITY_GROUP_ID` is configured, automatically formats and broadcasts post to Telegram group via `sendTelegramMessage` and updates the row with `message_id` and `chat_id` (lines 233–257).
2. `apiAction === "voteIdea"` (lines 263–329):
   - Validates `ideaId` and `userId`.
   - Checks `Votes` sheet for existing `(ideaId, userId)` pair.
   - If exists (Toggle Unvote): Deletes row in `Votes`, decrements `Tong_Vote` in `Ideas`, syncs inline buttons on Telegram message if `chatId` and `messageId` exist.
   - If not exists: Appends row `[new Date(), ideaId, userId, username, "UPVOTE"]`, increments `Tong_Vote`, syncs inline buttons on Telegram message.

#### E. Telegram Message Router (`handleTelegramMessage`, Lines 337–474)
- Command `/start` / `/help` (lines 347–369): Sends introduction message with command cheat sheet and WebApp inline keyboard button.
- Command `/idea [Title] | [Description]` (lines 372–436):
  - Validates `|` delimiter and min title length >= 3.
  - Appends to `Ideas` sheet.
  - Posts interactive card to Telegram with inline buttons `[ 👍 Upvote (0) ]` (`vote_<id>`) and `[ ℹ️ Chi tiết ]` (`info_<id>`).
  - Stores `message_id` and `chat_id` back in `Ideas` row.
- Command `/top` (lines 439–442): Calls `sendTopIdeasMessage` (top 5 ideas by votes).
- Command `/myideas` (lines 445–448): Calls `sendUserIdeasMessage` (ideas posted by `userId`).
- Command `/stats` (lines 451–454): Calls `sendStatsMessage` (total ideas and total upvotes).
- Command `/status <ID> <New Status>` (lines 457–473):
  - Checks authorization via `checkIsAdmin(userId, ss)`.
  - Updates `Trạng Thái` (Column 11) in sheet `Ideas` and sends confirmation message.

#### F. Telegram Callback Query Router (`handleTelegramCallbackQuery`, Lines 479–588)
- `vote_<ideaId>` (lines 491–546):
  - Queries `Votes` sheet for duplicate vote by `cbUserId`.
  - Performs Toggle Unvote (delete row, decrement score) or Add Vote (append row, increment score).
  - Updates Column 8 (`Tong_Vote`) in `Ideas` sheet.
  - Updates inline reply markup on the Telegram message via `updateMessageButtons(chatId, messageId, ideaId, currentVotes)`.
  - Acknowledges callback via `answerCallbackQuery(cbId, msg, showAlert)`.
- `info_<ideaId>` (lines 549–573): Queries idea details and sends rich HTML detail card.
- `cmd_top` & `cmd_stats` (lines 576–586): Inline quick-view triggers.

#### G. Telegram API Direct Invocation (`callTelegramApi`, Lines 755–800)
- Uses `UrlFetchApp.fetch` with `application/json` payload and `muteHttpExceptions: true`.
- Wrappers: `sendTelegramMessage`, `editMessageReplyMarkup`, `answerCallbackQuery`.

---

### 1.3 Google Sheets Structure & Helper Script (`google-apps-script/SetupHelper.js`)

Current sheet schemas initialized in `initSpreadsheet()`:

1. **`Ideas`** (Header BG: `#1E3A8A`):
   - Col 1 (`A`): `ID` (Integer sequential ID)
   - Col 2 (`B`): `Thời Gian` (Timestamp)
   - Col 3 (`C`): `User ID` (Telegram user ID / Web user ID)
   - Col 4 (`D`): `Username` (Author username / handle)
   - Col 5 (`E`): `Tên Ý Tưởng` (Idea title)
   - Col 6 (`F`): `Mô Tả Chi Tiết` (Detailed description)
   - Col 7 (`G`): `Thể Loại` (Category: "Auto Sheet", "Cào Dữ Liệu", "AI & Chatbot", "Tiện Ích & Tool", "Chung")
   - Col 8 (`H`): `Tổng Vote` (Vote count integer)
   - Col 9 (`I`): `Message ID` (Telegram post message_id)
   - Col 10 (`J`): `Chat ID` (Telegram chat/group ID)
   - Col 11 (`K`): `Trạng Thái` (Status string)
   - Col 12 (`L`): `Ghi Chú` (Note / remarks)

2. **`Votes`** (Header BG: `#065F46`):
   - Col 1 (`A`): `Thời Gian`
   - Col 2 (`B`): `Idea ID`
   - Col 3 (`C`): `User ID`
   - Col 4 (`D`): `Username`
   - Col 5 (`E`): `Hành Động` ("UPVOTE")

3. **`Config`** (Header BG: `#4C1D95`):
   - Col 1 (`A`): `Cấu Hình (Key)`
   - Col 2 (`B`): `Giá Trị (Value)`
   - Col 3 (`C`): `Mô Tả`
   - Default entries: `BOT_TOKEN`, `WEBAPP_URL`, `COMMUNITY_GROUP_ID`, `ADMIN_IDS`.

4. **`Admins`** (Header BG: `#831843`):
   - Col 1 (`A`): `User ID Telegram`
   - Col 2 (`B`): `Username / Tên`
   - Col 3 (`C`): `Vai Trò` (e.g. "Admin", "Moderator")
   - Col 4 (`D`): `Ngày Thêm`

---

### 1.4 Test Simulator Engine (`scripts/test_simulator.js`)
- `MockSpreadsheet`: In-memory JavaScript data store mimicking Google Apps Script Spreadsheet API (`getSheetByName`, `getDataRange`, `getValues`, `getLastRow`, `appendRow`, `deleteRow`, `getRange(r,c).setValue`).
- `BotEngine`: Simulates message parsing, `/idea`, `/top`, `/stats`, `/status`, and callback queries (`vote_`).
- Test suite executes 13 assertions verifying:
  1. `/idea` syntax validation without delimiter.
  2. Idea creation for #1 and #2.
  3. Single and multiple upvoting.
  4. Anti-spam duplicate vote prevention and Toggle Unvote decrement.
  5. Re-vote increment.
  6. Top ranking calculation.
  7. Stats totals.
  8. Non-admin rejection and Admin authorization for `/status`.
- Executing `node scripts/test_simulator.js` currently succeeds with 13/13 PASSED.

---

### 1.5 Web Dashboard & Telegram Mini App (`web-dashboard/`)
- `index.html`:
  - Navigation bar with stats overview (`statTotalIdeas`, `statTotalVotes`, `statTopCategory`).
  - Search bar (`#searchInput`).
  - Filter tabs (`all`, `top`, `voting`, `inprogress`, `completed`).
  - Idea card list container (`#ideasContainer`) with animated skeleton loading state.
  - Submission modal (`#modalSubmit`) with title, category dropdown, author handle, and description.
  - API Configuration modal (`#modalConfig`) saving WebApp URL to `localStorage.TG_IDEA_API_URL`.
  - Toast notification popup (`#toast`).
- `app.js`:
  - `STATE` holds `apiUrl`, `ideas`, `userVotedIds` (persisted in `localStorage`), `currentFilter`, `searchQuery`, `currentUser`.
  - Telegram WebApp SDK integration (`Telegram.WebApp.initDataUnsafe.user`) to automatically auto-fill author username and track Telegram user ID.
  - Fallback to `DEMO_IDEAS` when no API URL is configured.
  - Optimistic vote updates with instant UI responsiveness and background sync to backend.
- `styles.css`:
  - Tailwind styling enhancements, custom scrollbars, glassmorphism hover animations, and color badges (`.status-badge-voting`, `.status-badge-inprogress`, `.status-badge-completed`, `.status-badge-rejected`).

---

## 2. Logic Chain

From the direct observations above, we deduce the exact structural gaps and design requirements to achieve the Enterprise objectives R1 through R5:

```
[Observation 1.2.E & 1.2.F: Current idea creation & buttons]
  │
  ├─> /idea in Code.js directly creates row without semantic checking
  │     └─> [Logic R1]: Need checkAiDuplicate() calling Gemini / DeepSeek API before appending row.
  │         Need dual-action UI: Warning prompt + Quick vote for duplicate OR Confirm force create.
  │
  ├─> Inline buttons only contain Upvote and Info (vote_<id>, info_<id>)
  │     └─> [Logic R2]: Need Developer Claim button [ 🛠 Nhận làm tool ] (claim_<id>).
  │         Need developer attribution, milestone tracking in Ideas sheet, and claim lifecycle (Claim -> Beta -> Done -> Unclaim).
  │
  ├─> Status transitions only update Ideas sheet column 11
  │     └─> [Logic R3]: Need trigger in status update to query Votes sheet for distinct voters on ideaId.
  │         Send direct targeted notification messages with beta access link & review form.
  │
  ├─> No bounty or funding data structure in Sheets or UI
  │     └─> [Logic R4]: Need new Bounties sheet, Ideas column for Tong_Bounty,
  │         /bounty command & bounty_<id> callback, and UI Bounty badges (VND, coffee ☕, points).
  │
  └─> Current 4-sheet model and 13-test simulator only test basic vote loop
        └─> [Logic R5]: Need Enterprise 5-sheet schema with RBAC roles (Member, Developer, Manager, Admin),
            extended REST API endpoints, and expanded test_simulator.js testing 100% of R1-R5 scenarios.
```

### Detailed Logic Chain for Each Requirement:

#### R1: AI Duplicate Detection (DeepSeek & Gemini Integration)
1. **Observation**: `Code.js` lines 372–436 handles `/idea` by directly generating an ID and appending to `Ideas`. Web POST `submitIdea` (lines 206–260) does the same.
2. **Deduction**: If a user submits "Tool cào giá Shopee" and another user submits "Bot quét giá Shopee", duplicate records are created, fragmenting votes.
3. **Architecture Solution**:
   - Introduce `checkAiDuplicate(title, description, existingIdeas, ss)` in `Code.js`.
   - Read `Config` sheet for:
     - `AI_PROVIDER`: `"gemini"` | `"deepseek"` (fallback to rule-based cosine/fuzzy matching if API keys not configured).
     - `GEMINI_API_KEY` / `DEEPSEEK_API_KEY`.
     - `AI_SIMILARITY_THRESHOLD`: Default `0.70` (70%).
     - `AI_DUPLICATE_CHECK_ENABLED`: `"true"` | `"false"`.
   - AI Prompt structure returns structured JSON: `{ hasDuplicate: boolean, matches: [{ id: number, title: string, similarity: number, reason: string }] }`.
   - Telegram Flow:
     - When user sends `/idea`, if duplicate detected with score >= threshold:
       - Do NOT create row immediately.
       - Send warning message: `⚠️ PHÁT HIỆN Ý TƯỞNG TƯƠNG TỰ (Độ trùng khớp X%)`.
       - Render matched ideas with button `[ 👍 Vote cho #ID ]` and button `[ ➕ Vẫn tạo mới ]` (`confirm_idea_<token>` or parameter payload).
   - Web Dashboard Flow:
     - `submitIdea` returns `{ ok: false, duplicateDetected: true, matches: [...] }` unless `force: true` is passed.
     - Modal prompts user with similar ideas and quick vote buttons.

#### R2: Developer Task Claiming & Workflow Lifecycle
1. **Observation**: Status is currently a free-text column (Column 11) with only Admin `/status` command. Developers have no mechanism to claim tasks or declare ownership.
2. **Deduction**: Open source community developers cannot self-assign ideas or show progress.
3. **Architecture Solution**:
   - Extend `Ideas` sheet schema with developer tracking columns:
     - Col 13 (`M`): `Developer ID`
     - Col 14 (`N`): `Developer Username`
     - Col 15 (`O`): `Claim Date`
     - Col 16 (`P`): `Milestones / Progress`
   - Add inline button `[ 🛠 Nhận làm tool ]` (`claim_<id>`) on Telegram cards and Web Dashboard.
   - Callback Handlers:
     - `claim_<ideaId>`:
       - Verifies idea is unclaimed (`status === "Đang lấy ý kiến"` or dev empty).
       - Sets `Developer ID = cbUserId`, `Developer Username = cbUsername`, `Claim Date = now`, `status = "🚀 Đang phát triển bởi " + cbUsername`.
       - Updates Telegram post keyboard with dev controls: `[ 🧪 Beta Testing ]` (`devbeta_<id>`), `[ ✅ Hoàn thành ]` (`devdone_<id>`), `[ ↩️ Nhả task ]` (`unclaim_<id>`).
     - `unclaim_<ideaId>`: Allows assigned dev or Admin to release task back to `⏳ Đang lấy ý kiến`.
     - `devbeta_<id>` & `devdone_<id>`: Transitions status and triggers R3 notifications.

#### R3: Targeted Beta Tester Notifications
1. **Observation**: `Votes` sheet stores `[Thời Gian, Idea ID, User ID, Username, Hành Động]`.
2. **Deduction**: Every upvote is logged with `User ID`. When an idea reaches `🧪 Beta Testing` or `✅ Hoàn thành`, the exact audience who demanded the tool is known.
3. **Architecture Solution**:
   - Implement `notifyIdeaVoters(ideaId, newStatus, ss, extraLink)`:
     - Queries `Votes` sheet for all distinct `User ID` where `Idea ID == ideaId`.
     - Skips non-numeric IDs (e.g. web demo users) and author/developer.
     - Sends personalized Telegram DM (`sendTelegramMessage(voterUserId, msg, null, keyboard)`) containing:
       - Idea Title and Status announcement (`🧪 ĐÃ CÓ BẢN BETA THỬ NGHIỆM!` or `✅ ĐÃ CHÍNH THỨC PHÁT HÀNH!`).
       - Developer credits (`@dev_username`).
       - Direct action buttons: `[ 🚀 Trải nghiệm ngay ]` and `[ 📝 Đánh giá / Feedback ]`.
     - Catches and logs errors gracefully (e.g. if voter has not initiated private chat with the bot).

#### R4: Tool Bounty & Crowdfunding Mechanism
1. **Observation**: Currently no financial/reward incentive or bounty tracking exists.
2. **Deduction**: Enterprise sponsors and community members want to fund critical tools or buy coffee ☕ for developers.
3. **Architecture Solution**:
   - Create new sheet **`Bounties`**:
     - Col 1 (`A`): `Thời Gian`
     - Col 2 (`B`): `Bounty ID`
     - Col 3 (`C`): `Idea ID`
     - Col 4 (`D`): `Sponsor User ID`
     - Col 5 (`E`): `Sponsor Username`
     - Col 6 (`F`): `Số Lượng` (Number: amount, coffee count, points)
     - Col 7 (`G`): `Đơn Vị` (`VND`, `USD`, `COFFEE`, `POINTS`)
     - Col 8 (`H`): `Lời Nhắn` (Sponsor note)
     - Col 9 (`I`): `Trạng Thái` (`PLEDGED`, `PAID`, `RELEASED`)
   - Add Col 17 (`Q`) in `Ideas` sheet: `Tổng Bounty` (cached formatted string e.g. `500,000 VND + 3 ☕`).
   - Telegram Command: `/bounty <Idea ID> <Số lượng> [Đơn vị] | [Lời nhắn]`.
   - Telegram Button: `[ 💰 Treo thưởng ]` (`bounty_<id>`).
   - Telegram & Dashboard Card Update: Prominently renders Bounty badge (e.g. `💰 Bounty: 500,000 VND (☕ x3)`).
   - REST API: `action: "getBounties"` and `apiAction: "pledgeBounty"`.

#### R5: Enterprise Architecture & Dual-Platform Sync
1. **Observation**: Current REST API and sheet setup is simple 4-sheet structure without role-based access control (RBAC).
2. **Deduction**: Enterprise demands clear roles:
   - `Member`: Propose ideas, upvote, pledge bounties, receive beta notifications.
   - `Developer`: Claim tasks, update milestones, submit beta builds, release completed tools.
   - `Manager`: Approve ideas, manage bounties, assign developers.
   - `Admin`: Full system control, role assignment, configuration management.
3. **Architecture Solution**:
   - Upgrade `Admins` sheet to `Users_Roles` / Enterprise `Admins` with roles: `Admin`, `Manager`, `Developer`, `Member`.
   - Implement `getUserRole(userId, ss)` helper.
   - Extend `test_simulator.js` with mock classes for AI duplicate detection, Task Claiming, Targeted Notifications, and Bounty funding.
   - Update Web Dashboard UI to display Developer badges, Bounty tags, and Claim Task action buttons.
   - Maintain 100% backward compatibility and test coverage.

---

## 3. Detailed Google Sheets Schema Specification (Enterprise v2.1)

| Sheet Name | Column | Header Name | Data Type | Purpose / Description |
| :--- | :--- | :--- | :--- | :--- |
| **`Ideas`** | A | `ID` | Number | Sequential integer primary key |
| | B | `Thời Gian` | DateTime | Timestamp of idea submission |
| | C | `User ID` | String/Number | Telegram / Web Author ID |
| | D | `Username` | String | Author handle (e.g. `@author`) |
| | E | `Tên Ý Tưởng` | String | Idea / Tool title |
| | F | `Mô Tả Chi Tiết` | String | Detailed description & use case |
| | G | `Thể Loại` | String | Category ("Auto Sheet", "Cào Dữ Liệu", "AI & Chatbot", "Tiện Ích & Tool", "Chung") |
| | H | `Tổng Vote` | Number | Cached upvote counter |
| | I | `Message ID` | Number | Telegram channel/group message ID |
| | J | `Chat ID` | String/Number | Telegram group/chat ID |
| | K | `Trạng Thái` | String | Status ("⏳ Đang lấy ý kiến", "🚀 Đang phát triển", "🧪 Beta Testing", "✅ Hoàn thành", "❌ Từ chối") |
| | L | `Ghi Chú` | String | Administrative notes |
| | M | `Developer ID` | String/Number | Claimed Developer Telegram ID (R2) |
| | N | `Developer Username` | String | Claimed Developer `@handle` (R2) |
| | O | `Claim Date` | DateTime | Task claim timestamp (R2) |
| | P | `Tiến Độ / Milestones` | String | Development milestones & progress % (R2) |
| | Q | `Tổng Bounty` | String/Number | Sum of pledged bounties (R4) |
| **`Votes`** | A | `Thời Gian` | DateTime | Vote timestamp |
| | B | `Idea ID` | Number | Foreign key -> `Ideas.ID` |
| | C | `User ID` | String/Number | Voter Telegram ID / Web ID |
| | D | `Username` | String | Voter `@handle` |
| | E | `Hành Động` | String | Action ("UPVOTE", "UNVOTE") |
| **`Bounties`** | A | `Thời Gian` | DateTime | Pledge timestamp |
| | B | `Bounty ID` | Number | Sequential Bounty PK |
| | C | `Idea ID` | Number | Foreign key -> `Ideas.ID` |
| | D | `Sponsor User ID` | String/Number | Backer Telegram User ID |
| | E | `Sponsor Username` | String | Backer `@handle` |
| | F | `Số Lượng` | Number | Bounty value (e.g. 200000, 5) |
| | G | `Đơn Vị` | String | Unit (`VND`, `USD`, `COFFEE`, `POINTS`) |
| | H | `Lời Nhắn` | String | Encouragement / sponsor requirement |
| | I | `Trạng Thái` | String | Status (`PLEDGED`, `VERIFIED`, `PAID`, `RELEASED`) |
| **`Config`** | A | `Cấu Hình (Key)` | String | Config identifier |
| | B | `Giá Trị (Value)` | String | Config value |
| | C | `Mô Tả` | String | Documentation of config key |
| **`Admins`** | A | `User ID Telegram` | String/Number | Telegram User ID |
| | B | `Username / Tên` | String | Member name / `@handle` |
| | C | `Vai Trò` | String | RBAC Role (`Admin`, `Manager`, `Developer`, `Member`) |
| | D | `Ngày Thêm` | DateTime | Role assignment timestamp |

---

## 4. API Endpoints & Telegram Actions Mapping

### 4.1 REST API Endpoints (`doGet` & `doPost`)

| Method | Action / apiAction | Parameters / Body | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `getIdeas` / `list` | `category`, `status`, `sort` | Fetches all ideas with developer info & bounty summary |
| `GET` | `getUserVotes` | `userId` | Returns array of Idea IDs voted by user |
| `GET` | `getStats` | - | Returns aggregate system statistics |
| `GET` | `getBounties` | `ideaId` (optional) | Returns bounty pledge records (R4) |
| `GET` | `ping` | - | Health check |
| `POST` | `submitIdea` | `title`, `description`, `category`, `username`, `userId`, `force` | Submits idea with AI duplicate check (R1) |
| `POST` | `voteIdea` | `ideaId`, `userId`, `username` | Upvotes / unvotes idea |
| `POST` | `claimIdea` | `ideaId`, `userId`, `username` | Developer claims idea task (R2) |
| `POST` | `unclaimIdea` | `ideaId`, `userId` | Developer or Admin releases task (R2) |
| `POST` | `updateProgress`| `ideaId`, `status`, `milestone`, `extraLink`, `userId` | Updates progress & triggers beta notifications (R2, R3) |
| `POST` | `pledgeBounty` | `ideaId`, `userId`, `username`, `amount`, `unit`, `message` | Adds bounty pledge to idea (R4) |

### 4.2 Telegram Commands & Callbacks

| Type | Syntax / Callback Data | Authorization | Function & Behavior |
| :--- | :--- | :--- | :--- |
| Command | `/start`, `/help` | All | Displays system overview, Mini App button, help guide |
| Command | `/idea [Title] \| [Desc]` | All | Semantic AI duplicate check -> Create idea post |
| Command | `/top` | All | Top 5 ideas sorted by upvotes |
| Command | `/myideas` | All | Lists user's submitted ideas & development status |
| Command | `/claim [ID]` | Developer/All | Claims idea for development (R2) |
| Command | `/bounty [ID] [Amount] [Unit] \| [Note]` | All | Pledges bounty to idea (R4) |
| Command | `/status [ID] [Status]` | Admin/Manager/Assigned Dev | Updates status (triggers R3 notifications if Beta/Done) |
| Command | `/stats` | All | Community statistics (ideas, votes, bounties) |
| Callback | `vote_<id>` | All | Toggles upvote/unvote, updates message buttons |
| Callback | `info_<id>` | All | Detailed popup with dev progress and bounty details |
| Callback | `claim_<id>` | Developer/All | Assigns task to clicker, updates post UI (R2) |
| Callback | `unclaim_<id>` | Assigned Dev/Admin | Releases task back to open pool (R2) |
| Callback | `devbeta_<id>` | Assigned Dev/Admin | Sets status to Beta and triggers voter DMs (R2, R3) |
| Callback | `devdone_<id>` | Assigned Dev/Admin | Sets status to Done and triggers release DMs (R2, R3) |
| Callback | `bounty_<id>` | All | Prompts bounty pledge guide (R4) |
| Callback | `force_idea_<hash>` | Author | Force creates idea despite duplicate warning (R1) |

---

## 5. Caveats

1. **Telegram Privacy & DM Restrictions**: Telegram Bot API only allows sending Direct Messages (for Targeted Beta Notifications R3) to users who have previously sent `/start` to the bot in a private chat. If a voter only interacted in a group chat, direct `sendMessage` to their user ID will return `403 Forbidden: bot was blocked by the user` or `400 Bad Request: chat not found`. The implementation must catch this exception and optionally post a group mention fallback (e.g. `@username`) without crashing the batch notification loop.
2. **Google Apps Script Execution Quotas**: Apps Script has a 6-minute maximum execution timeout and UrlFetchApp quotas (20,000 calls/day for consumer Google accounts, 100,000/day for Google Workspace). For AI duplicate detection (R1) and Targeted Notifications (R3), API calls must be efficient (e.g. passing batch idea titles to LLM rather than 1 call per idea, and throttling DM notifications).
3. **AI Fallback**: If external API keys (`GEMINI_API_KEY` or `DEEPSEEK_API_KEY`) are omitted or invalid in the `Config` sheet, the system should gracefully fall back to local token-based Jaccard/Cosine similarity matching rather than failing the `/idea` command.
4. **Environment**: Investigation is conducted strictly in read-only mode. All proposed file updates, schemas, and test suites are mapped for downstream implementation agents.

---

## 6. Conclusion

- The existing ToolHunt repository is well-structured, modular, and has a functioning baseline covering basic upvoting, Telegram webhook handling, Google Sheets persistence, and web dashboard visualization.
- The 13 baseline unit tests in `scripts/test_simulator.js` provide a solid foundation that can be extended into a comprehensive enterprise simulator covering all R1–R5 capabilities.
- All 5 enterprise requirements (AI Duplicate Detection, Developer Task Claiming, Targeted Beta Notifications, Tool Bounty Mechanism, and Enterprise Dual-Platform Architecture) have clear integration points within `Code.js`, `SetupHelper.js`, `test_simulator.js`, `web-dashboard/index.html`, `app.js`, `styles.css`, and documentation.

---

## 7. Verification Method

To independently verify the survey observations and current state of the codebase:

1. **Verify Unit Test Simulator**:
   ```bash
   node scripts/test_simulator.js
   ```
   *Expected output*: 13 PASSED / 0 FAILED.
2. **Inspect Backend Files**:
   - Verify `google-apps-script/Code.js` lines 57–154 (`doGet`), 159–197 (`doPost`), 337–474 (`handleTelegramMessage`), 479–588 (`handleTelegramCallbackQuery`).
   - Verify `google-apps-script/SetupHelper.js` lines 26–84 (`initSpreadsheet` and headers).
3. **Inspect Frontend Files**:
   - Verify `web-dashboard/index.html` lines 50–146 (`ideasContainer`, filters, stats).
   - Verify `web-dashboard/app.js` lines 8–19 (`STATE`), 102–140 (`loadData`), 250–290 (`handleVote`).
4. **Verify Git Tree & Cleanliness**:
   ```bash
   git status
   ```
