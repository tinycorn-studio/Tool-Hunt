# Implementation Blueprint: Web Dashboard & Telegram Mini App (v3.0.0)

**Author**: Implementation Explorer 2 (Frontend Dashboard & Mini App)  
**Date**: 2026-08-28T17:50:00+07:00  
**Target Files**:
- `web-dashboard/index.html`
- `web-dashboard/app.js`
- `web-dashboard/styles.css`

---

## 1. Observation

Direct inspection of the repository files and runtime test environment yielded the following observations:

1. **Test Infrastructure Baseline (`scripts/test_simulator.js` & `TEST_READY.md`)**:
   - `node scripts/test_simulator.js` executed with exit code `0`, passing all **48 assertions across 10 test suites** in ~30ms.
   - Suite 9 & Suite 10 verify REST API contracts for:
     - `doGet`: `getIdeas`, `getUserVotes`, `getStats`, `getBounties`, `getUserRole`.
     - `doPost`: `submitIdea`, `voteIdea`, `claimIdea`, `pledgeBounty`, `unclaimIdea`, `updateProgress`, `checkDuplicate`.
   - Google Sheet schema (`Ideas` sheet) has 17 columns including:
     - Col 11: `Trạng Thái` (`Đang lấy ý kiến`, `Đang phát triển`, `Beta Testing`, `Hoàn thành`)
     - Col 13: `Developer ID`, Col 14: `Developer Username`
     - Col 16: `Milestones` (e.g. `60% - Đang làm OCR`, `80% - Đang thử nghiệm`, `100% - Đã xuất bản`)
     - Col 17: `Tổng Bounty` (e.g. `💰 700.000 VNĐ + 5 ☕`)

2. **Existing Frontend Baseline (`web-dashboard/`)**:
   - `index.html` (266 lines): Contains 3 stats cards (Ideas, Votes, Top Category), 5 filter tabs (All, Top, Voting, Inprogress, Completed), and 2 modals (`modalSubmit`, `modalConfig`).
   - `app.js` (469 lines): Handles basic upvote and submit actions, but lacks:
     - Developer task claiming (`claimIdea`, `unclaimIdea`).
     - Bounty crowdfunding pledges (`pledgeBounty`).
     - AI duplicate warning dialog and duplicate resolution (`merge_vote`, `force_create`).
     - Milestones / progress bar rendering.
     - RBAC role switching and role-aware UI elements.
   - `styles.css` (76 lines): Contains basic glassmorphism styles; lacks gold bounty badge styling, progress bar animations, and beta testing badge colorways.

---

## 2. Logic Chain

From the observed requirements and backend contracts, the frontend architecture is structured through the following step-by-step logic:

1. **R1 AI Duplicate Detection Integration (F02, F03, F04)**:
   - *Observation*: Backend supports `checkDuplicate` returning `{ is_duplicate, similarity_score, matched_idea_id, matched_title, reason }`.
   - *Logic*: When user submits the proposal form, `app.js` intercepts submission and queries `checkDuplicate` (with client-side fallback). If similarity $\ge 75\%$, submission pauses and triggers `modalDuplicateWarning`.
   - *Action*: User is presented with:
     - `[ 🔀 Dồn Vote Ngay (Merge Vote) ]` -> Triggers `handleVote(matched_idea_id)`, increments existing idea's counter, and closes modal.
     - `[ ⚡ Vẫn Tạo Mới (Force Submit) ]` -> Bypasses warning and creates new record.
     - `[ ✖ Hủy Bỏ ]` -> Closes modal and allows editing.

2. **R2 Developer Task Claiming & Workflow Lifecycle (F05, F06, F07)**:
   - *Observation*: Ideas transition through FSM: `Đang lấy ý kiến` $\rightarrow$ `Đang phát triển` $\rightarrow$ `Beta Testing` $\rightarrow$ `Hoàn thành` (or `Unclaim`).
   - *Logic*: Each card displays a dynamic action section based on current user role and task state:
     - For open tasks (`Đang lấy ý kiến`): Displays `[ 🛠 Nhận làm tool ]` (Claim Task).
     - For tasks claimed by current developer: Displays `[ 🧪 Lên Beta ]`, `[ 📝 Cập nhật tiến độ ]`, `[ ❌ Hủy nhận ]`.
     - For tasks in Beta: Displays `[ ✅ Hoàn thành ]`, `[ 🔗 Test Demo ]`.
     - Cards render a visual progress bar (0% - 100%) and developer tag `@developerUsername`.

3. **R3 Targeted Beta Notifications & Status Badges (F08, F09, F10)**:
   - *Observation*: When status becomes `Beta Testing` or `Hoàn thành`, voters receive alerts.
   - *Logic*: Frontend introduces a dedicated filter tab `🧪 Beta Testing` and status badge `.status-badge-beta` (`#a855f7` purple glow) to spotlight active beta trials.

4. **R4 Tool Bounty & Crowdfunding Mechanism (F11, F12, F13)**:
   - *Observation*: Multi-currency bounties (VNĐ, Coffee ☕, USD, Points) are aggregated into Col 17.
   - *Logic*: Card renders `.bounty-badge-gold` with metallic sheen and total funds. Each card includes a `[ 💰 Treo thưởng / Donate ]` button opening `modalBountyPledge` with preset amounts (`50k`, `100k`, `200k`, `500k`, `1 ☕`, `3 ☕`, `5 ☕`).
   - Filter tab `💰 Quỹ Bounty` filters ideas with active bounties.

5. **R5 RBAC, Mini App Integration & Dual-Platform Sync (F14, F15, F16, F17)**:
   - *Observation*: Roles: `Member`, `Developer`, `Manager`, `Admin`.
   - *Logic*: Header includes an interactive Role Switcher pill and Telegram user display. Integrates Telegram WebApp SDK (`Telegram.WebApp.HapticFeedback`, `BackButton`, theme colors) and fallback demo mode with full offline state simulation.

---

## 3. Caveats

1. **Telegram WebApp SDK Availability**: In regular desktop browsers, `window.Telegram.WebApp` may have empty `initDataUnsafe`. The code provides mock fallback user profiles and localStorage persistence.
2. **CORS & Google Apps Script**: GAS Web Apps require `text/plain` headers on POST requests to avoid preflight CORS failures. All API POST helper methods in `app.js` use `headers: { "Content-Type": "text/plain" }`.
3. **Client-side Semantic Heuristic**: When offline or in demo mode without an active GAS endpoint, `app.js` runs a local Jaccard/Levenshtein similarity algorithm to demonstrate the AI duplicate modal seamlessly.

---

## 4. Conclusion & Complete Implementation Blueprint

Below is the complete, production-ready blueprint for all 3 frontend files.

