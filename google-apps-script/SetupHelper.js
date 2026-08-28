/**
 * ==============================================================================
 * TOOLHUNT ENTERPRISE (v3.0.0) — SETUP HELPER & SCHEMA INITIALIZATION
 * ==============================================================================
 * Tự động tạo và định dạng 6 sheet Enterprise chuẩn:
 * 1. Ideas (17 cột: ID, Thời Gian, User ID, Username, Tên, Mô Tả, Thể Loại, Vote, MsgID, ChatID, Trạng Thái, Ghi Chú, DevID, DevUser, ClaimDate, Milestones, Tổng Bounty)
 * 2. Votes (5 cột: Thời Gian, Idea ID, User ID, Username, Hành Động)
 * 3. Bounties (10 cột: Thời Gian, Bounty ID, Idea ID, Sponsor ID, Sponsor User, Số Lượng, Đơn Vị, Lời Nhắn, Trạng Thái, Ghi Chú)
 * 4. Config (3 cột, 10 cấu hình mặc định)
 * 5. Admins / RBAC (5 cột: User ID, Username, Vai Trò, Trạng Thái, Ngày Thêm)
 * 6. AuditLogs (5 cột: Thời Gian, User ID, Username, Hành Động, Chi Tiết)
 * ==============================================================================
 */

// Tự động tạo menu khi mở file Google Sheet
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🤖 Quản Lý ToolHunt Enterprise")
    .addItem("⚡ 1. Khởi tạo cấu trúc 6 Sheet Enterprise", "initSpreadsheet")
    .addItem("🔗 2. Đăng ký Telegram Webhook tự động", "setupTelegramWebhookFromUi")
    .addItem("ℹ️ 3. Kiểm tra thông tin Bot (getMe)", "checkBotInfoFromUi")
    .addItem("📊 4. Format & Căn chỉnh toàn bộ Sheet", "formatAllSheets")
    .addToUi();
}

/**
 * Khởi tạo toàn bộ 6 sheet Enterprise với headers chuẩn và cấu hình mẫu
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. SHEET "Ideas" (17 Cột)
  let ideasSheet = ss.getSheetByName("Ideas");
  if (!ideasSheet) {
    ideasSheet = ss.insertSheet("Ideas");
  }
  const ideaHeaders = [
    "ID", "Thời Gian", "User ID", "Username", "Tên Ý Tưởng",
    "Mô Tả Chi Tiết", "Thể Loại", "Tổng Vote", "Message ID",
    "Chat ID", "Trạng Thái", "Ghi Chú", "Developer ID",
    "Developer Username", "Claim Date", "Milestones", "Tổng Bounty"
  ];
  setupSheetHeader(ideasSheet, ideaHeaders, "#1E3A8A");

  // 2. SHEET "Votes" (5 Cột)
  let votesSheet = ss.getSheetByName("Votes");
  if (!votesSheet) {
    votesSheet = ss.insertSheet("Votes");
  }
  const voteHeaders = ["Thời Gian", "Idea ID", "User ID", "Username", "Hành Động"];
  setupSheetHeader(votesSheet, voteHeaders, "#065F46");

  // 3. SHEET "Bounties" (10 Cột)
  let bountiesSheet = ss.getSheetByName("Bounties");
  if (!bountiesSheet) {
    bountiesSheet = ss.insertSheet("Bounties");
  }
  const bountyHeaders = [
    "Thời Gian", "Bounty ID", "Idea ID", "Sponsor User ID", "Sponsor Username",
    "Số Lượng", "Đơn Vị", "Lời Nhắn", "Trạng Thái", "Ghi Chú"
  ];
  setupSheetHeader(bountiesSheet, bountyHeaders, "#B45309");

  // 4. SHEET "Config" (3 Cột)
  let configSheet = ss.getSheetByName("Config");
  if (!configSheet) {
    configSheet = ss.insertSheet("Config");
  }
  const configHeaders = ["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"];
  setupSheetHeader(configSheet, configHeaders, "#4C1D95");

  if (configSheet.getLastRow() <= 1) {
    const defaultConfigs = [
      ["BOT_TOKEN", "", "Token lấy từ Telegram @BotFather"],
      ["WEBAPP_URL", "", "Link Telegram Mini App hoặc Web Dashboard"],
      ["COMMUNITY_GROUP_ID", "", "ID nhóm Telegram (nếu muốn bot tự động đăng bài vào nhóm)"],
      ["ADMIN_IDS", "", "Danh sách User ID Admin (ngăn cách bằng dấu phẩy)"],
      ["AI_PROVIDER", "deepseek", "Nhà cung cấp AI Duplicate Detection: deepseek hoặc gemini"],
      ["AI_SIMILARITY_THRESHOLD", "75", "Ngưỡng % tương đồng cảnh báo trùng (0 - 100)"],
      ["DEEPSEEK_API_KEY", "", "API Key DeepSeek Chat"],
      ["GEMINI_API_KEY", "", "API Key Google Gemini Flash"],
      ["DEMO_BASE_URL", "https://toolhunt.enterprise/demo/", "URL tiền tố cho bản demo trải nghiệm"],
      ["FEEDBACK_BASE_URL", "https://toolhunt.enterprise/feedback/", "URL tiền tố cho form góp ý"]
    ];
    defaultConfigs.forEach(row => configSheet.appendRow(row));
  }

  // 5. SHEET "Admins" (5 Cột)
  let adminsSheet = ss.getSheetByName("Admins");
  if (!adminsSheet) {
    adminsSheet = ss.insertSheet("Admins");
  }
  const adminHeaders = ["User ID Telegram", "Username / Tên", "Vai Trò", "Trạng Thái", "Ngày Thêm"];
  setupSheetHeader(adminsSheet, adminHeaders, "#831843");

  // 6. SHEET "AuditLogs" (5 Cột)
  let auditSheet = ss.getSheetByName("AuditLogs");
  if (!auditSheet) {
    auditSheet = ss.insertSheet("AuditLogs");
  }
  const auditHeaders = ["Thời Gian", "User ID", "Username", "Hành Động", "Chi Tiết"];
  setupSheetHeader(auditSheet, auditHeaders, "#374151");

  // Xóa Sheet1 mặc định nếu trống
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Trang tính1");
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  try {
    SpreadsheetApp.getUi().alert("✅ Khởi tạo thành công!", "Đã tạo đầy đủ 6 sheet Enterprise: Ideas, Votes, Bounties, Config, Admins, AuditLogs.\n\nVui lòng kiểm tra sheet 'Config' để điền BOT_TOKEN và API Keys!", SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}

  return ss;
}

/**
 * Format Header cho một sheet
 */
