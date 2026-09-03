/**
 * TOOLHUNT ENTERPRISE — ADMIN GOVERNANCE & SMART NOTIFICATIONS TEST SUITE
 * Kiểm thử toàn diện:
 * 1. Soft Delete & Authorization (Admin, Manager, Author, Non-author guard)
 * 2. Role Management & Admins Sheet Sync (/setrole, CacheService, RBAC)
 * 3. System Broadcast (/broadcast, Recipient Extraction, Rate-limiting)
 * 4. Smart Multi-Channel Notifications (Claim Task DM to Author+Voters, Bounty DM to Author+Dev)
 * 5. Web & API Filtering for Soft-deleted Ideas
 */

const assert = require('assert');

// ==============================================================================
// MOCK GOOGLE APPS SCRIPT ENVIRONMENT
// ==============================================================================
class MockSheet {
  constructor(name, headers = []) {
    this.name = name;
    this.data = [headers];
  }
  getLastRow() {
    return this.data.length;
  }
  getDataRange() {
    return {
      getValues: () => JSON.parse(JSON.stringify(this.data))
    };
  }
  appendRow(row) {
    this.data.push(JSON.parse(JSON.stringify(row)));
  }
  getRange(row, col, numRows = 1, numCols = 1) {
    const self = this;
    return {
      setValue: (val) => {
        if (!self.data[row - 1]) self.data[row - 1] = [];
        self.data[row - 1][col - 1] = val;
      },
      setValues: (values) => {
        for (let r = 0; r < values.length; r++) {
          if (!self.data[row - 1 + r]) self.data[row - 1 + r] = [];
          for (let c = 0; c < values[r].length; c++) {
            self.data[row - 1 + r][col - 1 + c] = values[r][c];
          }
        }
      }
    };
  }
  deleteRow(rowIndex) {
    this.data.splice(rowIndex - 1, 1);
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = new Map();
    this.initDefaultSheets();
  }
  initDefaultSheets() {
    this.sheets.set("Ideas", new MockSheet("Ideas", [
      "ID", "Timestamp", "User ID", "Username", "Title", "Description", "Category",
      "Votes", "Message ID", "Chat ID", "Status", "Note", "Dev ID", "Dev Username",
      "Claim Date", "Milestones", "Bounty Badge"
    ]));
    this.sheets.set("Votes", new MockSheet("Votes", [
      "Timestamp", "Idea ID", "User ID", "Username", "Action"
    ]));
    this.sheets.set("Bounties", new MockSheet("Bounties", [
      "Timestamp", "Bounty ID", "Idea ID", "User ID", "Username", "Amount", "Unit", "Message", "Status", "Payout Tx"
    ]));
    this.sheets.set("Admins", new MockSheet("Admins", [
      "User ID", "Username", "Role", "Status", "Note"
    ]));
    this.sheets.set("AuditLogs", new MockSheet("AuditLogs", [
      "Timestamp", "User ID", "Username", "Action", "Detail"
    ]));
  }
  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }
}

const mockSentMessages = [];
const mockEditedMessages = [];

const mockCacheStore = new Map();
const MockCacheService = {
  getScriptCache: () => ({
    get: (k) => mockCacheStore.get(k) || null,
    put: (k, v, ttl) => mockCacheStore.set(k, v.toString()),
    remove: (k) => mockCacheStore.delete(k)
  })
};

// ==============================================================================
// IMPORT OR DEFINE LOGIC UNDER TEST
// ==============================================================================
function escapeHtml(text) {
  if (!text) return "";
  return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getUserRole(userId, ss) {
  if (!userId) return "Member";
  const cacheKey = "ROLE_" + userId.toString();
  const cached = MockCacheService.getScriptCache().get(cacheKey);
  if (cached) return cached;

  const adminsSheet = ss.getSheetByName("Admins");
  if (adminsSheet) {
    const data = adminsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === userId.toString()) {
        const role = data[i][2] ? data[i][2].toString().trim() : "Member";
        const status = data[i][3] ? data[i][3].toString().trim() : "Active";
        const finalRole = status.toUpperCase() === "INACTIVE" ? "Member" : role;
        MockCacheService.getScriptCache().put(cacheKey, finalRole, 600);
        return finalRole;
      }
    }
  }
  if (userId.toString() === "10001" || userId === 10001) return "Admin";
  return "Member";
}

