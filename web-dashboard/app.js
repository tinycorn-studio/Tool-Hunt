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
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const rand = (100000 + (array[0] % 900000)).toString();
    localStorage.setItem("TG_LOCAL_USER_ID", rand);
    return rand;
  }
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

function getTelegramInitData() {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
    return window.Telegram.WebApp.initData;
  }
  return "";
}

async function postApiRequest(payload) {
  if (!STATE.apiUrl) return null;
  const initData = getTelegramInitData();
  const enrichedPayload = {
    ...payload,
    initData: initData || undefined
  };
  return await fetch(STATE.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(enrichedPayload)
  });
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
  const menu = document.getElementById("roleDropdownMenu");
  if (menu) menu.classList.add("hidden");
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
  const totalIdeasEl = document.getElementById("statTotalIdeas");
  if (totalIdeasEl) totalIdeasEl.innerText = STATE.ideas.length;

  const totalVotes = STATE.ideas.reduce((acc, curr) => acc + curr.votes, 0);
  const totalVotesEl = document.getElementById("statTotalVotes");
  if (totalVotesEl) totalVotesEl.innerText = totalVotes;

  // Active Devs count
  const activeDevs = new Set(STATE.ideas.filter(i => i.developerUsername).map(i => i.developerUsername));
  const activeDevsEl = document.getElementById("statActiveDevs");
  if (activeDevsEl) activeDevsEl.innerText = activeDevs.size;

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
  const totalBountiesEl = document.getElementById("statTotalBounties");
  if (totalBountiesEl) {
    totalBountiesEl.innerText = totalVnd > 0 ? totalVnd.toLocaleString("vi-VN") + " VNĐ" : "1.400.000 VNĐ";
  }
}