function setupSheetHeader(sheet, headers, bgColor) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setBackground(bgColor);
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * Căn chỉnh lại toàn bộ độ rộng và format của các sheet
 */
function formatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(sheet => {
    const lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      for (let i = 1; i <= lastCol; i++) {
        sheet.autoResizeColumn(i);
      }
    }
  });
  try {
    SpreadsheetApp.getUi().alert("✅ Đã căn chỉnh độ rộng các cột tự động!");
  } catch (e) {}
}

/**
 * Cài đặt Webhook Telegram từ giao diện Google Sheets
 */
function setupTelegramWebhookFromUi() {
  const ui = SpreadsheetApp.getUi();
  const token = typeof getBotToken === "function" ? getBotToken() : "";
  if (!token || token.includes("YOUR_")) {
    ui.alert("⚠️ Thiếu BOT_TOKEN!", "Vui lòng nhập BOT_TOKEN vào ô B2 của sheet 'Config'.", ui.ButtonSet.OK);
    return;
  }
  const promptResult = ui.prompt("🔗 Đăng ký Telegram Webhook", "Nhập Web App URL (Deploy -> New deployment -> Web app):\nVí dụ: https://script.google.com/macros/s/.../exec", ui.ButtonSet.OK_CANCEL);
  if (promptResult.getSelectedButton() === ui.Button.OK) {
    const webAppUrl = promptResult.getResponseText().trim();
    if (!webAppUrl.startsWith("https://script.google.com")) {
      ui.alert("❌ URL không hợp lệ! URL phải bắt đầu bằng https://script.google.com");
      return;
    }
    try {
      const res = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webAppUrl)}`);
      const json = JSON.parse(res.getContentText());
      if (json.ok) {
        ui.alert("🎉 Thành công!", `Webhook đã được cài đặt!\nChi tiết: ${json.description}`, ui.ButtonSet.OK);
      } else {
        ui.alert("❌ Lỗi Telegram:", json.description, ui.ButtonSet.OK);
      }
    } catch (e) {
      ui.alert("❌ Lỗi kết nối:", e.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Kiểm tra thông tin Bot Telegram (getMe)
 */
function checkBotInfoFromUi() {
  const ui = SpreadsheetApp.getUi();
  const token = typeof getBotToken === "function" ? getBotToken() : "";
  if (!token || token.includes("YOUR_")) {
    ui.alert("⚠️ Thiếu BOT_TOKEN!", "Vui lòng nhập BOT_TOKEN vào sheet 'Config' trước.", ui.ButtonSet.OK);
    return;
  }
  try {
    const res = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getMe`);
    const json = JSON.parse(res.getContentText());
    if (json.ok) {
      const bot = json.result;
      ui.alert("🤖 THÔNG TIN BOT TELEGRAM", `• Tên: ${bot.first_name}\n• Username: @${bot.username}\n• Bot ID: ${bot.id}\n• Trạng thái: Hoạt động bình thường (OK)`, ui.ButtonSet.OK);
    } else {
      ui.alert("❌ Lỗi:", json.description, ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert("❌ Lỗi gọi API:", e.message, ui.ButtonSet.OK);
  }
}