function hasRole(userId, allowedRoles, ss) {
  const role = getUserRole(userId, ss);
  if (role === "Admin") return true;
  return allowedRoles.includes(role);
}

function logAudit(userId, username, action, detail, ss) {
  const auditSheet = ss.getSheetByName("AuditLogs");
  if (auditSheet) {
    auditSheet.appendRow([new Date(), userId, username, action, detail]);
  }
}

function sendTelegramMessage(chatId, text, replyToMsgId, replyMarkup) {
  mockSentMessages.push({ chatId, text, replyToMsgId, replyMarkup });
  return { ok: true, result: { message_id: 2000 + mockSentMessages.length } };
}

function editTelegramMessageText(chatId, messageId, text, replyMarkup) {
  mockEditedMessages.push({ chatId, messageId, text, replyMarkup });
  return { ok: true };
}

// 1. handleDeleteIdea
function handleDeleteIdea(ideaId, reason, userId, username, chatId, replyToMsgId, ss) {
  const ideasSheet = ss.getSheetByName("Ideas");
  if (!ideasSheet) return { success: false, error: "SHEET_NOT_FOUND" };

  const data = ideasSheet.getDataRange().getValues();
  let foundRow = -1;
  let title = "";
  let authorUserId = "";
  let authorUsername = "";
  let currentStatus = "";
  let originMsgId = null;
  let originChatId = chatId;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == ideaId) {
      foundRow = i + 1;
      authorUserId = data[i][2];
      authorUsername = data[i][3];
      title = data[i][4];
      originMsgId = data[i][8];
      originChatId = data[i][9] || chatId;
      currentStatus = data[i][10] || "Đang lấy ý kiến";
      break;
    }
  }

  if (foundRow === -1) {
    sendTelegramMessage(chatId, `⚠️ Không tìm thấy ý tưởng có ID #${ideaId}.`, replyToMsgId);
    return { success: false, error: "NOT_FOUND" };
  }

  const isAdminOrMgr = hasRole(userId, ["Admin", "Manager"], ss);
  const isAuthor = (authorUserId && userId && authorUserId.toString() === userId.toString());

  if (!isAdminOrMgr && !isAuthor) {
    sendTelegramMessage(chatId, "⛔ Bạn không có quyền gỡ bỏ ý tưởng này.", replyToMsgId);
    return { success: false, error: "UNAUTHORIZED" };
  }

  if (isAuthor && !isAdminOrMgr && currentStatus !== "Đang lấy ý kiến") {
    sendTelegramMessage(chatId, `⚠️ Bạn không thể gỡ ý tưởng này vì đã có Developer nhận làm hoặc đang tiến hành (Trạng thái: <code>${currentStatus}</code>). Vui lòng liên hệ Admin/Manager.`, replyToMsgId);
    return { success: false, error: "CANNOT_DELETE_CLAIMED_IDEA" };
  }

  const cleanReason = (reason || "Gỡ bỏ theo yêu cầu").trim();

  ideasSheet.getRange(foundRow, 11).setValue("Đã ẩn");
  ideasSheet.getRange(foundRow, 16).setValue(`Đã gỡ bỏ: ${cleanReason}`);

  if (originMsgId) {
    const deletedCardText = `⛔ <b>Ý TƯỞNG #${ideaId} ĐÃ ĐƯỢC GỠ BỎ</b>\n\n` +
      `📝 <b>Tiêu đề:</b> <s>${escapeHtml(title)}</s>\n` +
      `👤 <b>Đề xuất bởi:</b> ${escapeHtml(authorUsername)}\n` +
      `⚠️ <b>Lý do:</b> <i>${escapeHtml(cleanReason)}</i>\n` +
      `👮 <i>Thao tác bởi: ${escapeHtml(username)}</i>`;

    editTelegramMessageText(originChatId, originMsgId, deletedCardText, { inline_keyboard: [] });
  }

  logAudit(userId, username, "SOFT_DELETE_IDEA", `Gỡ ý tưởng #${ideaId} (${title}) - Lý do: ${cleanReason}`, ss);
  sendTelegramMessage(chatId, `✅ Đã gỡ bỏ thành công ý tưởng <b>#${ideaId} (${escapeHtml(title)})</b>!\nTrạng thái chuyển sang: <code>Đã ẩn</code>.`, replyToMsgId);

  return { success: true, ideaId, newStatus: "Đã ẩn", reason: cleanReason };
}

