/**
 * ==============================================================================
 * TELEGRAM COMMUNITY IDEA & VOTE BOT - BACKEND GOOGLE APPS SCRIPT
 * ==============================================================================
 * Hệ thống quản lý đề xuất ý tưởng, bình chọn tương tác trực tiếp trên Telegram
 * và đồng bộ 2 chiều với Google Sheets & Telegram Mini App Dashboard.
 * 
 * Tác giả: AutoFillSheet Team
 * Phiên bản: 2.0.0
 * ==============================================================================
 */

// ==============================================================================
// 1. CẤU HÌNH HỆ THỐNG (CONFIGURATION)
// ==============================================================================
// Bạn có thể điền trực tiếp ở đây HOẶC điền vào sheet "Config" (khuyên dùng)
const DEFAULT_CONFIG = {
  BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN_HERE", // Thay bằng Token từ @BotFather
  ADMIN_IDS: [], // Danh sách Telegram User ID của Admin (VD: [123456789, 987654321])
  WEBAPP_URL: "", // URL Telegram Mini App / Web Dashboard (nếu có)
  COMMUNITY_GROUP_ID: "" // ID nhóm cộng đồng (nếu muốn bot chỉ hoạt động trong nhóm này)
};

// ==============================================================================
// 2. HELPER: LẤY CẤU HÌNH TỪ GOOGLE SHEET HOẶC MẶC ĐỊNH
// ==============================================================================
function getConfig(key) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName("Config");
    if (configSheet) {
      const data = configSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim().toUpperCase() === key.toUpperCase()) {
          return data[i][1];
        }
      }
    }
  } catch (e) {
    Logger.log("Lỗi đọc config: " + e.message);
  }
  return DEFAULT_CONFIG[key] || "";
}

function getBotToken() {
  const token = getConfig("BOT_TOKEN");
  return (token && token !== "YOUR_TELEGRAM_BOT_TOKEN_HERE") ? token : DEFAULT_CONFIG.BOT_TOKEN;
}

function getTelegramApiUrl() {
  return "https://api.telegram.org/bot" + getBotToken();
}

// ==============================================================================
// 3. XỬ LÝ YÊU CẦU GET (REST API CHO WEB DASHBOARD & MINI APP)
// ==============================================================================
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || "getIdeas";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 3.1. Lấy danh sách ý tưởng
    if (action === "getIdeas" || action === "list") {
      const ideasSheet = ss.getSheetByName("Ideas");
      if (!ideasSheet) {
        return createJsonResponse({ ok: false, error: "Sheet Ideas chưa được khởi tạo" });
      }

      const data = ideasSheet.getDataRange().getValues();
      if (data.length <= 1) {
        return createJsonResponse({ ok: true, count: 0, data: [] });
      }

      const ideas = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // Bỏ qua dòng trống

        ideas.push({
          id: row[0],
          timestamp: row[1],
          userId: row[2],
          username: row[3],
          title: row[4],
          description: row[5],
          category: row[6] || "Chung",
          votes: parseInt(row[7]) || 0,
          messageId: row[8],
          chatId: row[9],
          status: row[10] || "Đang lấy ý kiến",
          note: row[11] || ""
        });
      }

      // Sắp xếp mặc định: Vote cao nhất lên đầu
      ideas.sort((a, b) => b.votes - a.votes);

      return createJsonResponse({
        ok: true,
        count: ideas.length,
        data: ideas
      });
    }

    // 3.2. Lấy danh sách các ý tưởng mà 1 User đã vote
    if (action === "getUserVotes") {
      const userId = params.userId;
      if (!userId) {
        return createJsonResponse({ ok: false, error: "Thiếu userId" });
      }

      const votesSheet = ss.getSheetByName("Votes");
      const votedIdeaIds = [];
      if (votesSheet) {
        const data = votesSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][2] && data[i][2].toString() === userId.toString()) {
            votedIdeaIds.push(data[i][1]);
          }
        }
      }
      return createJsonResponse({ ok: true, userId: userId, votedIdeas: votedIdeaIds });
    }

    // 3.3. Lấy thống kê tổng quan
    if (action === "getStats") {
      const ideasSheet = ss.getSheetByName("Ideas");
      const votesSheet = ss.getSheetByName("Votes");
      
      const totalIdeas = ideasSheet ? Math.max(0, ideasSheet.getLastRow() - 1) : 0;
      const totalVotes = votesSheet ? Math.max(0, votesSheet.getLastRow() - 1) : 0;
      
      return createJsonResponse({
        ok: true,
        stats: {
          totalIdeas: totalIdeas,
          totalVotes: totalVotes,
          updatedAt: new Date().toISOString()
        }
      });
    }

    // 3.4. Ping test
    if (action === "ping") {
      return createJsonResponse({ ok: true, message: "Telegram Idea Bot Backend is running smoothly!" });
    }

    return createJsonResponse({ ok: false, error: "Action không hợp lệ" });

  } catch (error) {
    return createJsonResponse({ ok: false, error: error.message });
  }
}