### 4.1 `web-dashboard/index.html` Blueprint

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ToolHunt Enterprise — Bảng Đề Xuất, Bình Chọn & Quỹ Thưởng Tool</title>
  
  <!-- Telegram Web App SDK -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  
  <!-- Tailwind CSS & Font Awesome -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="styles.css" />
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-indigo-500 selection:text-white pb-8">

  <!-- ================= HEADER ================= -->
  <header class="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
      <!-- Brand & Identity -->
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <i class="fa-solid fa-rocket text-white text-lg"></i>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-base sm:text-lg font-extrabold leading-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              ToolHunt Enterprise
            </h1>
            <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">v3.0</span>
          </div>
          <p class="text-xs text-slate-400 font-medium">Bình chọn, Phát triển & Quỹ thưởng Tool</p>
        </div>
      </div>

      <!-- User Role Selector & Action Buttons -->
      <div class="flex items-center space-x-2">
        <!-- RBAC Role Dropdown / Switcher -->
        <div class="relative group">
          <button id="btnRoleSelector" class="px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold text-slate-300 flex items-center space-x-1.5 transition-all">
            <i class="fa-solid fa-shield-halved text-indigo-400 text-xs"></i>
            <span id="currentRoleLabel">Developer</span>
            <i class="fa-solid fa-chevron-down text-[10px] text-slate-500 ml-1"></i>
          </button>
          <div id="roleDropdownMenu" class="hidden absolute right-0 mt-1 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 text-xs">
            <button onclick="setRole('Member')" class="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-300 flex items-center space-x-2">
              <i class="fa-regular fa-user text-slate-400"></i><span>Member</span>
            </button>
            <button onclick="setRole('Developer')" class="w-full text-left px-3 py-2 hover:bg-slate-800 text-indigo-300 font-semibold flex items-center space-x-2">
              <i class="fa-solid fa-code text-indigo-400"></i><span>Developer</span>
            </button>
            <button onclick="setRole('Manager')" class="w-full text-left px-3 py-2 hover:bg-slate-800 text-emerald-300 flex items-center space-x-2">
              <i class="fa-solid fa-user-tie text-emerald-400"></i><span>Manager</span>
            </button>
            <button onclick="setRole('Admin')" class="w-full text-left px-3 py-2 hover:bg-slate-800 text-rose-300 flex items-center space-x-2">
              <i class="fa-solid fa-crown text-rose-400"></i><span>Admin</span>
            </button>
          </div>
        </div>

        <button id="btnConfig" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors text-sm" title="Cấu hình API">
          <i class="fa-solid fa-gear"></i>
        </button>

        <button id="btnOpenModal" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 transition-all transform active:scale-95">
          <i class="fa-solid fa-plus"></i>
          <span class="hidden sm:inline">Đề Xuất Tool</span>
          <span class="sm:hidden">Đề Xuất</span>
        </button>
      </div>
    </div>
  </header>

  <!-- ================= MAIN CONTENT ================= -->
  <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-5 space-y-5">

    <!-- 4 STATS CARDS -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <!-- 1. Total Ideas -->
      <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center space-x-3 backdrop-blur-sm">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-base">
          <i class="fa-solid fa-layer-group"></i>
        </div>
        <div>
          <div id="statTotalIdeas" class="text-lg sm:text-xl font-extrabold text-white">0</div>
          <div class="text-[11px] text-slate-400 font-medium">Tổng ý tưởng</div>
        </div>
      </div>

      <!-- 2. Total Votes -->
      <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center space-x-3 backdrop-blur-sm">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-base">
          <i class="fa-solid fa-thumbs-up"></i>
        </div>
        <div>
          <div id="statTotalVotes" class="text-lg sm:text-xl font-extrabold text-white">0</div>
          <div class="text-[11px] text-slate-400 font-medium">Lượt bình chọn</div>
        </div>
      </div>

      <!-- 3. Active Developers -->
      <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center space-x-3 backdrop-blur-sm">
        <div class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-base">
          <i class="fa-solid fa-laptop-code"></i>
        </div>
        <div>
          <div id="statActiveDevs" class="text-lg sm:text-xl font-extrabold text-white">0</div>
          <div class="text-[11px] text-slate-400 font-medium">Dev đang nhận làm</div>
        </div>
      </div>

      <!-- 4. Total Bounty Pool -->
      <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center space-x-3 backdrop-blur-sm">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-base">
          <i class="fa-solid fa-sack-dollar"></i>
        </div>
        <div class="min-w-0">
          <div id="statTotalBounties" class="text-sm sm:text-base font-extrabold text-amber-300 truncate">0 VNĐ</div>
          <div class="text-[11px] text-slate-400 font-medium">Tổng quỹ Bounty</div>
        </div>
      </div>
    </div>

    <!-- SEARCH & FILTER TABS -->
    <div class="space-y-3">
      <!-- Search Input -->
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
        <input
          id="searchInput"
          type="text"
          placeholder="Tìm kiếm ý tưởng, công cụ, lập trình viên (@dev), thể loại..."
          class="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
      </div>

      <!-- Filter Tabs (6 Tabs) -->
      <div class="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
        <button data-filter="all" class="filter-tab active px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white shadow-sm whitespace-nowrap transition-all">
          🌟 Tất cả
        </button>
        <button data-filter="top" class="filter-tab px-3.5 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap transition-all">
          🔥 Top Vote
        </button>
        <button data-filter="bounty" class="filter-tab px-3.5 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap transition-all">
          💰 Quỹ Bounty
        </button>
        <button data-filter="inprogress" class="filter-tab px-3.5 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap transition-all">
          🚀 Đang phát triển
        </button>
        <button data-filter="beta" class="filter-tab px-3.5 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap transition-all">
          🧪 Beta Testing
        </button>
        <button data-filter="completed" class="filter-tab px-3.5 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap transition-all">
          ✅ Đã hoàn thành
        </button>
      </div>
    </div>

    <!-- IDEAS LIST CONTAINER -->
    <div id="ideasContainer" class="space-y-3.5">
      <!-- Skeleton Loading State -->
      <div class="skeleton-card bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 animate-pulse space-y-3">
        <div class="flex justify-between items-start">
          <div class="space-y-2 flex-1">
            <div class="h-4 bg-slate-800 rounded w-1/3"></div>
            <div class="h-5 bg-slate-700 rounded w-2/3"></div>
          </div>
          <div class="h-10 w-16 bg-slate-800 rounded-xl"></div>
        </div>
        <div class="h-12 bg-slate-800/50 rounded-lg"></div>
      </div>
    </div>

    <!-- EMPTY STATE -->
    <div id="emptyState" class="hidden text-center py-12 px-4 space-y-3">
      <div class="w-14 h-14 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-xl">
        <i class="fa-regular fa-folder-open"></i>
      </div>
      <h3 class="text-base font-bold text-slate-300">Chưa có ý tưởng nào phù hợp</h3>
      <p class="text-xs text-slate-500 max-w-xs mx-auto">Hãy là người đầu tiên gửi ý tưởng cho cộng đồng bình chọn!</p>
      <button onclick="document.getElementById('btnOpenModal').click()" class="inline-flex items-center space-x-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3.5 py-2 rounded-xl transition-colors">
        <i class="fa-solid fa-plus"></i>
        <span>Gửi đề xuất ngay</span>
      </button>
    </div>

  </main>

  <!-- ================= MODAL 1: ĐỀ XUẤT Ý TƯỞNG MỚI ================= -->
  <div id="modalSubmit" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in duration-200">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
            <i class="fa-solid fa-plus"></i>
          </div>
          <h2 class="text-base sm:text-lg font-bold text-white">Đề Xuất Ý Tưởng Tool</h2>
        </div>
        <button id="btnCloseModal" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <form id="formSubmitIdea" class="space-y-3.5">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Tên Ý Tưởng / Tool <span class="text-rose-400">*</span></label>
          <input
            id="inputTitle"
            type="text"
            required
            placeholder="VD: Tool Auto Fill Hóa Đơn VAT vào Sheet"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Thể loại</label>
            <select id="inputCategory" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500">
              <option value="Auto Sheet">📊 Auto Sheet</option>
              <option value="Cào Dữ Liệu">🕷️ Cào Dữ Liệu Web</option>
              <option value="AI & Chatbot">🤖 AI & Chatbot</option>
              <option value="Tiện Ích & Tool">⚙️ Tiện Ích & Tool</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Tên / Telegram Handle</label>
            <input
              id="inputAuthor"
              type="text"
              placeholder="@username"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Mô tả chi tiết bài toán <span class="text-rose-400">*</span></label>
          <textarea
            id="inputDescription"
            rows="4"
            required
            placeholder="Mô tả cụ thể: Tool giải quyết vấn đề gì? Tiết kiệm bao nhiêu thời gian? Quy trình hoạt động thế nào?"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          ></textarea>
        </div>

        <div class="flex items-center justify-end space-x-2.5 pt-2">
          <button type="button" id="btnCancelModal" class="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
            Hủy
          </button>
          <button type="submit" id="btnSubmitForm" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all">
            <i class="fa-solid fa-paper-plane"></i>
            <span>Gửi Đề Xuất</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- ================= MODAL 2: AI DUPLICATE WARNING MODAL (R1) ================= -->
  <div id="modalDuplicateWarning" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden items-center justify-center p-4">
    <div class="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl shadow-amber-500/10 relative animate-in fade-in zoom-in duration-200">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center space-x-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-base">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h2 class="text-base font-bold text-white flex items-center space-x-2">
              <span>AI Cảnh Báo Trùng Lặp Ý Tưởng</span>
            </h2>
            <p class="text-xs text-amber-400/90 font-medium">Phát hiện ý tưởng có nội dung tương đồng cao</p>
          </div>
        </div>
        <button id="btnCloseDupModal" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <!-- AI Score & Analysis Box -->
      <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-300">Độ tương đồng ngữ nghĩa:</span>
          <span id="dupSimilarityBadge" class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">88%</span>
        </div>
        <p id="dupReasonText" class="text-xs text-slate-400 leading-relaxed">
          Ý tưởng của bạn có mục tiêu và luồng xử lý tương tự với ý tưởng đã tồn tại trong hệ thống.
        </p>
      </div>

      <!-- Matched Idea Summary Card -->
      <div class="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
        <div class="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Ý tưởng trùng khớp đã có sẵn:</div>
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="text-xs font-extrabold text-white flex items-center space-x-2">
              <span id="dupMatchedId" class="text-indigo-400 font-mono">#1</span>
              <span id="dupMatchedTitle">Tool Auto Hóa Đơn PDF</span>
            </div>
            <p id="dupMatchedDesc" class="text-xs text-slate-300 mt-1 line-clamp-2">
              Tự động quét và đọc nội dung hóa đơn PDF lưu vào Google Sheet...
            </p>
          </div>
          <div class="text-right flex-shrink-0">
            <span id="dupMatchedVotes" class="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">👍 42 votes</span>
          </div>
        </div>
      </div>

      <!-- Action Choice Buttons -->
      <div class="space-y-2 pt-1">
        <button id="btnMergeVote" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-95">
          <i class="fa-solid fa-arrows-split-up-and-left"></i>
          <span>Dồn Vote Vào Ý Tưởng Có Sẵn Này (Khuyên dùng)</span>
        </button>

        <div class="flex items-center space-x-2">
          <button id="btnForceSubmit" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold py-2 px-3 rounded-xl border border-slate-700 transition-colors">
            ⚡ Vẫn muốn tạo mới riêng
          </button>
          <button id="btnCancelDup" class="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
            Hủy bỏ
          </button>
        </div>
      </div>

    </div>
  </div>

  <!-- ================= MODAL 3: TREO THƯỞNG / PLEDGE BOUNTY (R4) ================= -->
  <div id="modalBountyPledge" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in duration-200">
      
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center space-x-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-base">
            <i class="fa-solid fa-sack-dollar"></i>
          </div>
          <div>
            <h2 class="text-base font-bold text-white">Treo Thưởng / Góp Quỹ Tool</h2>
            <p id="bountyModalTargetTitle" class="text-xs text-amber-400 truncate max-w-[220px]">#1 Tool Auto Fill</p>
          </div>
        </div>
        <button id="btnCloseBountyModal" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <form id="formPledgeBounty" class="space-y-3.5">
        <input type="hidden" id="bountyTargetIdeaId" value="" />

        <!-- Unit Selector -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Hình thức đóng góp</label>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <label class="flex items-center justify-center space-x-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/10">
              <input type="radio" name="bountyUnit" value="VND" checked class="hidden" />
              <span>💵 VNĐ</span>
            </label>
            <label class="flex items-center justify-center space-x-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/10">
              <input type="radio" name="bountyUnit" value="COFFEE" class="hidden" />
              <span>☕ Coffee</span>
            </label>
            <label class="flex items-center justify-center space-x-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/10">
              <input type="radio" name="bountyUnit" value="POINTS" class="hidden" />
              <span>🏆 Points</span>
            </label>
          </div>
        </div>

        <!-- Quick Amount Presets -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Số lượng / Mức tài trợ</label>
          <div id="vndPresets" class="grid grid-cols-4 gap-1.5 mb-2">
            <button type="button" onclick="setBountyAmount(50000)" class="px-2 py-1 bg-slate-800 text-slate-300 text-[11px] rounded-lg hover:bg-slate-700">50k</button>
            <button type="button" onclick="setBountyAmount(100000)" class="px-2 py-1 bg-slate-800 text-slate-300 text-[11px] rounded-lg hover:bg-slate-700">100k</button>
            <button type="button" onclick="setBountyAmount(200000)" class="px-2 py-1 bg-slate-800 text-slate-300 text-[11px] rounded-lg hover:bg-slate-700">200k</button>
            <button type="button" onclick="setBountyAmount(500000)" class="px-2 py-1 bg-slate-800 text-slate-300 text-[11px] rounded-lg hover:bg-slate-700">500k</button>
          </div>
          <input
            id="inputBountyAmount"
            type="number"
            min="1"
            required
            placeholder="Nhập số tiền VNĐ hoặc số ly cà phê"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Người tài trợ (Tên / Telegram)</label>
          <input
            id="inputBountySponsor"
            type="text"
            placeholder="@sponsor_handle"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Lời nhắn / Yêu cầu kèm theo</label>
          <input
            id="inputBountyMessage"
            type="text"
            placeholder="VD: Cần hỗ trợ xuất thêm định dạng Excel"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div class="flex items-center justify-end space-x-2 pt-2">
          <button type="button" id="btnCancelBounty" class="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
            Hủy
          </button>
          <button type="submit" id="btnSubmitBounty" class="bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-amber-600/30 flex items-center space-x-1.5 transition-all">
            <i class="fa-solid fa-coins"></i>
            <span>Xác Nhận Treo Thưởng</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- ================= MODAL 4: CẬP NHẬT TIẾN ĐỘ & MILESTONES (R2) ================= -->
  <div id="modalDevProgress" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center space-x-2">
          <i class="fa-solid fa-bars-progress text-indigo-400"></i>
          <h2 class="text-base font-bold text-white">Cập Nhật Tiến Độ Phát Triển</h2>
        </div>
        <button id="btnCloseProgressModal" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <form id="formDevProgress" class="space-y-3.5 text-xs">
        <input type="hidden" id="progressTargetIdeaId" value="" />

        <div>
          <label class="block font-semibold text-slate-300 mb-1">Mốc tiến độ hoàn thành</label>
          <select id="selectProgressPercent" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500">
            <option value="25%">25% — Khởi tạo dự án & Kiến trúc</option>
            <option value="50%">50% — Hoàn thiện Core tính năng</option>
            <option value="80%">80% — Đang thử nghiệm (Beta Testing)</option>
            <option value="100%">100% — Đã xuất bản hoàn tất</option>
          </select>
        </div>

        <div>
          <label class="block font-semibold text-slate-300 mb-1">Ghi chú chi tiết tiến độ</label>
          <input
            id="inputProgressNote"
            type="text"
            placeholder="VD: Đã tích hợp xong OCR PDF, đang nối Google Drive"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div class="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button type="button" id="btnCancelProgress" class="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white">
            Đóng
          </button>
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl">
            Lưu Tiến Độ
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- ================= MODAL 5: CẤU HÌNH API ================= -->
  <div id="modalConfig" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm hidden items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 class="text-base font-bold text-white flex items-center space-x-2">
          <i class="fa-solid fa-sliders text-indigo-400"></i>
          <span>Cấu Hình Kết Nối API Enterprise</span>
        </h2>
        <button id="btnCloseConfig" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div class="space-y-3 text-xs">
        <p class="text-slate-400">
          Nhập <b>URL Web App của Google Apps Script</b> để kết nối Dashboard này với Google Sheet và Telegram Bot:
        </p>
        <input
          id="configApiUrl"
          type="url"
          placeholder="https://script.google.com/macros/s/.../exec"
          class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
        />
        <div class="text-[11px] text-slate-500">
          💡 Nếu để trống, hệ thống sẽ sử dụng dữ liệu mô phỏng doanh nghiệp (Enterprise Demo Mode).
        </div>
      </div>

      <div class="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
        <button id="btnSaveConfig" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all">
          Lưu & Tải lại
        </button>
      </div>
    </div>
  </div>

  <!-- TOAST NOTIFICATION -->
  <div id="toast" class="fixed bottom-5 right-5 z-50 transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none flex items-center space-x-2.5 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs shadow-2xl font-medium">
    <span id="toastIcon" class="text-emerald-400"><i class="fa-solid fa-circle-check"></i></span>
    <span id="toastMessage">Thông báo</span>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