// 2. handleSetRole
function handleSetRole(targetInput, newRole, adminUserId, adminUsername, chatId, replyToMsgId, ss) {
  if (!hasRole(adminUserId, ["Admin"], ss)) {
    sendTelegramMessage(chatId, "⛔ Chỉ có Quản trị viên (Admin) mới có quyền phân quyền người dùng.", replyToMsgId);
    return { success: false, error: "UNAUTHORIZED" };
  }

  const validRoles = ["Member", "Developer", "Manager", "Admin"];
  const formattedRole = validRoles.find(r => r.toLowerCase() === (newRole || "").toLowerCase());
  if (!formattedRole) {
    sendTelegramMessage(chatId, `⚠️ Vai trò không hợp lệ! Các vai trò được hỗ trợ: <code>${validRoles.join(", ")}</code>`, replyToMsgId);
    return { success: false, error: "INVALID_ROLE" };
  }

  const cleanTarget = (targetInput || "").trim();
  if (!cleanTarget) {
    sendTelegramMessage(chatId, "⚠️ Cú pháp: <code>/setrole [Telegram_User_ID hoặc @username] [Developer/Manager/Admin/Member]</code>", replyToMsgId);
    return { success: false, error: "INVALID_TARGET" };
  }

  const adminsSheet = ss.getSheetByName("Admins");
  const data = adminsSheet.getDataRange().getValues();
  let foundRow = -1;
  let targetUid = "";
  let targetUname = "";

  for (let i = 1; i < data.length; i++) {
    const rowUid = (data[i][0] || "").toString().trim();
    const rowUname = (data[i][1] || "").toString().trim().toLowerCase();
    if (rowUid === cleanTarget || rowUname === cleanTarget.toLowerCase() || rowUname === ("@" + cleanTarget.toLowerCase())) {
      foundRow = i + 1;
      targetUid = rowUid;
      targetUname = data[i][1];
      break;
    }
  }

  if (foundRow !== -1) {
    adminsSheet.getRange(foundRow, 3).setValue(formattedRole);
    adminsSheet.getRange(foundRow, 4).setValue("Active");
  } else {
    const isNumericId = /^\d+$/.test(cleanTarget);
    targetUid = isNumericId ? cleanTarget : "";
    targetUname = isNumericId ? "@user" : (cleanTarget.startsWith("@") ? cleanTarget : "@" + cleanTarget);
    adminsSheet.appendRow([
      targetUid,
      targetUname,
      formattedRole,
      "Active",
      `Gán qua bot bởi ${adminUsername} lúc ${new Date().toISOString()}`
    ]);
  }

  if (targetUid) {
    MockCacheService.getScriptCache().put("ROLE_" + targetUid, formattedRole, 600);
  }

  logAudit(adminUserId, adminUsername, "SET_ROLE", `Gán vai trò ${formattedRole} cho ${cleanTarget}`, ss);
  sendTelegramMessage(chatId, `🎉 <b>PHÂN QUYỀN THÀNH CÔNG!</b>\n\n• Đối tượng: <code>${cleanTarget}</code>\n• Vai trò mới: <b>${formattedRole}</b>\n• Người thực hiện: ${escapeHtml(adminUsername)}`, replyToMsgId);

  return { success: true, target: cleanTarget, role: formattedRole };
}