// ==============================================================================
// 4. XỬ LÝ YÊU CẦU POST (TELEGRAM WEBHOOK & API GỬI Ý TƯỞNG/VOTE)
// ==============================================================================
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    Logger.log("Không thể lấy Lock: " + e.message);
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ ok: false, error: "Không có dữ liệu gửi đến" });
    }

    const contents = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 4.A. NẾU LÀ YÊU CẦU API TỪ WEB DASHBOARD
    if (contents.apiAction) {
      return handleApiPostRequest(contents, ss);
    }

    // 4.B. NẾU LÀ WEBHOOK TỪ TELEGRAM BOT
    if (contents.message) {
      handleTelegramMessage(contents.message, ss);
    }

    if (contents.callback_query) {
      handleTelegramCallbackQuery(contents.callback_query, ss);
    }

    return createJsonResponse({ ok: true });

  } catch (err) {
    Logger.log("Lỗi doPost: " + err.stack);
    return createJsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ==============================================================================
// 5. XỬ LÝ API POST TỪ WEB DASHBOARD
// ==============================================================================
function handleApiPostRequest(payload, ss) {
  const action = payload.apiAction;

  // Đăng ý tưởng mới từ Web
  if (action === "submitIdea") {
    const { title, description, category, username, userId } = payload;
    if (!title || !description) {
      return createJsonResponse({ ok: false, error: "Tiêu đề và mô tả không được để trống" });
    }

    const ideasSheet = ss.getSheetByName("Ideas") || initSpreadsheet().getSheetByName("Ideas");
    const lastRow = ideasSheet.getLastRow();
    const ideaId = lastRow >= 1 ? lastRow : 1;
    const author = username ? (username.startsWith("@") ? username : "@" + username) : "Web User";

    ideasSheet.appendRow([
      ideaId,
      new Date(),
      userId || "WEB_" + new Date().getTime(),
      author,
      title.trim(),
      description.trim(),
      category || "Chung",
      0, // Tong_Vote
      "", // Message_ID (từ web)
      "", // Chat_ID
      "Đang lấy ý kiến",
      "Đăng từ Web Dashboard"
    ]);

    // Nếu có cài đặt groupId thì tự động forward bài đăng vào nhóm Telegram!
    const groupChatId = getConfig("COMMUNITY_GROUP_ID");
    if (groupChatId) {
      const postText = formatIdeaPost({
        id: ideaId,
        username: author,
        title: title,
        description: description,
        category: category || "Chung",
        status: "⏳ Đang lấy ý kiến",
        votes: 0
      });
      const keyboard = {
        inline_keyboard: [
          [
            { text: "👍 Upvote (0)", callback_data: `vote_${ideaId}` },
            { text: "ℹ️ Chi tiết", callback_data: `info_${ideaId}` }
          ]
        ]
      };
      const res = sendTelegramMessage(groupChatId, postText, null, keyboard);
      if (res && res.result) {
        ideasSheet.getRange(ideasSheet.getLastRow(), 9).setValue(res.result.message_id);
        ideasSheet.getRange(ideasSheet.getLastRow(), 10).setValue(groupChatId);
      }
    }

    return createJsonResponse({ ok: true, ideaId: ideaId, message: "Đăng ý tưởng thành công!" });
  }

  // Upvote từ Web
  if (action === "voteIdea") {
    const { ideaId, userId, username } = payload;
    if (!ideaId || !userId) {
      return createJsonResponse({ ok: false, error: "Thiếu ideaId hoặc userId" });
    }

    const votesSheet = ss.getSheetByName("Votes") || initSpreadsheet().getSheetByName("Votes");
    const ideasSheet = ss.getSheetByName("Ideas") || initSpreadsheet().getSheetByName("Ideas");

    const votesData = votesSheet.getDataRange().getValues();
    let alreadyVoted = false;
    let voteRowIndex = -1;

    for (let i = 1; i < votesData.length; i++) {
      if (votesData[i][1] == ideaId && votesData[i][2] == userId) {
        alreadyVoted = true;
        voteRowIndex = i + 1;
        break;
      }
    }

    const ideasData = ideasSheet.getDataRange().getValues();
    let targetRow = -1;
    let currentVotes = 0;
    let messageId = "";
    let chatId = "";

    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        targetRow = i + 1;
        currentVotes = parseInt(ideasData[i][7]) || 0;
        messageId = ideasData[i][8];
        chatId = ideasData[i][9];
        break;
      }
    }

    if (targetRow === -1) {
      return createJsonResponse({ ok: false, error: "Không tìm thấy ý tưởng" });
    }

    if (alreadyVoted) {
      // Hủy vote
      votesSheet.deleteRow(voteRowIndex);
      currentVotes = Math.max(0, currentVotes - 1);
      ideasSheet.getRange(targetRow, 8).setValue(currentVotes);

      // Đồng bộ sang tin nhắn Telegram nếu có
      if (chatId && messageId) {
        updateMessageButtons(chatId, messageId, ideaId, currentVotes);
      }

      return createJsonResponse({ ok: true, voted: false, currentVotes: currentVotes, message: "Đã hủy vote" });
    } else {
      // Thêm vote
      votesSheet.appendRow([new Date(), ideaId, userId, username || "Web User", "UPVOTE"]);
      currentVotes += 1;
      ideasSheet.getRange(targetRow, 8).setValue(currentVotes);

      // Đồng bộ sang tin nhắn Telegram nếu có
      if (chatId && messageId) {
        updateMessageButtons(chatId, messageId, ideaId, currentVotes);
      }

      return createJsonResponse({ ok: true, voted: true, currentVotes: currentVotes, message: "Đã vote thành công!" });
    }
  }

  return createJsonResponse({ ok: false, error: "apiAction không hợp lệ" });
}