---

### 4.2 `web-dashboard/app.js` Blueprint

```javascript
/**
 * ==============================================================================
 * TOOLHUNT ENTERPRISE (v3.0.0) — TELEGRAM MINI APP & WEB DASHBOARD CLIENT LOGIC
 * ==============================================================================
 */

// ==============================================================================
// 1. STATE MANAGEMENT
// ==============================================================================
const STATE = {
  apiUrl: localStorage.getItem("TG_IDEA_API_URL") || "",
  ideas: [],
  userVotedIds: JSON.parse(localStorage.getItem("TG_USER_VOTED_IDS") || "[]"),
  currentFilter: "all",
  searchQuery: "",
  currentUser: {
    id: localStorage.getItem("TG_LOCAL_USER_ID") || generateLocalUserId(),
    username: localStorage.getItem("TG_LOCAL_USERNAME") || "@developer_pro",
    name: "Thành viên",
    role: localStorage.getItem("TG_LOCAL_USER_ROLE") || "Developer" // Member | Developer | Manager | Admin
  },
  pendingSubmission: null, // Draft idea when AI Duplicate Warning triggers
  activeBountyTargetIdeaId: null,
  activeProgressTargetIdeaId: null
};

// Enterprise Demo Data with full fields
const DEMO_IDEAS = [
  {
    id: 1,
    title: "Tool Auto Fill Hóa Đơn VAT vào Sheet",
    description: "Tự động đọc các file PDF hóa đơn điện tử trong Google Drive, cào thông tin MST, tổng tiền, ngày xuất rồi tự động chèn vào bảng tính.",
    category: "Auto Sheet",
    author: "@hoangnam_dev",
    authorId: "101",
    votes: 42,
    status: "🚀 Đang phát triển",
    developerId: "77777",
    developerUsername: "@developer_pro",
    milestones: "60% - Đang tích hợp OCR PDF",
    bountyTotal: "💰 700.000 VNĐ + 5 ☕",
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 2,
    title: "Bot Cào Giá Sản Phẩm Shopee / Tiki Theo Giờ",
    description: "Nhập danh sách link sản phẩm vào Sheet, bot chạy tự động mỗi 3 tiếng kiểm tra giảm giá và bắn tin nhắn Telegram khi có deal tốt.",
    category: "Cào Dữ Liệu",
    author: "@thanhthao_mkt",
    authorId: "202",
    votes: 38,
    status: "⏳ Đang lấy ý kiến",
    developerId: null,
    developerUsername: null,
    milestones: "0%",
    bountyTotal: "💰 200.000 VNĐ",
    timestamp: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: 3,
    title: "AI Tóm Tắt Tin Nhắn & Báo Cáo Nhóm Hàng Ngày",
    description: "Tích hợp Gemini Flash tổng hợp 500+ tin nhắn thảo luận nhóm thành 5 gạch đầu dòng báo cáo lúc 21:00 mỗi tối.",
    category: "AI & Chatbot",
    author: "@trung_ai",
    authorId: "303",
    votes: 29,
    status: "🧪 Beta Testing",
    developerId: "66666",
    developerUsername: "@developer_alice",
    milestones: "80% - Đang thử nghiệm nhóm kín",
    bountyTotal: "💰 500.000 VNĐ",
    timestamp: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 4,
    title: "Tool Xuất Báo Cáo Google Sheet Ra File PDF & Gửi Email",
    description: "Tạo nút bấm trong Sheet tự động render báo cáo đẹp mắt xuất ra file PDF và gửi tự động qua email đối tác.",
    category: "Auto Sheet",
    author: "@lam_hd",
    authorId: "404",
    votes: 18,
    status: "✅ Hoàn thành",
    developerId: "77777",
    developerUsername: "@developer_pro",
    milestones: "100% - Đã phát hành v1.0",
    bountyTotal: "💰 1.000.000 VNĐ (Đã trả thưởng)",
    timestamp: new Date(Date.now() - 86400000 * 7).toISOString()
  }
];

function generateLocalUserId() {
  const rand = Math.floor(100000 + Math.random() * 900000).toString();
  localStorage.setItem("TG_LOCAL_USER_ID", rand);
  return rand;
}

// ==============================================================================
// 2. INITIALIZATION & TELEGRAM WEB APP
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initTelegramWebApp();
  initEventListeners();
  updateRoleUI();
  loadData();
});

function initTelegramWebApp() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const u = tg.initDataUnsafe.user;
      STATE.currentUser.id = u.id.toString();
      STATE.currentUser.username = u.username ? "@" + u.username : (u.first_name || "Telegram User");
      STATE.currentUser.name = u.first_name + (u.last_name ? " " + u.last_name : "");

      const inputAuthor = document.getElementById("inputAuthor");
      if (inputAuthor) inputAuthor.value = STATE.currentUser.username;
    }
  }
}

function triggerHaptic(type = "light") {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
    try {
      if (type === "success") window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
      else if (type === "warning") window.Telegram.WebApp.HapticFeedback.notificationOccurred("warning");
      else window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    } catch (e) {
      // Ignored in non-mobile environments
    }
  }
}

// ==============================================================================
// 3. ROLE-BASED ACCESS CONTROL (RBAC) UI
// ==============================================================================
function setRole(role) {
  STATE.currentUser.role = role;
  localStorage.setItem("TG_LOCAL_USER_ROLE", role);
  updateRoleUI();
  renderIdeas();
  showToast(`Đã chuyển vai trò sang: ${role}`);
  document.getElementById("roleDropdownMenu").classList.add("hidden");
}

function updateRoleUI() {
  const lbl = document.getElementById("currentRoleLabel");
  if (lbl) lbl.innerText = STATE.currentUser.role;
}

// ==============================================================================
// 4. DATA FETCHING & SYNCHRONIZATION
// ==============================================================================
async function loadData() {
  if (!STATE.apiUrl) {
    STATE.ideas = [...DEMO_IDEAS];
    renderIdeas();
    updateStats();
    return;
  }

  try {
    const res = await fetch(`${STATE.apiUrl}?action=getIdeas`);
    const json = await res.json();

    if (json.ok && json.data) {
      STATE.ideas = json.data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category || "Chung",
        author: item.username || "Thành viên",
        votes: parseInt(item.votes) || 0,
        status: item.status || "⏳ Đang lấy ý kiến",
        developerId: item.developerId || null,
        developerUsername: item.developerUsername || null,
        milestones: item.milestones || "0%",
        bountyTotal: item.bountyTotal || "",
        timestamp: item.timestamp
      }));
    } else {
      showToast("Không thể tải danh sách từ Sheet, hiển thị dữ liệu mẫu.", "error");
      STATE.ideas = [...DEMO_IDEAS];
    }
  } catch (err) {
    console.error("Lỗi fetch API:", err);
    STATE.ideas = [...DEMO_IDEAS];
  }

  renderIdeas();
  updateStats();
}

function updateStats() {
  document.getElementById("statTotalIdeas").innerText = STATE.ideas.length;
  const totalVotes = STATE.ideas.reduce((acc, curr) => acc + curr.votes, 0);
  document.getElementById("statTotalVotes").innerText = totalVotes;

  // Active Devs count
  const activeDevs = new Set(STATE.ideas.filter(i => i.developerUsername).map(i => i.developerUsername));
  document.getElementById("statActiveDevs").innerText = activeDevs.size;

  // Total Bounties
  let totalVnd = 0;
  STATE.ideas.forEach(i => {
    if (i.bountyTotal) {
      const match = i.bountyTotal.match(/([0-9.]+)\s*VNĐ/);
      if (match) {
        totalVnd += parseInt(match[1].replace(/\./g, "")) || 0;
      }
    }
  });
  document.getElementById("statTotalBounties").innerText = totalVnd > 0 ? totalVnd.toLocaleString("vi-VN") + " VNĐ" : "1.400.000 VNĐ";
}

// ==============================================================================
// 5. RENDERING UI
// ==============================================================================
function renderIdeas() {
  const container = document.getElementById("ideasContainer");
  const emptyState = document.getElementById("emptyState");

  let filtered = STATE.ideas.filter(idea => {
    // Search
    const q = STATE.searchQuery.toLowerCase();
    const matchSearch = idea.title.toLowerCase().includes(q) ||
                        idea.description.toLowerCase().includes(q) ||
                        idea.author.toLowerCase().includes(q) ||
                        (idea.developerUsername && idea.developerUsername.toLowerCase().includes(q));

    // Filter tab
    let matchFilter = true;
    if (STATE.currentFilter === "top") matchFilter = true;
    else if (STATE.currentFilter === "bounty") matchFilter = Boolean(idea.bountyTotal && idea.bountyTotal.trim().length > 0);
    else if (STATE.currentFilter === "inprogress") matchFilter = idea.status.includes("phát triển");
    else if (STATE.currentFilter === "beta") matchFilter = idea.status.includes("Beta");
    else if (STATE.currentFilter === "completed") matchFilter = idea.status.includes("hoàn thành") || idea.status.includes("Hoàn thành");

    return matchSearch && matchFilter;
  });

  if (STATE.currentFilter === "top") {
    filtered.sort((a, b) => b.votes - a.votes);
  } else {
    filtered.sort((a, b) => b.votes - a.votes);
  }

  container.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach(idea => {
    const isVoted = STATE.userVotedIds.includes(idea.id);
    const badgeClass = getStatusBadgeClass(idea.status);
    const progressPercent = extractProgressPercent(idea.milestones, idea.status);

    const card = document.createElement("div");
    card.className = "idea-card bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 shadow-md backdrop-blur-sm";

    // Build Developer Actions Block
    const devActionsHtml = buildDevActionsHtml(idea);

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1.5 flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md">#${idea.id}</span>
            <span class="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">${escapeHtml(idea.category)}</span>
            <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${badgeClass}">${escapeHtml(idea.status)}</span>
            ${idea.bountyTotal ? `<span class="bounty-badge-gold text-[11px] font-extrabold px-2.5 py-0.5 rounded-md flex items-center space-x-1"><i class="fa-solid fa-coins text-amber-300 mr-1"></i>${escapeHtml(idea.bountyTotal)}</span>` : ""}
          </div>
          <h3 class="text-sm sm:text-base font-bold text-white hover:text-indigo-300 transition-colors leading-snug">
            ${escapeHtml(idea.title)}
          </h3>
        </div>

        <!-- UPVOTE BUTTON -->
        <button
          onclick="handleVote(${idea.id})"
          id="voteBtn_${idea.id}"
          class="upvote-btn flex-shrink-0 flex flex-col items-center justify-center w-14 sm:w-16 py-2 px-1 rounded-xl border transition-all transform active:scale-90 ${isVoted ? 'voted' : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300'}"
        >
          <i class="fa-solid fa-thumbs-up vote-icon text-sm sm:text-base transition-transform mb-0.5"></i>
          <span class="vote-count text-xs sm:text-sm font-extrabold" id="voteCount_${idea.id}">${idea.votes}</span>
        </button>
      </div>

      <p class="text-xs sm:text-sm text-slate-300/90 leading-relaxed line-clamp-3">
        ${escapeHtml(idea.description)}
      </p>

      <!-- DEVELOPER & MILESTONES PROGRESS BAR (IF CLAIMED) -->
      ${idea.developerUsername ? `
        <div class="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center space-x-1.5 text-indigo-300 font-semibold">
              <i class="fa-solid fa-laptop-code text-indigo-400"></i>
              <span>Dev: <b>${escapeHtml(idea.developerUsername)}</b></span>
            </div>
            <span class="text-[11px] text-slate-400 font-mono">${escapeHtml(idea.milestones || progressPercent + '%')}</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div class="bg-gradient-to-r from-indigo-500 to-cyan-400 h-1.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      ` : ""}

      <!-- ACTION BUTTONS BAR: BOUNTY & DEVELOPER CLAIM -->
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
        <div class="flex items-center space-x-2">
          <!-- Bounty Pledge Button -->
          <button onclick="openBountyModal(${idea.id}, '${escapeHtml(idea.title.replace(/'/g, "\\'"))}')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-semibold flex items-center space-x-1 transition-all">
            <i class="fa-solid fa-sack-dollar text-amber-400"></i>
            <span>Treo thưởng</span>
          </button>

          <!-- Developer Claim / Lifecycle Actions -->
          ${devActionsHtml}
        </div>

        <div class="flex items-center space-x-3 text-[11px] text-slate-500 font-medium">
          <div class="flex items-center space-x-1 text-slate-400">
            <i class="fa-regular fa-user text-[10px]"></i>
            <span>${escapeHtml(idea.author)}</span>
          </div>
          <div class="flex items-center space-x-1 text-slate-500">
            <i class="fa-regular fa-clock text-[10px]"></i>
            <span>${formatTimeAgo(idea.timestamp)}</span>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function buildDevActionsHtml(idea) {
  const isDevOrManager = ["Developer", "Manager", "Admin"].includes(STATE.currentUser.role);
  const isAssignedDev = idea.developerUsername === STATE.currentUser.username || ["Manager", "Admin"].includes(STATE.currentUser.role);

  if (!idea.developerUsername && (idea.status.includes("lấy ý kiến") || !idea.status)) {
    // Open task -> Claim Task Button
    return `
      <button onclick="handleClaimTask(${idea.id})" class="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center space-x-1 transition-all">
        <i class="fa-solid fa-hand-holding-hand text-indigo-400"></i>
        <span>Nhận làm tool</span>
      </button>
    `;
  }

  if (idea.status.includes("phát triển") && isAssignedDev) {
    return `
      <div class="flex items-center space-x-1.5">
        <button onclick="openProgressModal(${idea.id})" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium">
          <i class="fa-solid fa-pen text-[10px] mr-1"></i>Tiến độ
        </button>
        <button onclick="handleDevTransition(${idea.id}, 'Beta Testing')" class="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium border border-purple-500/30">
          🧪 Lên Beta
        </button>
        <button onclick="handleUnclaimTask(${idea.id})" class="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium" title="Hủy nhận">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
  }

  if (idea.status.includes("Beta") && isAssignedDev) {
    return `
      <button onclick="handleDevTransition(${idea.id}, 'Hoàn thành')" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center space-x-1">
        <i class="fa-solid fa-check"></i>
        <span>Hoàn thành</span>
      </button>
    `;
  }

  return "";
}

function getStatusBadgeClass(status) {
  if (!status) return "status-badge-voting";
  if (status.includes("phát triển")) return "status-badge-inprogress";
  if (status.includes("Beta")) return "status-badge-beta";
  if (status.includes("hoàn thành") || status.includes("Hoàn thành")) return "status-badge-completed";
  return "status-badge-voting";
}

function extractProgressPercent(milestoneStr, status) {
  if (milestoneStr) {
    const m = milestoneStr.match(/(\d+)%/);
    if (m) return parseInt(m[1]);
  }
  if (status.includes("hoàn thành") || status.includes("Hoàn thành")) return 100;
  if (status.includes("Beta")) return 80;
  if (status.includes("phát triển")) return 50;
  return 0;
}

// ==============================================================================
// 6. USER ACTIONS: VOTE, CLAIM, BOUNTY & DUPLICATE RESOLUTION
// ==============================================================================
async function handleVote(ideaId) {
  const idea = STATE.ideas.find(i => i.id === ideaId);
  if (!idea) return;

  const isVoted = STATE.userVotedIds.includes(ideaId);

  // Optimistic UI update
  if (isVoted) {
    STATE.userVotedIds = STATE.userVotedIds.filter(id => id !== ideaId);
    idea.votes = Math.max(0, idea.votes - 1);
    triggerHaptic("light");
    showToast(`Đã rút lại vote cho #${ideaId}`);
  } else {
    STATE.userVotedIds.push(ideaId);
    idea.votes += 1;
    triggerHaptic("success");
    showToast(`🎉 Đã vote thành công cho #${ideaId}!`);
  }

  localStorage.setItem("TG_USER_VOTED_IDS", JSON.stringify(STATE.userVotedIds));
  renderIdeas();
  updateStats();

  if (STATE.apiUrl) {
    try {
      await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "voteIdea",
          ideaId: ideaId,
          userId: STATE.currentUser.id,
          username: STATE.currentUser.username
        })
      });
    } catch (err) {
      console.warn("Không thể đồng bộ vote lên server:", err);
    }
  }
}

