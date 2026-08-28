/**
 * ==============================================================================
 * SETUP HELPER & GOOGLE SHEETS MENU INTEGRATION
 * ==============================================================================
 * Script này tự động thêm thanh menu vào Google Sheets để bạn có thể:
 * 1. Khởi tạo tự động các bảng Ideas, Votes, Config, Admins với định dạng đẹp mắt.
 * 2. Cài đặt Webhook Telegram chỉ với 1 click từ menu.
 * 3. Kiểm tra thông tin Bot Telegram trực tiếp trong Google Sheet.
 * ==============================================================================
 */

// Tự động tạo menu khi mở file Google Sheet
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🤖 Quản Lý Bot Telegram")
    .addItem("⚡ 1. Khởi tạo cấu trúc các Sheet", "initSpreadsheet")
    .addItem("🔗 2. Đăng ký Webhook tự động", "setupTelegramWebhookFromUi")
    .addItem("ℹ️ 3. Kiểm tra thông tin Bot", "checkBotInfoFromUi")
    .addItem("📊 4. Format & Căn chỉnh giao diện Sheet", "formatAllSheets")
    .addToUi();
}

/**
 * Khởi tạo toàn bộ cấu trúc các sheet và cấu hình mẫu
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // 1. TẠO SHEET "Ideas"
  let ideasSheet = ss.getSheetByName("Ideas");
  if (!ideasSheet) {
    ideasSheet = ss.insertSheet("Ideas");
  }
  const ideaHeaders = [
    "ID", "Thời Gian", "User ID", "Username", "Tên Ý Tưởng", 
    "Mô Tả Chi Tiết", "Thể Loại", "Tổng Vote", "Message ID", 
    "Chat ID", "Trạng Thái", "Ghi Chú"
  ];
  setupSheetHeader(ideasSheet, ideaHeaders, "#1E3A8A");

  // 2. TẠO SHEET "Votes"
  let votesSheet = ss.getSheetByName("Votes");
  if (!votesSheet) {
    votesSheet = ss.insertSheet("Votes");
  }
  const voteHeaders = ["Thời Gian", "Idea ID", "User ID", "Username", "Hành Động"];
  setupSheetHeader(votesSheet, voteHeaders, "#065F46");

  // 3. TẠO SHEET "Config"
  let configSheet = ss.getSheetByName("Config");
  if (!configSheet) {
    configSheet = ss.insertSheet("Config");
  }
  const configHeaders = ["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"];
  setupSheetHeader(configSheet, configHeaders, "#4C1D95");

  // Điền mẫu cấu hình nếu config còn trống
  if (configSheet.getLastRow() <= 1) {
    configSheet.appendRow(["BOT_TOKEN", "", "Token lấy từ @BotFather"]);
    configSheet.appendRow(["WEBAPP_URL", "", "Link Telegram Mini App hoặc Web Dashboard (tùy chọn)"]);
    configSheet.appendRow(["COMMUNITY_GROUP_ID", "", "ID nhóm Telegram (nếu muốn bot tự bắn bài vào nhóm)"]);
    configSheet.appendRow(["ADMIN_IDS", "", "Danh sách User ID Admin (ngăn cách bằng dấu phẩy)"]);
  }

  // 4. TẠO SHEET "Admins"
  let adminsSheet = ss.getSheetByName("Admins");
  if (!adminsSheet) {
    adminsSheet = ss.insertSheet("Admins");
  }
  const adminHeaders = ["User ID Telegram", "Username / Tên", "Vai Trò", "Ngày Thêm"];
  setupSheetHeader(adminsSheet, adminHeaders, "#831843");

  // Xóa Sheet1 mặc định nếu nó trống
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Trang tính1");
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  ui.alert("✅ Khởi tạo thành công!", "Đã tạo đầy đủ các sheet: Ideas, Votes, Config, Admins.\n\nTiếp theo: Hãy vào sheet 'Config' để điền BOT_TOKEN của bạn!", ui.ButtonSet.OK);
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
  
  // Tự động căn chỉnh độ rộng các cột
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * Căn chỉnh lại toàn bộ độ rộng và format của các sheet
 */
function formatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  sheets.forEach(sheet => {
    const lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      for (let i = 1; i <= lastCol; i++) {
        sheet.autoResizeColumn(i);
      }
    }
  });
  SpreadsheetApp.getUi().alert("✅ Đã căn chỉnh độ rộng các cột tự động!");
}

/**
 * Cài đặt Webhook Telegram từ giao diện Google Sheets
 */
function setupTelegramWebhookFromUi() {
  const ui = SpreadsheetApp.getUi();
  const token = getBotToken();

  if (!token || token === "YOUR_TELEGRAM_BOT_TOKEN_HERE") {
    ui.alert("⚠️ Thiếu BOT_TOKEN!", "Vui lòng nhập BOT_TOKEN vào ô B2 của sheet 'Config' trước khi đăng ký webhook.", ui.ButtonSet.OK);
    return;
  }

  const promptResult = ui.prompt(
    "🔗 Đăng ký Telegram Webhook",
    "Nhập URL Web App của bạn (Lấy sau khi Deploy -> New deployment -> Web app):\n\nVí dụ: https://script.google.com/macros/s/AKfycb.../exec",
    ui.ButtonSet.OK_CANCEL
  );

  if (promptResult.getSelectedButton() === ui.Button.OK) {
    const webAppUrl = promptResult.getResponseText().trim();
    if (!webAppUrl || !webAppUrl.startsWith("https://script.google.com")) {
      ui.alert("❌ URL không hợp lệ! URL phải bắt đầu bằng https://script.google.com");
      return;
    }

    try {
      const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webAppUrl)}`);
      const result = JSON.parse(response.getContentText());

      if (result.ok) {
        ui.alert("🎉 Thành công!", `Webhook đã được cài đặt thành công!\n\nChi tiết: ${result.description}`, ui.ButtonSet.OK);
      } else {
        ui.alert("❌ Lỗi từ Telegram:", result.description, ui.ButtonSet.OK);
      }
    } catch (err) {
      ui.alert("❌ Lỗi kết nối:", err.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Kiểm tra thông tin Bot Telegram (GetMe)
 */
function checkBotInfoFromUi() {
  const ui = SpreadsheetApp.getUi();
  const token = getBotToken();

  if (!token || token === "YOUR_TELEGRAM_BOT_TOKEN_HERE") {
    ui.alert("⚠️ Thiếu BOT_TOKEN!", "Vui lòng nhập BOT_TOKEN vào sheet 'Config' trước.", ui.ButtonSet.OK);
    return;
  }

  try {
    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getMe`);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      const bot = result.result;
      ui.alert(
        "🤖 THÔNG TIN BOT TELEGRAM",
        `• Tên Bot: ${bot.first_name}\n` +
        `• Username: @${bot.username}\n` +
        `• Bot ID: ${bot.id}\n` +
        `• Nhận tin nhắn nhóm: ${bot.can_join_groups ? "Có" : "Không"}\n` +
        `• Trạng thái kết nối: Hoạt động bình thường (OK)`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert("❌ Lỗi kết nối Bot:", result.description, ui.ButtonSet.OK);
    }
  } catch (err) {
    ui.alert("❌ Lỗi gọi API:", err.message, ui.ButtonSet.OK);
  }
}