// ==============================================================================
// 6. XỬ LÝ TIN NHẮN & LỆNH TỪ TELEGRAM
// ==============================================================================
function handleTelegramMessage(msg, ss) {
  const text = (msg.text || "").trim();
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || "";
  const username = msg.from.username ? "@" + msg.from.username : (firstName || "Thành viên");

  if (!text) return;

  // Lệnh: /start hoặc /help
  if (text.startsWith("/start") || text.startsWith("/help")) {
    const webappUrl = getConfig("WEBAPP_URL");
    let welcomeMsg = `👋 <b>Xin chào ${username}!</b>\n\n` +
                     `Chào mừng bạn đến với <b>Hệ Thống Đề Xuất & Bình Chọn Ý Tưởng Tool</b> của cộng đồng!\n\n` +
                     `📌 <b>CÁC LỆNH SỬ DỤNG:</b>\n` +
                     `• <code>/idea [Tên Tool] | [Mô tả chi tiết]</code>: Đăng ý tưởng mới\n` +
                     `• <code>/top</code>: Xem Top 5 ý tưởng được vote nhiều nhất\n` +
                     `• <code>/myideas</code>: Xem các ý tưởng bạn đã đăng\n` +
                     `• <code>/stats</code>: Thống kê tổng quan cộng đồng\n\n` +
                     `💡 <i>Ví dụ:</i>\n<code>/idea Tool Auto Sheet | Tự động đọc dữ liệu và điền vào Google Sheets theo thời gian thực</code>`;

    const inlineKeyboard = [];
    if (webappUrl) {
      inlineKeyboard.push([{ text: "🌐 Mở Bảng Ý Tưởng (Web Dashboard)", web_app: { url: webappUrl } }]);
    }
    inlineKeyboard.push([
      { text: "🔥 Top Ý Tưởng", callback_data: "cmd_top" },
      { text: "📊 Thống kê", callback_data: "cmd_stats" }
    ]);

    sendTelegramMessage(chatId, welcomeMsg, msg.message_id, { inline_keyboard: inlineKeyboard });
    return;
  }

  // Lệnh: /idea [Tên Tool] | [Mô tả]
  if (text.startsWith("/idea")) {
    const raw = text.substring(5).trim();
    if (!raw || !raw.includes("|")) {
      const guideText = `⚠️ <b>Cú pháp chưa chính xác!</b>\n\n` +
                        `Vui lòng nhập theo định dạng:\n` +
                        `<code>/idea [Tên Ý Tưởng / Tool] | [Mô tả chi tiết tính năng, mục đích]</code>\n\n` +
                        `💡 <i>Ví dụ mẫu:</i>\n` +
                        `<code>/idea Cào Dữ Liệu Web | Tool cào giá sản phẩm từ Shopee lưu vào Google Sheet mỗi ngày</code>`;
      sendTelegramMessage(chatId, guideText, msg.message_id);
      return;
    }

    const parts = raw.split("|");
    const title = parts[0].trim();
    const description = parts.slice(1).join("|").trim();

    if (title.length < 3) {
      sendTelegramMessage(chatId, "⚠️ Tên ý tưởng quá ngắn (tối thiểu 3 ký tự).", msg.message_id);
      return;
    }

    // Lưu vào Sheet Ideas
    const ideasSheet = ss.getSheetByName("Ideas") || initSpreadsheet().getSheetByName("Ideas");
    const lastRow = ideasSheet.getLastRow();
    const ideaId = lastRow >= 1 ? lastRow : 1; // ID số tự tăng

    // Soạn bài đăng đẹp mắt
    const postText = formatIdeaPost({
      id: ideaId,
      username: username,
      title: title,
      description: description,
      status: "⏳ Đang lấy ý kiến",
      votes: 0
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "👍 Upvote (0)", callback_data: `vote_${ideaId}` },
          { text: "ℹ️ Chi tiết", callback_data: `info_${ideaId}` }
        ]
      ]
    };

    const res = sendTelegramMessage(chatId, postText, null, keyboard);
    if (res && res.result) {
      const sentMsgId = res.result.message_id;
      ideasSheet.appendRow([
        ideaId,
        new Date(),
        userId,
        username,
        title,
        description,
        "Chung",
        0, // Votes
        sentMsgId,
        chatId,
        "Đang lấy ý kiến",
        ""
      ]);
    }
    return;
  }

  // Lệnh: /top
  if (text.startsWith("/top")) {
    sendTopIdeasMessage(chatId, ss, msg.message_id);
    return;
  }

  // Lệnh: /myideas
  if (text.startsWith("/myideas")) {
    sendUserIdeasMessage(chatId, userId, username, ss, msg.message_id);
    return;
  }

  // Lệnh: /stats
  if (text.startsWith("/stats")) {
    sendStatsMessage(chatId, ss, msg.message_id);
    return;
  }

  // Lệnh Admin: /status <ID> <Trạng thái mới>
  if (text.startsWith("/status")) {
    if (!checkIsAdmin(userId, ss)) {
      sendTelegramMessage(chatId, "⛔ Bạn không có quyền Admin để thực hiện lệnh này.", msg.message_id);
      return;
    }

    const args = text.replace("/status", "").trim().split(" ");
    if (args.length < 2) {
      sendTelegramMessage(chatId, "⚠️ Cú pháp: <code>/status [ID] [Trạng thái mới]</code>\nVí dụ: <code>/status 1 Đang phát triển</code>", msg.message_id);
      return;
    }

    const targetId = parseInt(args[0]);
    const newStatus = args.slice(1).join(" ").trim();
    updateIdeaStatus(targetId, newStatus, ss, chatId, msg.message_id);
    return;
  }
}

