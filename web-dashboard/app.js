/**
 * ==============================================================================
 * TELEGRAM MINI APP & WEB DASHBOARD - CLIENT LOGIC (app.js)
 * ==============================================================================
 */

// State Management
const STATE = {
  apiUrl: localStorage.getItem("TG_IDEA_API_URL") || "",
  ideas: [],
  userVotedIds: JSON.parse(localStorage.getItem("TG_USER_VOTED_IDS") || "[]"),
  currentFilter: "all",
  searchQuery: "",
  currentUser: {
    id: "user_" + (localStorage.getItem("TG_LOCAL_USER_ID") || generateLocalUserId()),
    username: "@user",
    name: "Thành viên"
  }
};

// Khởi tạo Demo Data nếu chưa có backend API
const DEMO_IDEAS = [
  {
    id: 1,
    title: "Tool Auto Fill Hóa Đơn VAT vào Sheet",
    description: "Tự động đọc các file PDF hóa đơn điện tử trong thư mục Google Drive, cào thông tin mã số thuế, tổng tiền, ngày xuất rồi tự động chèn vào bảng tính theo format quy định.",
    category: "Auto Sheet",
    author: "@hoangnam_dev",
    votes: 42,
    status: "🚀 Đang phát triển",
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 2,
    title: "Bot Cào Giá Sản Phẩm Shopee / Tiki Theo Giờ",
    description: "Nhập danh sách link sản phẩm vào Google Sheet, bot sẽ chạy tự động mỗi 3 tiếng để kiểm tra giá giảm và gửi thông báo vào Telegram khi có flash sale.",
    category: "Cào Dữ Liệu",
    author: "@thanhthao_mkt",
    votes: 38,
    status: "⏳ Đang lấy ý kiến",
    timestamp: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: 3,
    title: "AI Tóm Tắt Tin Nhắn & Báo Cáo Nhóm Hàng Ngày",
    description: "Tích hợp Gemini Flash để tổng hợp lại 500+ tin nhắn thảo luận trong nhóm Telegram thành 5 gạch đầu dòng quan trọng nhất vào 21:00 mỗi tối.",
    category: "AI & Chatbot",
    author: "@trung_ai",
    votes: 29,
    status: "⏳ Đang lấy ý kiến",
    timestamp: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 4,
    title: "Tool Xuất Báo Cáo Google Sheet Ra File PDF & Gửi Email",
    description: "Tạo nút bấm trong Sheet để tự động định dạng bảng dữ liệu thành mẫu PDF đẹp mắt và gửi hàng loạt cho đối tác theo danh sách email.",
    category: "Auto Sheet",
    author: "@lam_hd",
    votes: 18,
    status: "✅ Đã hoàn thành",
    timestamp: new Date(Date.now() - 86400000 * 7).toISOString()
  }
];

function generateLocalUserId() {
  const rand = Math.floor(100000 + Math.random() * 900000).toString();
  localStorage.setItem("TG_LOCAL_USER_ID", rand);
  return rand;
}

// ==============================================================================
// 1. INITIALIZATION
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initTelegramWebApp();
  initEventListeners();
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

      // Điền sẵn username vào input form
      const inputAuthor = document.getElementById("inputAuthor");
      if (inputAuthor) inputAuthor.value = STATE.currentUser.username;
    }
  }
}