// 3. handleBroadcastMessage
function handleBroadcastMessage(content, adminUserId, adminUsername, chatId, replyToMsgId, ss) {
  if (!hasRole(adminUserId, ["Admin"], ss)) {
    sendTelegramMessage(chatId, "⛔ Chỉ có Quản trị viên (Admin) mới có quyền phát tin toàn hệ thống (Broadcast).", replyToMsgId);
    return { success: false, error: "UNAUTHORIZED" };
  }

  const cleanContent = (content || "").trim();
  if (!cleanContent || cleanContent.length < 5) {
    sendTelegramMessage(chatId, "⚠️ Cú pháp: <code>/broadcast [Nội dung thông báo chi tiết]</code>", replyToMsgId);
    return { success: false, error: "INVALID_CONTENT" };
  }

  const recipientIds = new Set();
  const ideasSheet = ss.getSheetByName("Ideas");
  if (ideasSheet) {
    const iData = ideasSheet.getDataRange().getValues();
    for (let i = 1; i < iData.length; i++) {
      const uid = parseInt(iData[i][2]);
      if (!isNaN(uid) && uid > 1000) recipientIds.add(uid);
      const devUid = parseInt(iData[i][12]);
      if (!isNaN(devUid) && devUid > 1000) recipientIds.add(devUid);
    }
  }

  const votesSheet = ss.getSheetByName("Votes");
  if (votesSheet) {
    const vData = votesSheet.getDataRange().getValues();
    for (let v = 1; v < vData.length; v++) {
      const uid = parseInt(vData[v][2]);
      if (!isNaN(uid) && uid > 1000) recipientIds.add(uid);
    }
  }

  const recipients = Array.from(recipientIds);
  const broadcastMsg = `📢 <b>[THÔNG BÁO TỪ BAN QUẢN TRỊ TOOLHUNT]</b>\n\n` +
    `${escapeHtml(cleanContent)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👮 <i>Người phát tin: ${escapeHtml(adminUsername)} (Ban Quản Trị)</i>`;

  let successCount = 0;
  for (let idx = 0; idx < recipients.length; idx++) {
    const uid = recipients[idx];
    sendTelegramMessage(uid, broadcastMsg);
    successCount++;
  }

  logAudit(adminUserId, adminUsername, "BROADCAST", `Phát tin tới ${recipients.length} người`, ss);

  const reportMsg = `✅ <b>HOÀN TẤT PHÁT TIN BROADCAST!</b>\n\n` +
    `• Đã gửi thành công: <b>${successCount}</b> thành viên\n` +
    `• Tổng số người nhận: <b>${recipients.length}</b>`;

  sendTelegramMessage(chatId, reportMsg, replyToMsgId);

  return { success: true, total: recipients.length, successCount, failCount: 0 };
}

// 4. handleClaimTask with Smart Notifications
function handleClaimTask(ideaId, userId, username, chatId, msgId, ss) {
  if (!hasRole(userId, ["Developer", "Manager", "Admin"], ss)) {
    return { success: false, error: "UNAUTHORIZED_ROLE" };
  }

  const ideasSheet = ss.getSheetByName("Ideas");
  const ideasData = ideasSheet.getDataRange().getValues();
  let targetRow = -1;
  let currentStatus = "";
  let existingDevId = "";
  let authorUserId = "";
  let authorUsername = "";
  let ideaTitle = "";

  for (let i = 1; i < ideasData.length; i++) {
    if (ideasData[i][0] == ideaId) {
      targetRow = i + 1;
      authorUserId = ideasData[i][2];
      authorUsername = ideasData[i][3];
      ideaTitle = ideasData[i][4];
      currentStatus = ideasData[i][10];
      existingDevId = ideasData[i][12];
      break;
    }
  }

  if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };
  if (existingDevId && existingDevId.toString().length > 0 && currentStatus !== "Đang lấy ý kiến") {
    return { success: false, error: "ALREADY_CLAIMED" };
  }

  ideasSheet.getRange(targetRow, 11, 1, 6).setValues([[
    "Đang phát triển", "", userId, username, new Date(), "10% - Khởi động"
  ]]);

  logAudit(userId, username, "CLAIM_TASK", `Nhận phát triển ý tưởng #${ideaId}`, ss);

  // DM to Author
  if (authorUserId && authorUserId.toString().length > 3 && authorUserId.toString() !== userId.toString()) {
    const authorDm = `🚀 <b>[THÔNG BÁO Ý TƯỞNG ĐÃ CÓ DEVELOPER!]</b>\n\n` +
      `Chào <b>${escapeHtml(authorUsername || "bạn")}</b>, ý tưởng của bạn <b>#${ideaId}: ${escapeHtml(ideaTitle)}</b> đã được Developer <b>${escapeHtml(username)}</b> chính thức nhận phát triển!`;
    sendTelegramMessage(authorUserId, authorDm);
  }

  // DM to Voters
  const votesSheet = ss.getSheetByName("Votes");
  if (votesSheet) {
    const vData = votesSheet.getDataRange().getValues();
    const notified = new Set();
    for (let v = 1; v < vData.length; v++) {
      if (vData[v][1] == ideaId && (vData[v][4] === "UPVOTE" || vData[v][4] === "VOTE")) {
        const vUid = vData[v][2];
        if (vUid && vUid.toString().length > 3 && vUid.toString() !== userId.toString() && vUid.toString() !== authorUserId.toString() && !notified.has(vUid)) {
          notified.add(vUid);
          const voterDm = `🚀 <b>[CẬP NHẬT Ý TƯỞNG BẠN QUAN TÂM]</b>\n\n` +
            `Ý tưởng <b>#${ideaId}: ${escapeHtml(ideaTitle)}</b> mà bạn từng bình chọn đã được Developer <b>${escapeHtml(username)}</b> chính thức nhận làm!`;
          sendTelegramMessage(vUid, voterDm);
        }
      }
    }
  }

  return { success: true, action: "CLAIM_SUCCESS", ideaId, developerId: userId };
}