// ==============================================================================
// 7. XỬ LÝ CALLBACK QUERY (NÚT BẤM INLINE KEYBOARD)
// ==============================================================================
function handleTelegramCallbackQuery(cb, ss) {
  const cbId = cb.id;
  const cbData = cb.data || "";
  const cbUserId = cb.from.id;
  const cbUsername = cb.from.username ? "@" + cb.from.username : (cb.from.first_name || "User");
  const msg = cb.message;
  
  if (!msg) return;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  // 7.1. Xử lý nút Upvote
  if (cbData.startsWith("vote_")) {
    const ideaId = parseInt(cbData.replace("vote_", ""));
    const votesSheet = ss.getSheetByName("Votes") || initSpreadsheet().getSheetByName("Votes");
    const ideasSheet = ss.getSheetByName("Ideas") || initSpreadsheet().getSheetByName("Ideas");

    // Kiểm tra xem đã vote chưa
    const votesData = votesSheet.getDataRange().getValues();
    let alreadyVoted = false;
    let voteRowIndex = -1;

    for (let i = 1; i < votesData.length; i++) {
      if (votesData[i][1] == ideaId && votesData[i][2] == cbUserId) {
        alreadyVoted = true;
        voteRowIndex = i + 1;
        break;
      }
    }

    const ideasData = ideasSheet.getDataRange().getValues();
    let targetRow = -1;
    let currentVotes = 0;

    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        targetRow = i + 1;
        currentVotes = parseInt(ideasData[i][7]) || 0;
        break;
      }
    }

    if (targetRow === -1) {
      answerCallbackQuery(cbId, "⚠️ Không tìm thấy thông tin ý tưởng này trên hệ thống.", true);
      return;
    }

    if (alreadyVoted) {
      // HỦY VOTE (Toggle Unvote)
      votesSheet.deleteRow(voteRowIndex);
      currentVotes = Math.max(0, currentVotes - 1);
      ideasSheet.getRange(targetRow, 8).setValue(currentVotes); // Cột H là Tong_Vote (cột 8)

      // Cập nhật lại giao diện nút bấm
      updateMessageButtons(chatId, messageId, ideaId, currentVotes);
      answerCallbackQuery(cbId, `↩️ Bạn đã rút lại lượt vote cho ý tưởng #${ideaId}.`, false);
    } else {
      // THÊM VOTE MỚI
      votesSheet.appendRow([new Date(), ideaId, cbUserId, cbUsername, "UPVOTE"]);
      currentVotes += 1;
      ideasSheet.getRange(targetRow, 8).setValue(currentVotes);

      // Cập nhật lại giao diện nút bấm
      updateMessageButtons(chatId, messageId, ideaId, currentVotes);
      answerCallbackQuery(cbId, `🎉 Tuyệt vời! Bạn đã vote cho ý tưởng #${ideaId} (Tổng: ${currentVotes} vote).`, false);
    }
    return;
  }

  // 7.2. Xem thông tin chi tiết
  if (cbData.startsWith("info_")) {
    const ideaId = parseInt(cbData.replace("info_", ""));
    const ideasSheet = ss.getSheetByName("Ideas");
    if (!ideasSheet) return;

    const ideasData = ideasSheet.getDataRange().getValues();
    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        const row = ideasData[i];
        const infoMsg = `📌 <b>THÔNG TIN Ý TƯỞNG #${ideaId}</b>\n\n` +
                        `🛠 <b>Tên:</b> ${row[4]}\n` +
                        `👤 <b>Người đề xuất:</b> ${row[3]}\n` +
                        `📂 <b>Thể loại:</b> ${row[6] || "Chung"}\n` +
                        `📊 <b>Trạng thái:</b> <code>${row[10] || "Đang lấy ý kiến"}</code>\n` +
                        `👍 <b>Tổng số vote:</b> ${row[7] || 0}\n` +
                        `⏰ <b>Thời gian tạo:</b> ${Utilities.formatDate(new Date(row[1]), "GMT+7", "dd/MM/yyyy HH:mm")}\n\n` +
                        `📝 <b>Nội dung chi tiết:</b>\n${row[5]}`;
        sendTelegramMessage(chatId, infoMsg, messageId);
        answerCallbackQuery(cbId, "Đã gửi thông tin chi tiết!");
        return;
      }
    }
    answerCallbackQuery(cbId, "Không tìm thấy ý tưởng!", true);
    return;
  }

  // 7.3. Callback lệnh Top & Stats
  if (cbData === "cmd_top") {
    sendTopIdeasMessage(chatId, ss);
    answerCallbackQuery(cbId, "");
    return;
  }

  if (cbData === "cmd_stats") {
    sendStatsMessage(chatId, ss);
    answerCallbackQuery(cbId, "");
    return;
  }
}