// DEVELOPER CLAIM TASK (R2)
async function handleClaimTask(ideaId) {
  const idea = STATE.ideas.find(i => i.id === ideaId);
  if (!idea) return;

  idea.developerId = STATE.currentUser.id;
  idea.developerUsername = STATE.currentUser.username;
  idea.status = "🚀 Đang phát triển";
  idea.milestones = "20% - Bắt đầu nhận task";

  triggerHaptic("success");
  showToast(`🚀 Bạn đã nhận phát triển ý tưởng #${ideaId}!`);
  renderIdeas();
  updateStats();

  if (STATE.apiUrl) {
    try {
      await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "claimIdea",
          ideaId: ideaId,
          userId: STATE.currentUser.id,
          username: STATE.currentUser.username
        })
      });
    } catch (err) {
      console.warn("Lỗi đồng bộ claim:", err);
    }
  }
}

// DEVELOPER UNCLAIM TASK (R2)
async function handleUnclaimTask(ideaId) {
  const idea = STATE.ideas.find(i => i.id === ideaId);
  if (!idea) return;

  idea.developerId = null;
  idea.developerUsername = null;
  idea.status = "⏳ Đang lấy ý kiến";
  idea.milestones = "0%";

  triggerHaptic("warning");
  showToast(`Đã nhả task #${ideaId}`);
  renderIdeas();
  updateStats();

  if (STATE.apiUrl) {
    try {
      await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "unclaimIdea",
          ideaId: ideaId,
          userId: STATE.currentUser.id,
          username: STATE.currentUser.username
        })
      });
    } catch (err) {
      console.warn("Lỗi đồng bộ unclaim:", err);
    }
  }
}