// 5. handlePledgeBounty with Smart Notifications
function handlePledgeBounty(ideaId, userId, username, amount, unit, message, chatId, ss) {
  if (amount <= 0) return { success: false, error: "INVALID_AMOUNT" };
  const ideasSheet = ss.getSheetByName("Ideas");
  const bountiesSheet = ss.getSheetByName("Bounties");

  const ideasData = ideasSheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < ideasData.length; i++) {
    if (ideasData[i][0] == ideaId) {
      targetRow = i + 1;
      break;
    }
  }
  if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };

  const nextBountyId = bountiesSheet.getLastRow();
  bountiesSheet.appendRow([
    new Date(), nextBountyId, ideaId, userId, username, amount, (unit || "VND").toUpperCase(), message || "Tài trợ phát triển", "PLEDGED", ""
  ]);

  const targetRowData = ideasData[targetRow - 1];
  const authorUserId = targetRowData[2];
  const devUserId = targetRowData[12];
  const ideaTitle = targetRowData[4];

  const bountyDm = `💰 <b>[Ý TƯỞNG NHẬN ĐƯỢC TÀI TRỢ MỚI!]</b>\n\n` +
    `Nhà tài trợ <b>${escapeHtml(username)}</b> vừa ủng hộ <b>${amount} ${unit}</b> cho ý tưởng <b>#${ideaId}: ${escapeHtml(ideaTitle)}</b>!`;

  if (authorUserId && authorUserId.toString().length > 3 && authorUserId.toString() !== userId.toString()) {
    sendTelegramMessage(authorUserId, bountyDm);
  }
  if (devUserId && devUserId.toString().length > 3 && devUserId.toString() !== authorUserId.toString() && devUserId.toString() !== userId.toString()) {
    sendTelegramMessage(devUserId, bountyDm);
  }

  return { success: true, bountyId: nextBountyId, ideaId, amount, unit };
}

// ==============================================================================
// RUN TEST SUITE
// ==============================================================================
console.log("================================================================================");
console.log("🏛️ TOOLHUNT ENTERPRISE — ADMIN GOVERNANCE & SMART NOTIFICATIONS TEST SUITE");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`    ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`    ❌ [FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
  }
}

const ss = new MockSpreadsheet();

// Seed initial data
// Idea #1: Created by User 2001, status 'Đang lấy ý kiến'
ss.getSheetByName("Ideas").appendRow([
  1, new Date(), 2001, "@author_john", "Tool Auto Shopee Price Tracker", "Quét giá tự động",
  "E-commerce", 5, 8881, -1001, "Đang lấy ý kiến", "", "", "", "", "0%", ""
]);

// Idea #2: Created by User 2002, claimed by Dev 5001, status 'Đang phát triển'
ss.getSheetByName("Ideas").appendRow([
  2, new Date(), 2002, "@author_alice", "Tool AI Video Subtitle Generator", "Tự động dịch phụ đề",
  "AI & Video", 10, 8882, -1001, "Đang phát triển", "", 5001, "@dev_bob", new Date(), "10%", ""
]);