// ==============================================================================
// 8. CÁC HÀM XỬ LÝ BỔ TRỢ (HELPERS)
// ==============================================================================

function formatIdeaPost(data) {
  return `💡 <b>ĐỀ XUẤT Ý TƯỞNG MỚI (#${data.id})</b>\n` +
         `━━━━━━━━━━━━━━━━━━━━━━\n` +
         `👤 <b>Người đề xuất:</b> ${data.username}\n` +
         `🛠 <b>Tên ý tưởng:</b> <b>${escapeHtml(data.title)}</b>\n` +
         `📝 <b>Mô tả:</b> ${escapeHtml(data.description)}\n` +
         `📊 <b>Trạng thái:</b> <code>${data.status}</code>\n` +
         `━━━━━━━━━━━━━━━━━━━━━━\n` +
         `👉 <i>Bấm nút bên dưới để ủng hộ ý tưởng này vào lộ trình phát triển!</i>`;
}

function updateMessageButtons(chatId, messageId, ideaId, votes) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: `👍 Upvote (${votes})`, callback_data: `vote_${ideaId}` },
        { text: "ℹ️ Chi tiết", callback_data: `info_${ideaId}` }
      ]
    ]
  };
  editMessageReplyMarkup(chatId, messageId, keyboard);
}

function sendTopIdeasMessage(chatId, ss, replyToMsgId) {
  const ideasSheet = ss.getSheetByName("Ideas");
  if (!ideasSheet || ideasSheet.getLastRow() <= 1) {
    sendTelegramMessage(chatId, "Chưa có ý tưởng nào được đề xuất.", replyToMsgId);
    return;
  }

  const data = ideasSheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      list.push({
        id: data[i][0],
        title: data[i][4],
        votes: parseInt(data[i][7]) || 0,
        author: data[i][3],
        status: data[i][10] || "Đang lấy ý kiến"
      });
    }
  }

  list.sort((a, b) => b.votes - a.votes);
  const topList = list.slice(0, 5);

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  let msg = `🔥 <b>TOP Ý TƯỞNG ĐƯỢC QUAN TÂM NHẤT:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  topList.forEach((item, index) => {
    msg += `${medals[index] || "🔹"} <b>#${item.id} - ${escapeHtml(item.title)}</b>\n` +
           `   👍 <b>${item.votes} votes</b> | 👤 ${item.author} | <code>${item.status}</code>\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n💡 Gõ <code>/idea [Tên] | [Mô tả]</code> để gửi thêm ý tưởng mới!`;
  sendTelegramMessage(chatId, msg, replyToMsgId);
}