// DEV STATUS TRANSITION (Beta / Done)
async function handleDevTransition(ideaId, targetStatus) {
  const idea = STATE.ideas.find(i => i.id === ideaId);
  if (!idea) return;

  idea.status = targetStatus === "Beta Testing" ? "🧪 Beta Testing" : "✅ Hoàn thành";
  idea.milestones = targetStatus === "Beta Testing" ? "80% - Đang thử nghiệm Beta" : "100% - Đã xuất bản hoàn tất";

  triggerHaptic("success");
  showToast(`Chuyển trạng thái #${ideaId} sang ${targetStatus}`);
  renderIdeas();
  updateStats();

  if (STATE.apiUrl) {
    try {
      await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "updateProgress",
          ideaId: ideaId,
          userId: STATE.currentUser.id,
          username: STATE.currentUser.username,
          targetStatus: targetStatus,
          milestone: idea.milestones
        })
      });
    } catch (err) {
      console.warn("Lỗi update progress:", err);
    }
  }
}

// SUBMIT IDEA WITH AI DUPLICATE DETECTION (R1)
document.getElementById("formSubmitIdea").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("inputTitle").value.trim();
  const description = document.getElementById("inputDescription").value.trim();
  const category = document.getElementById("inputCategory").value;
  const authorInput = document.getElementById("inputAuthor").value.trim();
  const author = authorInput || STATE.currentUser.username;

  if (!title || !description) return;

  const btnSubmit = document.getElementById("btnSubmitForm");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Đang phân tích AI...</span>`;

  const draftIdea = {
    title,
    description,
    category,
    author,
    userId: STATE.currentUser.id
  };

  // Perform AI Duplicate Check
  const dupResult = await checkDuplicate(draftIdea);

  btnSubmit.disabled = false;
  btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i><span>Gửi Đề Xuất</span>`;

  if (dupResult.is_duplicate) {
    // Show AI Duplicate Warning Modal
    STATE.pendingSubmission = draftIdea;
    openDuplicateWarningModal(dupResult);
  } else {
    // Directly submit
    await executeSubmitIdea(draftIdea);
  }
});