// ==============================================================================
// 2. DATA FETCHING & SYNC
// ==============================================================================
async function loadData() {
  const container = document.getElementById("ideasContainer");
  const emptyState = document.getElementById("emptyState");

  if (!STATE.apiUrl) {
    // Dùng Demo Data
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

// ==============================================================================
// 3. RENDERING UI
// ==============================================================================
function renderIdeas() {
  const container = document.getElementById("ideasContainer");
  const emptyState = document.getElementById("emptyState");

  let filtered = STATE.ideas.filter(idea => {
    // Search match
    const q = STATE.searchQuery.toLowerCase();
    const matchSearch = idea.title.toLowerCase().includes(q) ||
                        idea.description.toLowerCase().includes(q) ||
                        idea.author.toLowerCase().includes(q);

    // Filter tab match
    let matchFilter = true;
    if (STATE.currentFilter === "top") matchFilter = true; // Sắp xếp sau
    else if (STATE.currentFilter === "voting") matchFilter = idea.status.includes("lấy ý kiến") || idea.status.includes("bình chọn");
    else if (STATE.currentFilter === "inprogress") matchFilter = idea.status.includes("phát triển") || idea.status.includes("tiến hành");
    else if (STATE.currentFilter === "completed") matchFilter = idea.status.includes("hoàn thành") || idea.status.includes("đã ra mắt");

    return matchSearch && matchFilter;
  });

  // Sort
  if (STATE.currentFilter === "top") {
    filtered.sort((a, b) => b.votes - a.votes);
  } else {
    // Mới nhất lên đầu hoặc vote cao lên đầu
    filtered.sort((a, b) => b.votes - a.votes);
  }

  container.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach((idea, index) => {
    const isVoted = STATE.userVotedIds.includes(idea.id);
    const badgeClass = getStatusBadgeClass(idea.status);

    const card = document.createElement("div");
    card.className = "idea-card bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 shadow-md backdrop-blur-sm";
    
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1.5 flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md">#${idea.id}</span>
            <span class="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">${escapeHtml(idea.category)}</span>
            <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${badgeClass}">${escapeHtml(idea.status)}</span>
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

      <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60 font-medium">
        <div class="flex items-center space-x-1.5 text-slate-400">
          <i class="fa-regular fa-user text-[10px]"></i>
          <span>${escapeHtml(idea.author)}</span>
        </div>
        <div class="flex items-center space-x-1 text-slate-500">
          <i class="fa-regular fa-clock text-[10px]"></i>
          <span>${formatTimeAgo(idea.timestamp)}</span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function getStatusBadgeClass(status) {
  if (!status) return "status-badge-voting";
  if (status.includes("phát triển") || status.includes("tiến hành")) return "status-badge-inprogress";
  if (status.includes("hoàn thành") || status.includes("đã ra mắt")) return "status-badge-completed";
  if (status.includes("từ chối") || status.includes("hủy")) return "status-badge-rejected";
  return "status-badge-voting";
}

function updateStats() {
  document.getElementById("statTotalIdeas").innerText = STATE.ideas.length;
  const totalVotes = STATE.ideas.reduce((acc, curr) => acc + curr.votes, 0);
  document.getElementById("statTotalVotes").innerText = totalVotes;
}

// ==============================================================================
// 4. USER ACTIONS (VOTE & SUBMIT)
// ==============================================================================
async function handleVote(ideaId) {
  const idea = STATE.ideas.find(i => i.id === ideaId);
  if (!idea) return;

  const isVoted = STATE.userVotedIds.includes(ideaId);

  // Optimistic UI update
  if (isVoted) {
    // Hủy vote
    STATE.userVotedIds = STATE.userVotedIds.filter(id => id !== ideaId);
    idea.votes = Math.max(0, idea.votes - 1);
    showToast(`Đã rút lại vote cho #${ideaId}`);
  } else {
    // Vote
    STATE.userVotedIds.push(ideaId);
    idea.votes += 1;
    showToast(`🎉 Đã vote thành công cho #${ideaId}!`);
  }

  localStorage.setItem("TG_USER_VOTED_IDS", JSON.stringify(STATE.userVotedIds));
  renderIdeas();
  updateStats();

  // Gọi API nếu có backend
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

// Submit Idea Form
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
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Đang gửi...</span>`;

  const newIdea = {
    id: STATE.ideas.length > 0 ? Math.max(...STATE.ideas.map(i => i.id)) + 1 : 1,
    title: title,
    description: description,
    category: category,
    author: author,
    votes: 0,
    status: "⏳ Đang lấy ý kiến",
    timestamp: new Date().toISOString()
  };

  if (STATE.apiUrl) {
    try {
      const res = await fetch(STATE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          apiAction: "submitIdea",
          title: title,
          description: description,
          category: category,
          username: author,
          userId: STATE.currentUser.id
        })
      });
      const json = await res.json();
      if (json.ok && json.ideaId) {
        newIdea.id = json.ideaId;
      }
    } catch (err) {
      console.warn("Lỗi gửi API:", err);
    }
  }

  // Thêm vào danh sách local
  STATE.ideas.unshift(newIdea);
  renderIdeas();
  updateStats();

  // Reset form & đóng modal
  document.getElementById("formSubmitIdea").reset();
  document.getElementById("modalSubmit").classList.add("hidden");
  document.getElementById("modalSubmit").classList.remove("flex");
  btnSubmit.disabled = false;
  btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i><span>Gửi Đề Xuất</span>`;

  showToast("🎉 Đề xuất ý tưởng của bạn đã được đăng thành công!");
});

// ==============================================================================
// 5. EVENT LISTENERS & MODALS
// ==============================================================================
function initEventListeners() {
  // Modal Đề xuất
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

  // Modal Cấu hình API
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

// Format utilities
function escapeHtml(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