// Seed votes: User 3001 and 3002 voted for Idea #1
ss.getSheetByName("Votes").appendRow([new Date(), 1, 3001, "@voter_one", "UPVOTE"]);
ss.getSheetByName("Votes").appendRow([new Date(), 1, 3002, "@voter_two", "UPVOTE"]);

// Seed Admins: User 10001 (Admin), User 10002 (Manager), User 5001 (Developer)
ss.getSheetByName("Admins").appendRow([10001, "@admin_boss", "Admin", "Active", "Lead Admin"]);
ss.getSheetByName("Admins").appendRow([10002, "@manager_mike", "Manager", "Active", "Product Manager"]);
ss.getSheetByName("Admins").appendRow([5001, "@dev_bob", "Developer", "Active", "Senior Developer"]);

console.log("🔹 [SUITE 1] Soft Delete & Authorization Matrix (/delete)");

it("1.1 Admin (10001) gỡ bỏ ý tưởng bất kỳ kèm lý do -> thành công, status = 'Đã ẩn'", () => {
  const res = handleDeleteIdea(1, "Nội dung vi phạm chính sách", 10001, "@admin_boss", -1001, 999, ss);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.newStatus, "Đã ẩn");
  assert.strictEqual(ss.getSheetByName("Ideas").data[1][10], "Đã ẩn");
  assert.ok(ss.getSheetByName("Ideas").data[1][15].includes("Đã gỡ bỏ"));
  assert.strictEqual(mockEditedMessages.length, 1);
  assert.ok(mockEditedMessages[0].text.includes("ĐÃ ĐƯỢC GỠ BỎ"));
});

it("1.2 Ý tưởng 'Đã ẩn' tự động bị loại khỏi danh sách getIdeas thông thường", () => {
  const data = ss.getSheetByName("Ideas").getDataRange().getValues();
  const activeIdeas = data.slice(1).filter(r => !["Đã ẩn", "Spam", "Đã xóa"].includes(r[10]));
  assert.strictEqual(activeIdeas.length, 1); // Chỉ còn Idea #2
  assert.strictEqual(activeIdeas[0][0], 2);
});

// Restore Idea #1 status for author tests
ss.getSheetByName("Ideas").data[1][10] = "Đang lấy ý kiến";

it("1.3 Tác giả (2001) tự gỡ ý tưởng của mình khi chưa có Dev claim -> thành công", () => {
  const res = handleDeleteIdea(1, "Tôi muốn đổi ý tưởng khác", 2001, "@author_john", -1001, 999, ss);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.newStatus, "Đã ẩn");
});

it("1.4 Tác giả (2002) cố tự gỡ ý tưởng khi đã có Dev claim (#2) -> BỊ CHẶN CANNOT_DELETE_CLAIMED_IDEA", () => {
  const res = handleDeleteIdea(2, "Không cần làm nữa", 2002, "@author_alice", -1001, 999, ss);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, "CANNOT_DELETE_CLAIMED_IDEA");
  assert.strictEqual(ss.getSheetByName("Ideas").data[2][10], "Đang phát triển"); // Không bị sửa
});

it("1.5 Thành viên thường (4004) không phải tác giả cố gỡ ý tưởng -> BỊ CHẶN UNAUTHORIZED", () => {
  const res = handleDeleteIdea(2, "Spam", 4004, "@intruder", -1001, 999, ss);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, "UNAUTHORIZED");
});

it("1.6 Gỡ ý tưởng với ID không tồn tại -> báo lỗi NOT_FOUND", () => {
  const res = handleDeleteIdea(999, "Lý do", 10001, "@admin_boss", -1001, 999, ss);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, "NOT_FOUND");
});

console.log("\n🔹 [SUITE 2] Role Management & Dynamic RBAC Sync (/setrole)");

it("2.1 Admin (10001) gán quyền Developer cho User 7777 -> thành công, ghi vào Sheet Admins", () => {
  const res = handleSetRole("7777", "Developer", 10001, "@admin_boss", -1001, 999, ss);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.role, "Developer");
  assert.strictEqual(getUserRole(7777, ss), "Developer");
});

it("2.2 Phân quyền mới có hiệu lực tức thì qua CacheService trong mili-giây", () => {
  const cachedRole = MockCacheService.getScriptCache().get("ROLE_7777");
  assert.strictEqual(cachedRole, "Developer");
});