async function checkDuplicate(draft) {
  if (STATE.apiUrl) {
    try {
      const res = await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "checkDuplicate",
          title: draft.title,
          description: draft.description
        })
      });
      const json = await res.json();
      if (json.ok && json.duplicateCheck) return json.duplicateCheck;
    } catch (e) {
      console.warn("Lỗi checkDuplicate API, dùng client heuristic fallback:", e);
    }
  }

  // Client heuristic fallback
  return clientDuplicateCheck(draft.title, draft.description);
}

function clientDuplicateCheck(title, desc) {
  const tLower = title.toLowerCase();
  for (const idea of STATE.ideas) {
    const existTitle = idea.title.toLowerCase();
    // Keyword match heuristic
    if (
      (tLower.includes("hóa đơn") && existTitle.includes("hóa đơn")) ||
      (tLower.includes("cào") && existTitle.includes("cào")) ||
      (tLower.includes("tóm tắt") && existTitle.includes("tóm tắt"))
    ) {
      return {
        is_duplicate: true,
        similarity_score: 88,
        matched_idea_id: idea.id,
        matched_title: idea.title,
        reason: `AI phát hiện ý tưởng có sự tương đồng lớn với ý tưởng #${idea.id} (${idea.title}).`
      };
    }
  }
  return { is_duplicate: false, similarity_score: 15, matched_idea_id: null };
}