function sendUserIdeasMessage(chatId, userId, username, ss, replyToMsgId) {
  const ideasSheet = ss.getSheetByName("Ideas");
  if (!ideasSheet || ideasSheet.getLastRow() <= 1) {
    sendTelegramMessage(chatId, "Bạn chưa đăng ý tưởng nào.", replyToMsgId);
    return;
  }

  const data = ideasSheet.getDataRange().getValues();
  const userIdeas = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][2].toString() === userId.toString()) {
      userIdeas.push({
        id: data[i][0],
        title: data[i][4],
        votes: parseInt(data[i][7]) || 0,
        status: data[i][10] || "Đang lấy ý kiến"
      });
    }
  }

  if (userIdeas.length === 0) {
    sendTelegramMessage(chatId, `👤 <b>${username}</b> ơi, bạn chưa đề xuất ý tưởng nào!\nHãy dùng lệnh <code>/idea [Tên] | [Mô tả]</code> để đăng nhé.`, replyToMsgId);
    return;
  }

  let msg = `📋 <b>DANH SÁCH Ý TƯỞNG CỦA BẠN (${username}):</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  userIdeas.forEach((item) => {
    msg += `• <b>#${item.id} - ${escapeHtml(item.title)}</b>\n` +
           `   👍 ${item.votes} votes | 📊 Trạng thái: <code>${item.status}</code>\n\n`;
  });

  sendTelegramMessage(chatId, msg, replyToMsgId);
}