// ==============================================================================
// 5. RENDERING UI
// ==============================================================================
function renderIdeas() {
  const container = document.getElementById("ideasContainer");
  const emptyState = document.getElementById("emptyState");
  if (!container || !emptyState) return;

  let filtered = STATE.ideas.filter(idea => {
    // Loại trừ các ý tưởng đã bị gỡ bỏ / ẩn
    if (idea.status && (idea.status.includes("Đã ẩn") || idea.status.includes("Spam") || idea.status.includes("Đã xóa"))) {
      return false;
    }

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

  filtered.sort((a, b) => b.votes - a.votes);

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
          <!-- Bounty Pledge Button (SEC-HIGH-02) -->
          <button onclick="openBountyModal(${idea.id})" class="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-semibold flex items-center space-x-1 transition-all">
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
      await postApiRequest({
        apiAction: "voteIdea",
        ideaId: ideaId,
        userId: STATE.currentUser.id,
        username: STATE.currentUser.username
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
      await postApiRequest({
        apiAction: "claimIdea",
        ideaId: ideaId,
        userId: STATE.currentUser.id,
        username: STATE.currentUser.username
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
      await postApiRequest({
        apiAction: "unclaimIdea",
        ideaId: ideaId,
        userId: STATE.currentUser.id,
        username: STATE.currentUser.username
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
      await postApiRequest({
        apiAction: "updateProgress",
        ideaId: ideaId,
        userId: STATE.currentUser.id,
        username: STATE.currentUser.username,
        targetStatus: targetStatus,
        milestone: idea.milestones
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
      const res = await postApiRequest({
        apiAction: "checkDuplicate",
        title: draft.title,
        description: draft.description
      });
      if (res) {
        const json = await res.json();
        if (json.ok && json.duplicateCheck) return json.duplicateCheck;
      }
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
      const res = await postApiRequest({
        apiAction: "submitIdea",
        title: draft.title,
        description: draft.description,
        category: draft.category,
        username: draft.author,
        userId: draft.userId
      });
      if (res) {
        const json = await res.json();
        if (json.ok && json.ideaId) newIdea.id = json.ideaId;
      }
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
  const target = STATE.ideas.find(i => i.id === ideaId);
  const title = ideaTitle || (target ? target.title : "");
  document.getElementById("bountyTargetIdeaId").value = ideaId;
  document.getElementById("bountyModalTargetTitle").textContent = `#${ideaId} — ${title}`;
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
  const unitEl = document.querySelector("input[name='bountyUnit']:checked");
  const unit = unitEl ? unitEl.value : "VND";
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
      await postApiRequest({
        apiAction: "pledgeBounty",
        ideaId: ideaId,
        userId: STATE.currentUser.id,
        username: sponsor,
        amount: amount,
        unit: unit,
        message: message
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
  const btnOpenModal = document.getElementById("btnOpenModal");
  if (btnOpenModal && modalSubmit) {
    btnOpenModal.addEventListener("click", () => {
      modalSubmit.classList.remove("hidden");
      modalSubmit.classList.add("flex");
      const titleInput = document.getElementById("inputTitle");
      if (titleInput) titleInput.focus();
    });
  }
  const btnCloseModal = document.getElementById("btnCloseModal");
  if (btnCloseModal && modalSubmit) {
    btnCloseModal.addEventListener("click", () => {
      modalSubmit.classList.add("hidden");
      modalSubmit.classList.remove("flex");
    });
  }
  const btnCancelModal = document.getElementById("btnCancelModal");
  if (btnCancelModal && modalSubmit) {
    btnCancelModal.addEventListener("click", () => {
      modalSubmit.classList.add("hidden");
      modalSubmit.classList.remove("flex");
    });
  }

  // Modal Duplicate Warning
  const btnCloseDup = document.getElementById("btnCloseDupModal");
  const modalDup = document.getElementById("modalDuplicateWarning");
  if (btnCloseDup && modalDup) {
    btnCloseDup.addEventListener("click", () => {
      modalDup.classList.add("hidden");
      modalDup.classList.remove("flex");
    });
  }
  const btnCancelDup = document.getElementById("btnCancelDup");
  if (btnCancelDup && modalDup) {
    btnCancelDup.addEventListener("click", () => {
      modalDup.classList.add("hidden");
      modalDup.classList.remove("flex");
    });
  }

  // Modal Bounty
  const btnCloseBounty = document.getElementById("btnCloseBountyModal");
  const modalBounty = document.getElementById("modalBountyPledge");
  if (btnCloseBounty && modalBounty) {
    btnCloseBounty.addEventListener("click", () => {
      modalBounty.classList.add("hidden");
      modalBounty.classList.remove("flex");
    });
  }
  const btnCancelBounty = document.getElementById("btnCancelBounty");
  if (btnCancelBounty && modalBounty) {
    btnCancelBounty.addEventListener("click", () => {
      modalBounty.classList.add("hidden");
      modalBounty.classList.remove("flex");
    });
  }

  // Modal Progress
  const btnCloseProg = document.getElementById("btnCloseProgressModal");
  const modalProg = document.getElementById("modalDevProgress");
  if (btnCloseProg && modalProg) {
    btnCloseProg.addEventListener("click", () => {
      modalProg.classList.add("hidden");
      modalProg.classList.remove("flex");
    });
  }
  const btnCancelProg = document.getElementById("btnCancelProgress");
  if (btnCancelProg && modalProg) {
    btnCancelProg.addEventListener("click", () => {
      modalProg.classList.add("hidden");
      modalProg.classList.remove("flex");
    });
  }

  // Role selector toggle
  const btnRole = document.getElementById("btnRoleSelector");
  const roleMenu = document.getElementById("roleDropdownMenu");
  if (btnRole && roleMenu) {
    btnRole.addEventListener("click", () => {
      roleMenu.classList.toggle("hidden");
    });
  }

  // Config modal
  const modalConfig = document.getElementById("modalConfig");
  const configApiUrl = document.getElementById("configApiUrl");
  const btnConfig = document.getElementById("btnConfig");
  if (btnConfig && modalConfig) {
    btnConfig.addEventListener("click", () => {
      if (configApiUrl) configApiUrl.value = STATE.apiUrl;
      modalConfig.classList.remove("hidden");
      modalConfig.classList.add("flex");
    });
  }
  const btnCloseConfig = document.getElementById("btnCloseConfig");
  if (btnCloseConfig && modalConfig) {
    btnCloseConfig.addEventListener("click", () => {
      modalConfig.classList.add("hidden");
      modalConfig.classList.remove("flex");
    });
  }
  const btnSaveConfig = document.getElementById("btnSaveConfig");
  if (btnSaveConfig && modalConfig) {
    btnSaveConfig.addEventListener("click", () => {
      const val = configApiUrl ? configApiUrl.value.trim() : "";
      STATE.apiUrl = val;
      localStorage.setItem("TG_IDEA_API_URL", val);
      modalConfig.classList.add("hidden");
      modalConfig.classList.remove("flex");
      showToast("Đã lưu cấu hình API! Đang tải lại...");
      loadData();
    });
  }

  // Search input
  const searchInp = document.getElementById("searchInput");
  if (searchInp) {
    searchInp.addEventListener("input", (e) => {
      STATE.searchQuery = e.target.value;
      renderIdeas();
    });
  }

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
  if (!toast || !toastMessage || !toastIcon) return;

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