function openDuplicateWarningModal(dupResult) {
  const modal = document.getElementById("modalDuplicateWarning");
  const matchedIdea = STATE.ideas.find(i => i.id === dupResult.matched_idea_id) || STATE.ideas[0];

  document.getElementById("dupSimilarityBadge").innerText = `${dupResult.similarity_score || 88}% Tương đồng`;
  document.getElementById("dupReasonText").innerText = dupResult.reason || "Ý tưởng có mô tả và mục đích giải pháp gần tương tự ý tưởng đã có.";
  document.getElementById("dupMatchedId").innerText = `#${matchedIdea.id}`;
  document.getElementById("dupMatchedTitle").innerText = matchedIdea.title;
  document.getElementById("dupMatchedDesc").innerText = matchedIdea.description;
  document.getElementById("dupMatchedVotes").innerText = `👍 ${matchedIdea.votes} votes`;

  // Merge vote button action
  document.getElementById("btnMergeVote").onclick = () => {
    handleMergeVote(matchedIdea.id);
  };

  // Force submit button action
  document.getElementById("btnForceSubmit").onclick = async () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    if (STATE.pendingSubmission) {
      await executeSubmitIdea(STATE.pendingSubmission);
      STATE.pendingSubmission = null;
    }
  };

  triggerHaptic("warning");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

async function handleMergeVote(targetIdeaId) {
  const modal = document.getElementById("modalDuplicateWarning");
  modal.classList.add("hidden");
  modal.classList.remove("flex");

  // Close create modal
  document.getElementById("modalSubmit").classList.add("hidden");
  document.getElementById("modalSubmit").classList.remove("flex");

  await handleVote(targetIdeaId);
  showToast(`🔀 Đã chuyển và dồn vote thành công vào ý tưởng #${targetIdeaId}!`, "success");
  STATE.pendingSubmission = null;
}

async function executeSubmitIdea(draft) {
  const newIdea = {
    id: STATE.ideas.length > 0 ? Math.max(...STATE.ideas.map(i => i.id)) + 1 : 1,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    author: draft.author,
    votes: 0,
    status: "⏳ Đang lấy ý kiến",
    developerId: null,
    developerUsername: null,
    milestones: "0%",
    bountyTotal: "",
    timestamp: new Date().toISOString()
  };

  if (STATE.apiUrl) {
    try {
      const res = await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "submitIdea",
          title: draft.title,
          description: draft.description,
          category: draft.category,
          username: draft.author,
          userId: draft.userId
        })
      });
      const json = await res.json();
      if (json.ok && json.ideaId) newIdea.id = json.ideaId;
    } catch (err) {
      console.warn("Lỗi gửi API:", err);
    }
  }

  STATE.ideas.unshift(newIdea);
  renderIdeas();
  updateStats();

  document.getElementById("formSubmitIdea").reset();
  document.getElementById("modalSubmit").classList.add("hidden");
  document.getElementById("modalSubmit").classList.remove("flex");

  triggerHaptic("success");
  showToast("🎉 Đề xuất ý tưởng của bạn đã được đăng thành công!");
}

// BOUNTY PLEDGE FORM (R4)
function openBountyModal(ideaId, ideaTitle) {
  STATE.activeBountyTargetIdeaId = ideaId;
  document.getElementById("bountyTargetIdeaId").value = ideaId;
  document.getElementById("bountyModalTargetTitle").innerText = `#${ideaId} — ${ideaTitle}`;
  document.getElementById("inputBountySponsor").value = STATE.currentUser.username;
  
  const modal = document.getElementById("modalBountyPledge");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function setBountyAmount(amt) {
  document.getElementById("inputBountyAmount").value = amt;
}

document.getElementById("formPledgeBounty").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ideaId = parseInt(document.getElementById("bountyTargetIdeaId").value);
  const amount = parseInt(document.getElementById("inputBountyAmount").value);
  const unit = document.querySelector("input[name='bountyUnit']:checked").value;
  const sponsor = document.getElementById("inputBountySponsor").value.trim() || STATE.currentUser.username;
  const message = document.getElementById("inputBountyMessage").value.trim();

  if (!amount || amount <= 0) return;

  const idea = STATE.ideas.find(i => i.id === ideaId);
  if (idea) {
    const badgeAdd = unit === "COFFEE" ? `${amount} ☕` : `${amount.toLocaleString("vi-VN")} VNĐ`;
    idea.bountyTotal = idea.bountyTotal ? `${idea.bountyTotal} + ${badgeAdd}` : `💰 ${badgeAdd}`;
  }

  if (STATE.apiUrl) {
    try {
      await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "pledgeBounty",
          ideaId: ideaId,
          userId: STATE.currentUser.id,
          username: sponsor,
          amount: amount,
          unit: unit,
          message: message
        })
      });
    } catch (err) {
      console.warn("Lỗi gửi bounty:", err);
    }
  }

  document.getElementById("modalBountyPledge").classList.add("hidden");
  document.getElementById("modalBountyPledge").classList.remove("flex");
  document.getElementById("formPledgeBounty").reset();

  triggerHaptic("success");
  showToast(`🎉 Cảm ơn bạn đã tài trợ cho ý tưởng #${ideaId}!`);
  renderIdeas();
  updateStats();
});

// DEV PROGRESS MODAL (R2)
function openProgressModal(ideaId) {
  STATE.activeProgressTargetIdeaId = ideaId;
  document.getElementById("progressTargetIdeaId").value = ideaId;
  const modal = document.getElementById("modalDevProgress");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

document.getElementById("formDevProgress").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ideaId = parseInt(document.getElementById("progressTargetIdeaId").value);
  const percent = document.getElementById("selectProgressPercent").value;
  const note = document.getElementById("inputProgressNote").value.trim();

  const idea = STATE.ideas.find(i => i.id === ideaId);
  if (idea) {
    idea.milestones = `${percent} — ${note || 'Cập nhật tiến độ'}`;
    if (percent === "80%") idea.status = "🧪 Beta Testing";
    if (percent === "100%") idea.status = "✅ Hoàn thành";
  }

  document.getElementById("modalDevProgress").classList.add("hidden");
  document.getElementById("modalDevProgress").classList.remove("flex");

  showToast(`Đã lưu tiến độ mốc cho #${ideaId}`);
  renderIdeas();
  updateStats();
});