function sendStatsMessage(chatId, ss, replyToMsgId) {
  const ideasSheet = ss.getSheetByName("Ideas");
  const votesSheet = ss.getSheetByName("Votes");

  const totalIdeas = ideasSheet ? Math.max(0, ideasSheet.getLastRow() - 1) : 0;
  const totalVotes = votesSheet ? Math.max(0, votesSheet.getLastRow() - 1) : 0;

  const msg = `📊 <b>THỐNG KÊ HOẠT ĐỘNG CỘNG ĐỒNG:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💡 <b>Tổng số ý tưởng đã gửi:</b> ${totalIdeas}\n` +
              `👍 <b>Tổng số lượt bình chọn (Upvote):</b> ${totalVotes}\n` +
              `🚀 <b>Cộng đồng:</b> Đang tích cực đóng góp & phát triển!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━`;
  sendTelegramMessage(chatId, msg, replyToMsgId);
}

function updateIdeaStatus(ideaId, newStatus, ss, chatId, replyToMsgId) {
  const ideasSheet = ss.getSheetByName("Ideas");
  if (!ideasSheet) return;

  const data = ideasSheet.getDataRange().getValues();
  let foundRow = -1;
  let title = "";

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == ideaId) {
      foundRow = i + 1;
      title = data[i][4];
      break;
    }
  }

  if (foundRow === -1) {
    sendTelegramMessage(chatId, `⚠️ Không tìm thấy ý tưởng có ID #${ideaId}.`, replyToMsgId);
    return;
  }

  ideasSheet.getRange(foundRow, 11).setValue(newStatus); // Cột K là Trang_Thai (cột 11)
  sendTelegramMessage(chatId, `✅ Đã cập nhật trạng thái ý tưởng <b>#${ideaId} (${escapeHtml(title)})</b> thành: <code>${newStatus}</code>`, replyToMsgId);
}

function checkIsAdmin(userId, ss) {
  const adminsSheet = ss.getSheetByName("Admins");
  if (adminsSheet) {
    const data = adminsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === userId.toString()) {
        return true;
      }
    }
  }
  return DEFAULT_CONFIG.ADMIN_IDS.includes(userId);
}

function escapeHtml(text) {
  if (!text) return "";
  return text.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// 9. CÁC HÀM GỌI TELEGRAM API TRỰC TIẾP
// ==============================================================================
function sendTelegramMessage(chatId, text, replyToMsgId, replyMarkup) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };
  if (replyToMsgId) payload.reply_to_message_id = replyToMsgId;
  if (replyMarkup) payload.reply_markup = JSON.stringify(replyMarkup);

  return callTelegramApi("sendMessage", payload);
}

function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: JSON.stringify(replyMarkup)
  };
  return callTelegramApi("editMessageReplyMarkup", payload);
}

function answerCallbackQuery(callbackQueryId, text, showAlert) {
  const payload = {
    callback_query_id: callbackQueryId,
    text: text || "",
    show_alert: showAlert || false
  };
  return callTelegramApi("answerCallbackQuery", payload);
}

function callTelegramApi(endpoint, payload) {
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    const response = UrlFetchApp.fetch(getTelegramApiUrl() + "/" + endpoint, options);
    return JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log(`Lỗi gọi API [${endpoint}]: ` + e.message);
    return null;
  }
}