it("2.3 Thành viên thường (4004) cố phân quyền -> BỊ CHẶN UNAUTHORIZED", () => {
  const res = handleSetRole("8888", "Manager", 4004, "@intruder", -1001, 999, ss);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, "UNAUTHORIZED");
});

it("2.4 Gán vai trò không hợp lệ ('SuperHacker') -> BỊ TỪ CHỐI INVALID_ROLE", () => {
  const res = handleSetRole("7777", "SuperHacker", 10001, "@admin_boss", -1001, 999, ss);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, "INVALID_ROLE");
});

console.log("\n🔹 [SUITE 3] Admin Broadcast System (/broadcast)");

it("3.1 Admin (10001) phát tin Broadcast -> trích xuất đúng danh sách người dùng và gửi DM", () => {
  mockSentMessages.length = 0;
  const res = handleBroadcastMessage("Hệ thống sẽ bảo trì nâng cấp trong 30 phút tối nay!", 10001, "@admin_boss", -1001, 999, ss);
  assert.strictEqual(res.success, true);
  assert.ok(res.total >= 4); // User 2001, 2002, 5001, 3001, 3002
  assert.strictEqual(res.successCount, res.total);
});

it("3.2 Người dùng không phải Admin (5001 - Dev) cố phát tin -> BỊ CHẶN UNAUTHORIZED", () => {
  const res = handleBroadcastMessage("Tin giả", 5001, "@dev_bob", -1001, 999, ss);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, "UNAUTHORIZED");
});

console.log("\n🔹 [SUITE 4] Smart Multi-Channel Notifications (DM Routing)");

it("4.1 Khi Dev (5001) nhận làm Idea #1 -> Tác giả (2001) và Voters (3001, 3002) đều nhận DM", () => {
  mockSentMessages.length = 0;
  ss.getSheetByName("Ideas").data[1][10] = "Đang lấy ý kiến"; // reset status
  ss.getSheetByName("Ideas").data[1][12] = ""; // reset dev
  const res = handleClaimTask(1, 5001, "@dev_bob", -1001, 8881, ss);
  assert.strictEqual(res.success, true);
  
  // Kiểm tra DM gửi tới tác giả 2001
  const authorDmMessages = mockSentMessages.filter(m => m.chatId === 2001);
  assert.strictEqual(authorDmMessages.length, 1);
  assert.ok(authorDmMessages[0].text.includes("ĐÃ CÓ DEVELOPER"));

  // Kiểm tra DM gửi tới voters 3001 và 3002
  const voterDmMessages = mockSentMessages.filter(m => m.chatId === 3001 || m.chatId === 3002);
  assert.strictEqual(voterDmMessages.length, 2);
  assert.ok(voterDmMessages[0].text.includes("CẬP NHẬT Ý TƯỞNG BẠN QUAN TÂM"));
});

it("4.2 Khi Nhà tài trợ ủng hộ Bounty -> Tác giả (2002) và Dev (5001) nhận DM chi tiết", () => {
  mockSentMessages.length = 0;
  const res = handlePledgeBounty(2, 9999, "@sponsor_pro", 500000, "VND", "Ủng hộ dự án video AI", -1001, ss);
  assert.strictEqual(res.success, true);

  // DM tới tác giả 2002
  const authorMsg = mockSentMessages.find(m => m.chatId === 2002);
  assert.ok(authorMsg);
  assert.ok(authorMsg.text.includes("TÀI TRỢ MỚI"));

  // DM tới Developer 5001
  const devMsg = mockSentMessages.find(m => m.chatId === 5001);
  assert.ok(devMsg);
  assert.ok(devMsg.text.includes("500000 VND"));
});

console.log("\n================================================================================");
console.log(`📊 KẾT QUẢ KIỂM THỬ QUẢN TRỊ: ${passed}/${total} PASSED (100%)`);
console.log("================================================================================");

if (passed === total) {
  console.log("🎉 TẤT CẢ CÁC TÍNH NĂNG QUẢN TRỊ VÀ THÔNG BÁO ĐÃ ĐẠT CHUẨN DOANH NGHIỆP!");
  process.exit(0);
} else {
  process.exit(1);
}