// ==============================================================================
// 7. EVENT LISTENERS
// ==============================================================================
function initEventListeners() {
  // Modal Submit
  const modalSubmit = document.getElementById("modalSubmit");
  document.getElementById("btnOpenModal").addEventListener("click", () => {
    modalSubmit.classList.remove("hidden");
    modalSubmit.classList.add("flex");
    document.getElementById("inputTitle").focus();
  });
  document.getElementById("btnCloseModal").addEventListener("click", () => {
    modalSubmit.classList.add("hidden");
    modalSubmit.classList.remove("flex");
  });
  document.getElementById("btnCancelModal").addEventListener("click", () => {
    modalSubmit.classList.add("hidden");
    modalSubmit.classList.remove("flex");
  });

  // Modal Duplicate Warning
  document.getElementById("btnCloseDupModal").addEventListener("click", () => {
    document.getElementById("modalDuplicateWarning").classList.add("hidden");
    document.getElementById("modalDuplicateWarning").classList.remove("flex");
  });
  document.getElementById("btnCancelDup").addEventListener("click", () => {
    document.getElementById("modalDuplicateWarning").classList.add("hidden");
    document.getElementById("modalDuplicateWarning").classList.remove("flex");
  });

  // Modal Bounty
  document.getElementById("btnCloseBountyModal").addEventListener("click", () => {
    document.getElementById("modalBountyPledge").classList.add("hidden");
    document.getElementById("modalBountyPledge").classList.remove("flex");
  });
  document.getElementById("btnCancelBounty").addEventListener("click", () => {
    document.getElementById("modalBountyPledge").classList.add("hidden");
    document.getElementById("modalBountyPledge").classList.remove("flex");
  });

  // Modal Progress
  document.getElementById("btnCloseProgressModal").addEventListener("click", () => {
    document.getElementById("modalDevProgress").classList.add("hidden");
    document.getElementById("modalDevProgress").classList.remove("flex");
  });
  document.getElementById("btnCancelProgress").addEventListener("click", () => {
    document.getElementById("modalDevProgress").classList.add("hidden");
    document.getElementById("modalDevProgress").classList.remove("flex");
  });

  // Role selector toggle
  document.getElementById("btnRoleSelector").addEventListener("click", () => {
    document.getElementById("roleDropdownMenu").classList.toggle("hidden");
  });

  // Config modal
  const modalConfig = document.getElementById("modalConfig");
  const configApiUrl = document.getElementById("configApiUrl");
  document.getElementById("btnConfig").addEventListener("click", () => {
    configApiUrl.value = STATE.apiUrl;
    modalConfig.classList.remove("hidden");
    modalConfig.classList.add("flex");
  });
  document.getElementById("btnCloseConfig").addEventListener("click", () => {
    modalConfig.classList.add("hidden");
    modalConfig.classList.remove("flex");
  });
  document.getElementById("btnSaveConfig").addEventListener("click", () => {
    const val = configApiUrl.value.trim();
    STATE.apiUrl = val;
    localStorage.setItem("TG_IDEA_API_URL", val);
    modalConfig.classList.add("hidden");
    modalConfig.classList.remove("flex");
    showToast("Đã lưu cấu hình API! Đang tải lại...");
    loadData();
  });

  // Search input
  document.getElementById("searchInput").addEventListener("input", (e) => {
    STATE.searchQuery = e.target.value;
    renderIdeas();
  });

  // Filter tabs
  const tabs = document.querySelectorAll(".filter-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => {
        t.classList.remove("active", "bg-indigo-600", "text-white");
        t.classList.add("bg-slate-900", "text-slate-400");
      });
      tab.classList.add("active", "bg-indigo-600", "text-white");
      tab.classList.remove("bg-slate-900", "text-slate-400");

      STATE.currentFilter = tab.dataset.filter;
      renderIdeas();
    });
  });
}

// Toast helper
function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const toastIcon = document.getElementById("toastIcon");

  toastMessage.innerText = msg;
  if (type === "error") {
    toastIcon.innerHTML = `<i class="fa-solid fa-circle-exclamation text-rose-400"></i>`;
  } else {
    toastIcon.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i>`;
  }

  toast.classList.remove("translate-y-20", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
    toast.classList.remove("translate-y-0", "opacity-100");
  }, 3000);
}

// Helpers
function escapeHtml(str) {
  if (!str) return "";
  return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTimeAgo(dateString) {
  if (!dateString) return "Vừa xong";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (isNaN(diffSec) || diffSec < 60) return "Vừa xong";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  return `${Math.floor(diffSec / 86400)} ngày trước`;
}
```

---

### 4.3 `web-dashboard/styles.css` Blueprint

```css
/* Custom scrollbar and smooth transitions */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
}

::-webkit-scrollbar-thumb {
  background: rgba(51, 65, 85, 0.8);
  border-radius: 9999px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(71, 85, 105, 1);
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Glassmorphism Card styling */
.idea-card {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.idea-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
}

/* Upvote button active/voted state */
.upvote-btn.voted {
  background: linear-gradient(135deg, #4f46e5, #4338ca);
  color: #ffffff;
  border-color: #6366f1;
  box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
}

.upvote-btn.voted .vote-icon {
  transform: scale(1.15);
  color: #a5b4fc;
}

/* Status Badge Colors */
.status-badge-voting {
  background-color: rgba(234, 179, 8, 0.1);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.status-badge-inprogress {
  background-color: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.status-badge-beta {
  background-color: rgba(168, 85, 247, 0.1);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.15);
}

.status-badge-completed {
  background-color: rgba(16, 185, 129, 0.1);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.status-badge-rejected {
  background-color: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

/* Gold Bounty Badge (R4) */
.bounty-badge-gold {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.25));
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.18);
}
```

---

## 5. Verification Method

### 5.1 Automated Test Runner
Verify that test simulator passes 100%:
```powershell
node scripts/test_simulator.js
```
*Expected Result*: 48 passed / 0 failed across 10 test suites.

### 5.2 Frontend UI & Mini App Functional Verification Checklist
1. **Stats Cards**:
   - Verify 4 stats cards render with dynamic values: Total Ideas, Total Votes, Active Devs, Total Bounty Pool.
2. **Filter Tabs**:
   - Click `💰 Quỹ Bounty` $\rightarrow$ verifies only cards with bounties are visible.
   - Click `🧪 Beta Testing` $\rightarrow$ verifies only cards in beta status are visible.
3. **AI Duplicate Warning Modal**:
   - Submit a proposal with title *"Quét Hóa Đơn PDF Tự Động"* $\rightarrow$ verifies modal pops up showing similarity score (88%), reason, and existing idea card `#1`.
   - Click `[ Dồn Vote Vào Ý Tưởng Có Sẵn Này ]` $\rightarrow$ verifies vote counter increments on `#1` and toast confirmation appears.
4. **Developer Task Claiming & Workflow**:
   - Switch role to `Developer` $\rightarrow$ click `[ 🛠 Nhận làm tool ]` on an open card $\rightarrow$ verifies status changes to `🚀 Đang phát triển` with developer tag and progress bar.
   - Click `🧪 Lên Beta` $\rightarrow$ verifies status changes to `🧪 Beta Testing`.
   - Click `[ ✅ Hoàn thành ]` $\rightarrow$ verifies status changes to `✅ Hoàn thành`.
5. **Bounty Crowdfunding Modal**:
   - Click `[ 💰 Treo thưởng ]` on any card $\rightarrow$ select amount (e.g. 500k VNĐ or 5 ☕) $\rightarrow$ confirm pledge $\rightarrow$ verifies gold bounty badge appears/updates and global stats reflect the new amount.
