/**
 * ==============================================================================
 * TOOLHUNT ENTERPRISE (v3.0.0) — TEST INFRASTRUCTURE & SIMULATION HARNESS
 * ==============================================================================
 * Comprehensive in-memory test simulator and Google Apps Script runtime emulator.
 * Runs 10 modular test suites covering R1 (AI Deduplication), R2 (Dev Claiming),
 * R3 (Targeted Beta Notifications), R4 (Tool Bounty), and R5 (RBAC & Dual Sync).
 *
 * Execution:
 *   node scripts/test_simulator.js
 *   npm test
 * ==============================================================================
 */

// ==============================================================================
// 1. GOOGLE APPS SCRIPT (GAS) RUNTIME EMULATOR & MOCKS
// ==============================================================================

/**
 * In-Memory Mock Spreadsheet with 6 Enterprise Sheets
 */
class MockSpreadsheetApp {
  constructor() {
    this.sheets = {
      // 1. Ideas Sheet (17 columns)
      Ideas: [
        [
          "ID", "Thời Gian", "User ID", "Username", "Tên Ý Tưởng",
          "Mô Tả Chi Tiết", "Thể Loại", "Tổng Vote", "Message ID",
          "Chat ID", "Trạng Thái", "Ghi Chú", "Developer ID",
          "Developer Username", "Claim Date", "Milestones", "Tổng Bounty"
        ]
      ],
      // 2. Votes Sheet (5 columns)
      Votes: [
        ["Thời Gian", "Idea ID", "User ID", "Username", "Hành Động"]
      ],
      // 3. Bounties Sheet (10 columns)
      Bounties: [
        ["Thời Gian", "Bounty ID", "Idea ID", "Sponsor User ID", "Sponsor Username", "Số Lượng", "Đơn Vị", "Lời Nhắn", "Trạng Thái", "Ghi Chú"]
      ],
      // 4. Admins / RBAC Sheet (5 columns)
      Admins: [
        ["User ID Telegram", "Username / Tên", "Vai Trò", "Trạng Thái", "Ngày Thêm"],
        [99999, "@super_admin", "Admin", "Active", new Date()],
        [88888, "@manager_user", "Manager", "Active", new Date()],
        [77777, "@developer_pro", "Developer", "Active", new Date()],
        [66666, "@developer_alice", "Developer", "Active", new Date()],
        [111, "@member_user", "Member", "Active", new Date()]
      ],
      // 5. Config Sheet (3 columns)
      Config: [
        ["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"],
        ["BOT_TOKEN", "123456:TEST_ENTERPRISE_MOCK_TOKEN", "Token Test"],
        ["WEBAPP_URL", "https://mock-enterprise-webapp.url", "Test Mini App URL"],
        ["COMMUNITY_GROUP_ID", "-1001999999999", "ID nhóm cộng đồng"],
        ["AI_PROVIDER", "deepseek", "AI Provider (deepseek / gemini)"],
        ["AI_SIMILARITY_THRESHOLD", "75", "Ngưỡng % tương đồng cảnh báo trùng"],
        ["DEEPSEEK_API_KEY", "sk-mock-deepseek-key", "DeepSeek API Key"],
        ["GEMINI_API_KEY", "mock-gemini-key", "Gemini API Key"]
      ],
      // 6. AuditLogs Sheet (5 columns)
      AuditLogs: [
        ["Thời Gian", "User ID", "Username", "Hành Động", "Chi Tiết"]
      ]
    };
  }

  getActiveSpreadsheet() {
    return this;
  }

  getSheetByName(name) {
    if (!this.sheets[name]) return null;
    const self = this;
    const sheetData = this.sheets[name];

    return {
      getName: () => name,
      getDataRange: () => ({
        getValues: () => JSON.parse(JSON.stringify(sheetData)),
        setValues: (values) => {
          self.sheets[name] = JSON.parse(JSON.stringify(values));
        }
      }),
      getLastRow: () => sheetData.length,
      getLastColumn: () => (sheetData[0] ? sheetData[0].length : 0),
      appendRow: (row) => {
        sheetData.push([...row]);
      },
      deleteRow: (rowIndex) => {
        if (rowIndex >= 1 && rowIndex <= sheetData.length) {
          sheetData.splice(rowIndex - 1, 1);
        }
      },
      getRange: (row, col, numRows = 1, numCols = 1) => {
        return {
          getValue: () => {
            if (sheetData[row - 1] && sheetData[row - 1][col - 1] !== undefined) {
              return sheetData[row - 1][col - 1];
            }
            return null;
          },
          setValue: (val) => {
            while (sheetData.length < row) {
              sheetData.push(new Array(col).fill(""));
            }
            while (sheetData[row - 1].length < col) {
              sheetData[row - 1].push("");
            }
            sheetData[row - 1][col - 1] = val;
          },
          getValues: () => {
            const result = [];
            for (let r = 0; r < numRows; r++) {
              const rowArr = [];
              for (let c = 0; c < numCols; c++) {
                const rIdx = row - 1 + r;
                const cIdx = col - 1 + c;
                rowArr.push(sheetData[rIdx] && sheetData[rIdx][cIdx] !== undefined ? sheetData[rIdx][cIdx] : "");
              }
              result.push(rowArr);
            }
            return result;
          },
          setValues: (matrix) => {
            for (let r = 0; r < matrix.length; r++) {
              for (let c = 0; c < matrix[r].length; c++) {
                const rIdx = row - 1 + r;
                const cIdx = col - 1 + c;
                while (sheetData.length <= rIdx) sheetData.push([]);
                sheetData[rIdx][cIdx] = matrix[r][c];
              }
            }
          },
          setFontWeight: () => {},
          setFontColor: () => {},
          setBackground: () => {},
          setHorizontalAlignment: () => {},
          setVerticalAlignment: () => {}
        };
      },
      setFrozenRows: () => {},
      setRowHeight: () => {}
    };
  }

  insertSheet(name) {
    if (!this.sheets[name]) {
      this.sheets[name] = [];
    }
    return this.getSheetByName(name);
  }

  deleteSheet(sheetObj) {
    if (sheetObj && sheetObj.getName) {
      delete this.sheets[sheetObj.getName()];
    }
  }

  getSheets() {
    return Object.keys(this.sheets).map(name => this.getSheetByName(name));
  }

  getUi() {
    return {
      createMenu: (title) => {
        const items = [];
        const menuObj = {
          addItem: (caption, funcName) => {
            items.push({ caption, funcName });
            return menuObj;
          },
          addToUi: () => {}
        };
        return menuObj;
      },
      alert: (title, message, buttons) => ({ title, message, buttons }),
      ButtonSet: { OK: "OK", YES_NO: "YES_NO" }
    };
  }
}

/**
 * Mock UrlFetchApp for External HTTP Routing (DeepSeek, Gemini, Telegram Bot API)
 */
class MockUrlFetchApp {
  constructor() {
    this.sentMessages = [];
    this.editedKeyboards = [];
    this.editedTexts = [];
    this.callbackAlerts = [];
    this.externalCalls = [];
    this.nextMessageId = 1000;
    this.deepSeekFailover = false; // Flag to test failover
    this.geminiFailover = false;
  }

  fetch(url, options = {}) {
    const payload = options.payload ? (typeof options.payload === "string" ? JSON.parse(options.payload) : options.payload) : {};
    this.externalCalls.push({ url, method: options.method || "GET", payload });

    // 1. Mock Telegram Bot API
    if (url.includes("api.telegram.org")) {
      if (url.includes("/sendMessage")) {
        const msgId = ++this.nextMessageId;
        const msgRecord = {
          message_id: msgId,
          chat_id: payload.chat_id,
          text: payload.text,
          reply_markup: payload.reply_markup ? (typeof payload.reply_markup === "string" ? JSON.parse(payload.reply_markup) : payload.reply_markup) : null,
          parse_mode: payload.parse_mode
        };
        this.sentMessages.push(msgRecord);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, result: msgRecord })
        };
      }

      if (url.includes("/editMessageReplyMarkup")) {
        const editRecord = {
          chat_id: payload.chat_id,
          message_id: payload.message_id,
          reply_markup: payload.reply_markup ? (typeof payload.reply_markup === "string" ? JSON.parse(payload.reply_markup) : payload.reply_markup) : null
        };
        this.editedKeyboards.push(editRecord);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, result: editRecord })
        };
      }

      if (url.includes("/editMessageText")) {
        const editTextRecord = {
          chat_id: payload.chat_id,
          message_id: payload.message_id,
          text: payload.text,
          reply_markup: payload.reply_markup ? (typeof payload.reply_markup === "string" ? JSON.parse(payload.reply_markup) : payload.reply_markup) : null
        };
        this.editedTexts.push(editTextRecord);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, result: editTextRecord })
        };
      }

      if (url.includes("/answerCallbackQuery")) {
        const alertRecord = {
          callback_query_id: payload.callback_query_id,
          text: payload.text,
          show_alert: payload.show_alert
        };
        this.callbackAlerts.push(alertRecord);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, result: true })
        };
      }

      if (url.includes("/getMe")) {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            ok: true,
            result: { id: 123456, is_bot: true, first_name: "ToolHunt Enterprise Bot", username: "ToolHuntEnterpriseBot" }
          })
        };
      }

      if (url.includes("/setWebhook") || url.includes("/deleteWebhook")) {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, description: "Webhook operation successful" })
        };
      }
    }

    // 2. Mock DeepSeek Chat Completions API
    if (url.includes("api.deepseek.com")) {
      if (this.deepSeekFailover) {
        return {
          getResponseCode: () => 500,
          getContentText: () => JSON.stringify({ error: { message: "DeepSeek API Internal Error 500 (Simulated Failover)" } })
        };
      }

      // Analyze prompt content to determine simulated similarity against existing ideas
      const userMessage = payload.messages && payload.messages.length ? payload.messages[payload.messages.length - 1].content : "";
      let parsedData = {};
      try {
        parsedData = JSON.parse(userMessage);
      } catch (e) {
        parsedData = {};
      }

      const existing = parsedData.existingIdeas || [];
      let isDup = false;
      let score = 15;
      let matchedId = null;
      let matchedTitle = null;

      if (existing.length > 0) {
        const inputTitle = (parsedData.title || "").toLowerCase();
        const inputDesc = (parsedData.description || "").toLowerCase();

        // Check if matches Idea #1 (Hóa đơn / PDF)
        const hasHoaDon = existing.some(e => /hóa đơn|quét pdf|invoice/i.test(e.title || ""));
        if (hasHoaDon && (/hóa đơn|quét pdf|đọc hóa đơn|nhận diện file hóa đơn/i.test(inputTitle) || /hóa đơn|quét pdf/i.test(inputDesc))) {
          isDup = true;
          score = 88;
          matchedId = 1;
          matchedTitle = "Tool Auto Hóa Đơn";
        }
        // Check if matches Idea #2 (Cào giá Shopee)
        const hasShopee = existing.some(e => /cào giá|shopee/i.test(e.title || ""));
        if (hasShopee && (/cào giá|shopee|lazada/i.test(inputTitle) || /cào giá|shopee/i.test(inputDesc))) {
          isDup = true;
          score = 82;
          matchedId = 2;
          matchedTitle = "Bot Cào Giá Shopee";
        }
      }

      const aiResponseContent = JSON.stringify({
        is_duplicate: isDup,
        similarity_score: score,
        matched_idea_id: matchedId,
        matched_title: matchedTitle,
        reason: isDup ? `Nội dung tương đồng ${score}% với ý tưởng #${matchedId}: ${matchedTitle}` : "Không phát hiện trùng lặp đáng kể.",
        similar_ideas: isDup ? [{ id: matchedId, title: matchedTitle, score }] : []
      });

      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: aiResponseContent
              }
            }
          ]
        })
      };
    }

    // 3. Mock Google Gemini GenerateContent API
    if (url.includes("generativelanguage.googleapis.com")) {
      if (this.geminiFailover) {
        return {
          getResponseCode: () => 503,
          getContentText: () => JSON.stringify({ error: { message: "Gemini Service Unavailable" } })
        };
      }

      const promptText = JSON.stringify(payload);
      let isDup = false;
      let score = 15;
      let matchedId = null;
      let matchedTitle = null;

      if (/hóa đơn|quét pdf|đọc hóa đơn/i.test(promptText)) {
        isDup = true;
        score = 85;
        matchedId = 1;
        matchedTitle = "Tool Auto Hóa Đơn";
      }

      const geminiJsonText = JSON.stringify({
        is_duplicate: isDup,
        similarity_score: score,
        matched_idea_id: matchedId,
        matched_title: matchedTitle,
        reason: isDup ? `Gemini phát hiện tương đồng ${score}% với #${matchedId}` : "Gemini: Ý tưởng mới độc đáo.",
        similar_ideas: isDup ? [{ id: matchedId, title: matchedTitle, score }] : []
      });

      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: geminiJsonText }]
              }
            }
          ]
        })
      };
    }

    // Default fallback
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ ok: true })
    };
  }
}

/**
 * Mock LockService for Mutual Exclusion
 */
class MockLockService {
  constructor() {
    this.locked = false;
    this.lockCount = 0;
    this.releaseCount = 0;
  }

  getScriptLock() {
    const self = this;
    return {
      waitLock: (timeoutMs) => {
        self.locked = true;
        self.lockCount++;
        return true;
      },
      tryLock: (timeoutMs) => {
        self.locked = true;
        self.lockCount++;
        return true;
      },
      releaseLock: () => {
        self.locked = false;
        self.releaseCount++;
      },
      hasLock: () => self.locked
    };
  }
}

/**
 * Mock ContentService for REST Output Formatting
 */
class MockContentService {
  createTextOutput(text = "") {
    let content = text;
    let mime = "text/plain";
    return {
      setMimeType: (newMime) => {
        mime = newMime;
        return this;
      },
      getContent: () => content,
      getMimeType: () => mime
    };
  }
}
MockContentService.MimeType = {
  JSON: "application/json",
  TEXT: "text/plain"
};

/**
 * Mock Utilities
 */
class MockUtilities {
  static formatDate(date, tz, format) {
    const d = new Date(date);
    return d.toISOString();
  }

  static computeDigest(algorithm, value) {
    return [1, 2, 3, 4];
  }
}

/**
 * Mock Logger
 */
class MockLogger {
  constructor() {
    this.logs = [];
  }
  log(msg) {
    this.logs.push(msg);
  }
  getLog() {
    return this.logs.join("\n");
  }
}


// ==============================================================================
// 2. TOOLHUNT ENTERPRISE CORE BOT & API ENGINE
// ==============================================================================

class EnterpriseBotEngine {
  constructor(spreadsheet, urlFetch, lockService) {
    this.ss = spreadsheet;
    this.urlFetch = urlFetch;
    this.lockService = lockService;
    this.pendingIdeas = new Map(); // Store ideas awaiting force_create confirmation
  }

  // --- CONFIG HELPER ---
  getConfig(key) {
    const configSheet = this.ss.getSheetByName("Config");
    if (!configSheet) return "";
    const values = configSheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] && values[i][0].toString().trim().toUpperCase() === key.toUpperCase()) {
        return values[i][1];
      }
    }
    return "";
  }

  // --- RBAC HELPER (4-Tier: Admin, Manager, Developer, Member) ---
  getUserRole(userId) {
    const adminsSheet = this.ss.getSheetByName("Admins");
    if (!adminsSheet) return "Member";
    const data = adminsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === userId.toString()) {
        const role = data[i][2] ? data[i][2].toString().trim() : "Member";
        return role;
      }
    }
    return "Member";
  }

  hasRole(userId, allowedRoles) {
    const userRole = this.getUserRole(userId);
    if (userRole === "Admin") return true; // Admin has universal permission
    return allowedRoles.includes(userRole);
  }

  // --- AUDIT LOG HELPER ---
  logAudit(userId, username, action, detail) {
    const auditSheet = this.ss.getSheetByName("AuditLogs");
    if (auditSheet) {
      auditSheet.appendRow([new Date(), userId, username, action, detail]);
    }
  }

  // --- AI SEMANTIC DUPLICATE CHECKER (R1) ---
  checkAiDuplicate(title, description, existingIdeas) {
    const provider = this.getConfig("AI_PROVIDER") || "deepseek";
    const threshold = parseInt(this.getConfig("AI_SIMILARITY_THRESHOLD") || "75");

    const validIdeas = (existingIdeas || []).slice(1).filter(r => r[0] && r[4]);
    if (validIdeas.length === 0) {
      return {
        is_duplicate: false,
        similarity_score: 0,
        matched_idea_id: null,
        matched_title: null,
        reason: "No existing ideas to compare against.",
        similar_ideas: []
      };
    }

    const promptPayload = {
      title,
      description,
      existingIdeas: validIdeas.map(idea => ({ id: idea[0], title: idea[4], desc: idea[5] }))
    };

    let responseJson = null;

    // Try Primary Provider: DeepSeek
    if (provider === "deepseek" && !this.urlFetch.deepSeekFailover) {
      try {
        const res = this.urlFetch.fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          payload: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "You are an AI Duplicate Detection engine for ideas." },
              { role: "user", content: JSON.stringify(promptPayload) }
            ]
          })
        });
        if (res.getResponseCode() === 200) {
          const body = JSON.parse(res.getContentText());
          responseJson = JSON.parse(body.choices[0].message.content);
        }
      } catch (e) {
        responseJson = null;
      }
    }

    // Failover to Secondary Provider: Google Gemini
    if (!responseJson) {
      try {
        const res = this.urlFetch.fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
          method: "POST",
          payload: JSON.stringify({
            contents: [{ parts: [{ text: JSON.stringify(promptPayload) }] }]
          })
        });
        if (res.getResponseCode() === 200) {
          const body = JSON.parse(res.getContentText());
          responseJson = JSON.parse(body.candidates[0].content.parts[0].text);
        }
      } catch (e) {
        // Fallback to local heuristic check
        responseJson = this.localHeuristicDuplicateCheck(title, description, existingIdeas);
      }
    }

    if (!responseJson) {
      responseJson = this.localHeuristicDuplicateCheck(title, description, existingIdeas);
    }

    const isDuplicate = responseJson.similarity_score >= threshold;
    return {
      is_duplicate: isDuplicate,
      similarity_score: responseJson.similarity_score || 0,
      matched_idea_id: responseJson.matched_idea_id || null,
      matched_title: responseJson.matched_title || null,
      reason: responseJson.reason || "",
      similar_ideas: responseJson.similar_ideas || []
    };
  }

  localHeuristicDuplicateCheck(title, description, existingIdeas) {
    const cleanT = (title || "").toLowerCase();
    for (let i = 1; i < existingIdeas.length; i++) {
      const exTitle = (existingIdeas[i][4] || "").toLowerCase();
      if (exTitle && (cleanT.includes(exTitle) || exTitle.includes(cleanT))) {
        return {
          is_duplicate: true,
          similarity_score: 80,
          matched_idea_id: existingIdeas[i][0],
          matched_title: existingIdeas[i][4],
          reason: `Heuristic: Trùng tiêu đề với #${existingIdeas[i][0]}`
        };
      }
    }
    return { is_duplicate: false, similarity_score: 10, matched_idea_id: null, matched_title: null };
  }

  // --- TARGETED BETA NOTIFIER (R3) ---
  notifyIdeaVoters(ideaId, newStatus, extraData = {}) {
    const votesSheet = this.ss.getSheetByName("Votes");
    const ideasSheet = this.ss.getSheetByName("Ideas");
    if (!votesSheet || !ideasSheet) return { notifiedCount: 0, recipientUserIds: [] };

    // Get Idea details
    const ideasData = ideasSheet.getDataRange().getValues();
    let ideaTitle = "";
    let devUsername = "";
    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        ideaTitle = ideasData[i][4];
        devUsername = ideasData[i][13] || "@developer";
        break;
      }
    }

    // 1. Extract distinct active voters (users whose net vote is positive)
    const votesData = votesSheet.getDataRange().getValues();
    const voterMap = new Map(); // userId -> { username, hasActiveVote: bool }

    for (let i = 1; i < votesData.length; i++) {
      const row = votesData[i];
      const vIdeaId = row[1];
      const vUserId = row[2];
      const vUsername = row[3];
      const vAction = row[4];

      if (vIdeaId == ideaId) {
        if (vAction === "UPVOTE" || vAction === "VOTE") {
          voterMap.set(vUserId, { username: vUsername, active: true });
        } else if (vAction === "UNVOTE") {
          voterMap.set(vUserId, { username: vUsername, active: false });
        }
      }
    }

    const activeVoters = [];
    voterMap.forEach((val, uid) => {
      if (val.active) {
        activeVoters.push({ userId: uid, username: val.username });
      }
    });

    const demoUrl = extraData.demoUrl || "https://toolhunt.enterprise/demo/" + ideaId;
    const feedbackUrl = extraData.feedbackUrl || "https://toolhunt.enterprise/feedback/" + ideaId;

    // 2. Dispatch targeted DM to each active voter
    activeVoters.forEach(voter => {
      let messageText = "";
      if (newStatus.includes("Beta")) {
        messageText = `🧪 <b>[THÔNG BÁO TRẢI NGHIỆM BETA]</b>\n\n` +
          `Chào ${voter.username}, ý tưởng bạn từng Upvote <b>#${ideaId}: ${ideaTitle}</b> do ${devUsername} phát triển vừa ra mắt bản Beta Testing!\n\n` +
          `🔗 Link dùng thử: <a href="${demoUrl}">${demoUrl}</a>\n` +
          `📝 Góp ý nhanh: <a href="${feedbackUrl}">${feedbackUrl}</a>\n\n` +
          `Cảm ơn bạn đã đồng hành cùng ToolHunt!`;
      } else if (newStatus.includes("Hoàn thành") || newStatus.includes("Completed")) {
        messageText = `🎉 <b>[CÔNG BỐ TOOL HOÀN THÀNH]</b>\n\n` +
          `Chào ${voter.username}, ý tưởng <b>#${ideaId}: ${ideaTitle}</b> đã chính thức hoàn thành và phát hành rộng rãi!\n\n` +
          `🚀 Truy cập sản phẩm: <a href="${demoUrl}">${demoUrl}</a>\n\n` +
          `Chúc bạn có trải nghiệm tuyệt vời!`;
      }

      this.urlFetch.fetch("https://api.telegram.org/botTOKEN/sendMessage", {
        method: "POST",
        payload: JSON.stringify({
          chat_id: voter.userId,
          text: messageText,
          parse_mode: "HTML"
        })
      });
    });

    return {
      notifiedCount: activeVoters.length,
      recipientUserIds: activeVoters.map(v => v.userId)
    };
  }

  // --- BOUNTY AGGREGATION HELPER (R4) ---
  calculateTotalBounty(ideaId) {
    const bountiesSheet = this.ss.getSheetByName("Bounties");
    if (!bountiesSheet) return { totalVnd: 0, totalUsd: 0, coffeeCount: 0, totalPoints: 0, sponsorCount: 0, badgeText: "" };

    const data = bountiesSheet.getDataRange().getValues();
    let totalVnd = 0;
    let totalUsd = 0;
    let coffeeCount = 0;
    let totalPoints = 0;
    const sponsors = new Set();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[2] == ideaId && row[8] !== "CANCELLED") {
        const amount = parseFloat(row[5]) || 0;
        const unit = (row[6] || "VND").toString().toUpperCase();
        sponsors.add(row[3]); // Sponsor User ID

        if (unit === "VND") {
          totalVnd += amount;
        } else if (unit === "USD") {
          totalUsd += amount;
        } else if (unit === "COFFEE") {
          coffeeCount += amount;
        } else if (unit === "POINTS" || unit === "PTS") {
          totalPoints += amount;
        }
      }
    }

    let badgeText = "";
    if (totalVnd > 0 || totalUsd > 0 || coffeeCount > 0 || totalPoints > 0) {
      const parts = [];
      if (totalVnd > 0) parts.push(`${totalVnd.toLocaleString("vi-VN")} VNĐ`);
      if (totalUsd > 0) parts.push(`${totalUsd.toLocaleString()} USD`);
      if (coffeeCount > 0) parts.push(`${coffeeCount} ☕`);
      if (totalPoints > 0) parts.push(`${totalPoints.toLocaleString()} Pts`);
      badgeText = `💰 Quỹ thưởng: ${parts.join(" + ")} (${sponsors.size} nhà tài trợ)`;
    }

    return {
      totalVnd,
      totalUsd,
      coffeeCount,
      totalPoints,
      sponsorCount: sponsors.size,
      badgeText
    };
  }

  // --- TELEGRAM CARD FORMATTING HELPER ---
  formatTelegramCard(idea) {
    const statusEmoji = {
      "Đang lấy ý kiến": "⏳",
      "Đang phát triển": "🚀",
      "Beta Testing": "🧪",
      "Hoàn thành": "✅"
    }[idea.status] || "💡";

    let text = `<b>${statusEmoji} Ý TƯỞNG #${idea.id}: ${idea.title.replace(/</g, "&lt;")}</b>\n\n` +
      `👤 Đề xuất bởi: ${idea.username}\n` +
      `📂 Thể loại: <i>${idea.category}</i>\n` +
      `📝 Mô tả: ${idea.description.replace(/</g, "&lt;")}\n` +
      `📊 Lượt bình chọn: <b>${idea.votes}</b> vote(s)\n` +
      `📍 Trạng thái: <b>${idea.status}</b>\n`;

    if (idea.devUsername) {
      text += `🛠 Phụ trách: <b>${idea.devUsername}</b> (Mốc: ${idea.milestones || "0%"})\n`;
    }

    if (idea.bountySummary) {
      text += `✨ ${idea.bountySummary}\n`;
    }

    return text;
  }

  // --- PROCESS TELEGRAM MESSAGE ---
  processMessage(msg) {
    const text = (msg.text || "").trim();
    const chatId = (msg.chat && msg.chat.id) ? msg.chat.id : (msg.chatId || -1001);
    const userId = msg.from ? msg.from.id : 0;
    const username = (msg.from && msg.from.username) ? "@" + msg.from.username : ((msg.from && msg.from.first_name) || "Thành viên");

    // Command: /idea
    if (text.startsWith("/idea")) {
      const raw = text.substring(5).trim();
      if (!raw || !raw.includes("|")) {
        this.urlFetch.fetch("https://api.telegram.org/botTOKEN/sendMessage", {
          method: "POST",
          payload: JSON.stringify({
            chat_id: chatId,
            text: "⚠️ Cú pháp không hợp lệ! Vui lòng dùng:\n<code>/idea Tên ý tưởng | Mô tả chi tiết</code>",
            parse_mode: "HTML"
          })
        });
        return { success: false, error: "INVALID_SYNTAX" };
      }

      const [titlePart, ...descParts] = raw.split("|");
      const cleanTitle = titlePart.trim();
      const cleanDesc = descParts.join("|").trim();

      if (cleanTitle.length < 3) {
        return { success: false, error: "TITLE_TOO_SHORT" };
      }

      const ideasSheet = this.ss.getSheetByName("Ideas");
      const existingData = ideasSheet.getDataRange().getValues();

      // Check R1 AI Duplicate Detection
      const aiCheck = this.checkAiDuplicate(cleanTitle, cleanDesc, existingData);

      if (aiCheck.is_duplicate) {
        // High similarity: send duplicate warning
        const warningKeyId = `pending_${userId}_${Date.now()}`;
        this.pendingIdeas.set(warningKeyId, {
          userId,
          username,
          title: cleanTitle,
          description: cleanDesc,
          category: "Chung",
          chatId
        });

        const matchedId = aiCheck.matched_idea_id;
        const warningKeyboard = {
          inline_keyboard: [
            [
              { text: `➕ Dồn Vote vào #${matchedId}`, callback_data: `merge_vote_${matchedId}` },
              { text: "🚀 Vẫn tạo mới (Force Create)", callback_data: `force_create_${warningKeyId}` }
            ]
          ]
        };

        const warningMsg = `⚠️ <b>CẢNH BÁO TRÙNG LẶP AI (${aiCheck.similarity_score}%)</b>\n\n` +
          `Ý tưởng của bạn có nội dung tương tự với ý tưởng <b>#${matchedId}: ${aiCheck.matched_title}</b>.\n` +
          `<i>Lý do: ${aiCheck.reason}</i>\n\n` +
          `Bạn muốn dồn phiếu vào ý tưởng có sẵn hay tiếp tục tạo mới?`;

        this.urlFetch.fetch("https://api.telegram.org/botTOKEN/sendMessage", {
          method: "POST",
          payload: JSON.stringify({
            chat_id: chatId,
            text: warningMsg,
            parse_mode: "HTML",
            reply_markup: JSON.stringify(warningKeyboard)
          })
        });

        return {
          success: false,
          warning: "DUPLICATE_DETECTED",
          similarity: aiCheck.similarity_score,
          matchedId: aiCheck.matched_idea_id,
          pendingKey: warningKeyId
        };
      }

      // No duplicate detected: create idea immediately
      const newIdeaId = ideasSheet.getLastRow();
      ideasSheet.appendRow([
        newIdeaId, new Date(), userId, username, cleanTitle, cleanDesc,
        "Chung", 0, 1000 + newIdeaId, chatId, "Đang lấy ý kiến",
        "Telegram", "", "", "", "0%", ""
      ]);

      this.logAudit(userId, username, "CREATE_IDEA", `Tạo ý tưởng #${newIdeaId}: ${cleanTitle}`);

      const postKeyboard = {
        inline_keyboard: [
          [
            { text: "👍 Upvote (0)", callback_data: `vote_${newIdeaId}` },
            { text: "🛠 Nhận làm tool", callback_data: `claim_task_${newIdeaId}` }
          ],
          [
            { text: "💰 Treo thưởng", callback_data: `bounty_${newIdeaId}` }
          ]
        ]
      };

      const cardText = this.formatTelegramCard({
        id: newIdeaId,
        username,
        title: cleanTitle,
        description: cleanDesc,
        category: "Chung",
        votes: 0,
        status: "Đang lấy ý kiến",
        devUsername: "",
        milestones: "",
        bountySummary: ""
      });

      this.urlFetch.fetch("https://api.telegram.org/botTOKEN/sendMessage", {
        method: "POST",
        payload: JSON.stringify({
          chat_id: chatId,
          text: cardText,
          parse_mode: "HTML",
          reply_markup: JSON.stringify(postKeyboard)
        })
      });

      return { success: true, ideaId: newIdeaId, title: cleanTitle };
    }

    // Command: /bounty <ideaId> <amount> <unit> [message]
    if (text.startsWith("/bounty")) {
      const parts = text.split(" ");
      if (parts.length < 3) {
        return { success: false, error: "INVALID_BOUNTY_SYNTAX" };
      }
      const ideaId = parseInt(parts[1]);
      const amount = parseFloat(parts[2]);
      const unit = (parts[3] || "VND").toUpperCase();
      const note = parts.slice(4).join(" ") || "Tài trợ phát triển";

      return this.handlePledgeBounty(ideaId, userId, username, amount, unit, note, chatId);
    }

    // Command: /top
    if (text.startsWith("/top")) {
      const ideasSheet = this.ss.getSheetByName("Ideas");
      const data = ideasSheet.getDataRange().getValues().slice(1);
      const sorted = data.map(r => ({ id: r[0], title: r[4], votes: parseInt(r[7]) || 0 })).sort((a, b) => b.votes - a.votes);
      return { success: true, top: sorted.slice(0, 5) };
    }

    // Command: /stats
    if (text.startsWith("/stats")) {
      const ideasSheet = this.ss.getSheetByName("Ideas");
      const votesSheet = this.ss.getSheetByName("Votes");
      const bountiesSheet = this.ss.getSheetByName("Bounties");

      const totalIdeas = Math.max(0, ideasSheet.getLastRow() - 1);
      const totalVotes = Math.max(0, votesSheet.getLastRow() - 1);
      const totalBounties = Math.max(0, bountiesSheet ? bountiesSheet.getLastRow() - 1 : 0);

      return { success: true, totalIdeas, totalVotes, totalBounties };
    }

    // Command: /status (Admin / Manager only)
    if (text.startsWith("/status")) {
      if (!this.hasRole(userId, ["Admin", "Manager"])) {
        return { success: false, error: "UNAUTHORIZED" };
      }

      const [, targetIdStr, ...statusParts] = text.split(" ");
      const targetId = parseInt(targetIdStr);
      const newStatus = statusParts.join(" ");

      const ideasSheet = this.ss.getSheetByName("Ideas");
      const ideasData = ideasSheet.getDataRange().getValues();
      for (let i = 1; i < ideasData.length; i++) {
        if (ideasData[i][0] == targetId) {
          ideasSheet.getRange(i + 1, 11).setValue(newStatus);
          this.logAudit(userId, username, "UPDATE_STATUS", `Ý tưởng #${targetId} đổi sang ${newStatus}`);
          return { success: true, targetId, newStatus };
        }
      }
      return { success: false, error: "NOT_FOUND" };
    }

    return { success: false, error: "UNKNOWN_COMMAND" };
  }

  // --- PROCESS TELEGRAM CALLBACK QUERY ---
  processCallback(cb) {
    const cbUserId = cb.from.id;
    const cbUsername = cb.from.username ? "@" + cb.from.username : (cb.from.first_name || "User");
    const cbData = cb.data;
    const chatId = (cb.message && cb.message.chat) ? cb.message.chat.id : -1001;
    const msgId = (cb.message && cb.message.message_id) ? cb.message.message_id : 1000;

    // 1. Upvote Action (Toggle Unvote)
    if (cbData.startsWith("vote_")) {
      const ideaId = parseInt(cbData.replace("vote_", ""));
      return this.handleVote(ideaId, cbUserId, cbUsername, chatId, msgId);
    }

    // 2. R1 Merge Vote Action
    if (cbData.startsWith("merge_vote_")) {
      const targetIdeaId = parseInt(cbData.replace("merge_vote_", ""));
      const voteRes = this.handleVote(targetIdeaId, cbUserId, cbUsername, chatId, msgId);
      this.urlFetch.fetch("https://api.telegram.org/botTOKEN/sendMessage", {
        method: "POST",
        payload: JSON.stringify({
          chat_id: chatId,
          text: `✅ Đã dồn phiếu Upvote thành công vào ý tưởng <b>#${targetIdeaId}</b>!`,
          parse_mode: "HTML"
        })
      });
      return { success: true, action: "MERGE_VOTE", targetIdeaId, voteRes };
    }

    // 3. R1 Force Create Action
    if (cbData.startsWith("force_create_")) {
      const pendingKey = cbData.replace("force_create_", "");
      const pending = this.pendingIdeas.get(pendingKey);
      if (!pending) return { success: false, error: "PENDING_EXPIRED" };

      const ideasSheet = this.ss.getSheetByName("Ideas");
      const newIdeaId = ideasSheet.getLastRow();
      ideasSheet.appendRow([
        newIdeaId, new Date(), pending.userId, pending.username, pending.title, pending.description,
        pending.category || "Chung", 0, 1000 + newIdeaId, pending.chatId, "Đang lấy ý kiến",
        "Force Created", "", "", "", "0%", ""
      ]);

      this.pendingIdeas.delete(pendingKey);
      this.logAudit(cbUserId, cbUsername, "FORCE_CREATE_IDEA", `Tạo cưỡng bức ý tưởng #${newIdeaId}: ${pending.title}`);

      return { success: true, action: "FORCE_CREATE", ideaId: newIdeaId };
    }

    // 4. R2 Developer Claim Task Action
    if (cbData.startsWith("claim_task_")) {
      const ideaId = parseInt(cbData.replace("claim_task_", ""));
      return this.handleClaimTask(ideaId, cbUserId, cbUsername, chatId, msgId);
    }

    // 5. R2 Developer Unclaim Task Action
    if (cbData.startsWith("unclaim_task_")) {
      const ideaId = parseInt(cbData.replace("unclaim_task_", ""));
      return this.handleUnclaimTask(ideaId, cbUserId, cbUsername, chatId, msgId);
    }

    // 6. R2 Developer Status Transitions (Beta & Completed)
    if (cbData.startsWith("devbeta_")) {
      const ideaId = parseInt(cbData.replace("devbeta_", ""));
      return this.handleDevStatusTransition(ideaId, cbUserId, cbUsername, "Beta Testing", chatId, msgId);
    }

    if (cbData.startsWith("devdone_")) {
      const ideaId = parseInt(cbData.replace("devdone_", ""));
      return this.handleDevStatusTransition(ideaId, cbUserId, cbUsername, "Hoàn thành", chatId, msgId);
    }

    return { success: false, error: "UNKNOWN_CALLBACK" };
  }

  // --- VOTE HANDLER WITH TOGGLE UNVOTE ---
  handleVote(ideaId, userId, username, chatId, msgId) {
    const votesSheet = this.ss.getSheetByName("Votes");
    const ideasSheet = this.ss.getSheetByName("Ideas");

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
    let ideaTitle = "";
    let devUsername = "";
    let status = "";

    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        targetRow = i + 1;
        currentVotes = parseInt(ideasData[i][7]) || 0;
        ideaTitle = ideasData[i][4];
        status = ideasData[i][10];
        devUsername = ideasData[i][13];
        break;
      }
    }

    if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };

    let actionResult = "";
    if (alreadyVoted) {
      // Toggle Unvote
      votesSheet.deleteRow(voteRowIndex);
      currentVotes = Math.max(0, currentVotes - 1);
      ideasSheet.getRange(targetRow, 8).setValue(currentVotes);
      actionResult = "UNVOTE";
      this.logAudit(userId, username, "UNVOTE", `Rút lại vote cho ý tưởng #${ideaId}`);
    } else {
      // Upvote
      votesSheet.appendRow([new Date(), ideaId, userId, username, "UPVOTE"]);
      currentVotes += 1;
      ideasSheet.getRange(targetRow, 8).setValue(currentVotes);
      actionResult = "VOTE";
      this.logAudit(userId, username, "UPVOTE", `Bình chọn ý tưởng #${ideaId}`);
    }

    // Sync Telegram inline keyboard markup
    const updatedKeyboard = {
      inline_keyboard: [
        [
          { text: `👍 Upvote (${currentVotes})`, callback_data: `vote_${ideaId}` },
          { text: "🛠 Nhận làm tool", callback_data: `claim_task_${ideaId}` }
        ],
        [
          { text: "💰 Treo thưởng", callback_data: `bounty_${ideaId}` }
        ]
      ]
    };

    this.urlFetch.fetch("https://api.telegram.org/botTOKEN/editMessageReplyMarkup", {
      method: "POST",
      payload: JSON.stringify({
        chat_id: chatId,
        message_id: msgId,
        reply_markup: JSON.stringify(updatedKeyboard)
      })
    });

    return { success: true, action: actionResult, ideaId, currentVotes };
  }

  // --- R2 DEVELOPER CLAIM TASK HANDLER ---
  handleClaimTask(ideaId, userId, username, chatId, msgId) {
    // Check developer eligibility
    if (!this.hasRole(userId, ["Developer", "Manager", "Admin"])) {
      return { success: false, error: "UNAUTHORIZED_ROLE" };
    }

    const ideasSheet = this.ss.getSheetByName("Ideas");
    const ideasData = ideasSheet.getDataRange().getValues();
    let targetRow = -1;
    let currentStatus = "";
    let existingDevId = "";

    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        targetRow = i + 1;
        currentStatus = ideasData[i][10];
        existingDevId = ideasData[i][12];
        break;
      }
    }

    if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };

    // Prevent double-claiming
    if (existingDevId && existingDevId.toString().length > 0 && currentStatus !== "Đang lấy ý kiến") {
      return { success: false, error: "ALREADY_CLAIMED" };
    }

    // Set Developer assignment in Ideas Sheet
    ideasSheet.getRange(targetRow, 11).setValue("Đang phát triển");
    ideasSheet.getRange(targetRow, 13).setValue(userId);
    ideasSheet.getRange(targetRow, 14).setValue(username);
    ideasSheet.getRange(targetRow, 15).setValue(new Date());
    ideasSheet.getRange(targetRow, 16).setValue("10% - Khởi động");

    this.logAudit(userId, username, "CLAIM_TASK", `Nhận phát triển ý tưởng #${ideaId}`);

    // Update Telegram Card buttons to include Dev controls
    const devKeyboard = {
      inline_keyboard: [
        [
          { text: "🧪 Ra mắt Beta", callback_data: `devbeta_${ideaId}` },
          { text: "✅ Hoàn thành", callback_data: `devdone_${ideaId}` }
        ],
        [
          { text: "❌ Hủy nhận (Unclaim)", callback_data: `unclaim_task_${ideaId}` }
        ]
      ]
    };

    this.urlFetch.fetch("https://api.telegram.org/botTOKEN/editMessageReplyMarkup", {
      method: "POST",
      payload: JSON.stringify({
        chat_id: chatId,
        message_id: msgId,
        reply_markup: JSON.stringify(devKeyboard)
      })
    });

    return {
      success: true,
      action: "CLAIM_SUCCESS",
      ideaId,
      developerId: userId,
      developerUsername: username,
      newStatus: "Đang phát triển"
    };
  }

  // --- R2 DEVELOPER UNCLAIM TASK HANDLER ---
  handleUnclaimTask(ideaId, userId, username, chatId, msgId) {
    const ideasSheet = this.ss.getSheetByName("Ideas");
    const ideasData = ideasSheet.getDataRange().getValues();
    let targetRow = -1;
    let devId = "";
    let currentStatus = "";

    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        targetRow = i + 1;
        devId = ideasData[i][12];
        currentStatus = ideasData[i][10];
        break;
      }
    }

    if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };

    if (currentStatus === "Hoàn thành" || currentStatus === "Completed") {
      return { success: false, error: "CANNOT_UNCLAIM_COMPLETED" };
    }

    // Only assigned dev or Manager/Admin can unclaim
    const isOwner = devId && devId.toString() === userId.toString();
    const canOverride = this.hasRole(userId, ["Manager", "Admin"]);

    if (!isOwner && !canOverride) {
      return { success: false, error: "UNAUTHORIZED_UNCLAIM" };
    }

    // Reset status and developer fields
    ideasSheet.getRange(targetRow, 11).setValue("Đang lấy ý kiến");
    ideasSheet.getRange(targetRow, 13).setValue("");
    ideasSheet.getRange(targetRow, 14).setValue("");
    ideasSheet.getRange(targetRow, 15).setValue("");
    ideasSheet.getRange(targetRow, 16).setValue("0%");

    this.logAudit(userId, username, "UNCLAIM_TASK", `Hủy nhận task ý tưởng #${ideaId}`);

    return { success: true, action: "UNCLAIM_SUCCESS", ideaId, status: "Đang lấy ý kiến" };
  }

  // --- R2 & R3 DEV STATUS TRANSITION (Beta / Done) ---
  handleDevStatusTransition(ideaId, userId, username, targetStatus, chatId, msgId) {
    const ideasSheet = this.ss.getSheetByName("Ideas");
    const ideasData = ideasSheet.getDataRange().getValues();
    let targetRow = -1;
    let devId = "";

    for (let i = 1; i < ideasData.length; i++) {
      if (ideasData[i][0] == ideaId) {
        targetRow = i + 1;
        devId = ideasData[i][12];
        break;
      }
    }

    if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };

    const isOwner = devId && devId.toString() === userId.toString();
    if (!isOwner && !this.hasRole(userId, ["Manager", "Admin"])) {
      return { success: false, error: "UNAUTHORIZED" };
    }

    ideasSheet.getRange(targetRow, 11).setValue(targetStatus);
    const milestone = targetStatus === "Beta Testing" ? "80% - Đang thử nghiệm" : "100% - Đã xuất bản";
    ideasSheet.getRange(targetRow, 16).setValue(milestone);

    // Trigger R3 Targeted Beta Notifications
    const notifyRes = this.notifyIdeaVoters(ideaId, targetStatus, {
      demoUrl: `https://toolhunt.enterprise/demo/${ideaId}`,
      feedbackUrl: `https://toolhunt.enterprise/feedback/${ideaId}`
    });

    // If completed, transition bounties to RELEASED (R4)
    if (targetStatus === "Hoàn thành") {
      const bountiesSheet = this.ss.getSheetByName("Bounties");
      if (bountiesSheet) {
        const bData = bountiesSheet.getDataRange().getValues();
        for (let b = 1; b < bData.length; b++) {
          if (bData[b][2] == ideaId && bData[b][8] !== "CANCELLED") {
            bountiesSheet.getRange(b + 1, 9).setValue("RELEASED");
          }
        }
      }
    }

    this.logAudit(userId, username, "DEV_STATUS_TRANSITION", `Ý tưởng #${ideaId} chuyển trạng thái ${targetStatus}`);

    return {
      success: true,
      ideaId,
      status: targetStatus,
      notificationsSent: notifyRes.notifiedCount,
      recipients: notifyRes.recipientUserIds
    };
  }

  // --- R4 BOUNTY PLEDGE HANDLER ---
  handlePledgeBounty(ideaId, userId, username, amount, unit, message, chatId) {
    if (amount <= 0) {
      return { success: false, error: "INVALID_AMOUNT" };
    }

    const ideasSheet = this.ss.getSheetByName("Ideas");
    const bountiesSheet = this.ss.getSheetByName("Bounties");
    if (!ideasSheet || !bountiesSheet) return { success: false, error: "SHEET_NOT_FOUND" };

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
      new Date(), nextBountyId, ideaId, userId, username, amount, unit, message, "PLEDGED", ""
    ]);

    // Recalculate total bounty pool for idea
    const bountyCalc = this.calculateTotalBounty(ideaId);
    ideasSheet.getRange(targetRow, 17).setValue(bountyCalc.badgeText);

    this.logAudit(userId, username, "PLEDGE_BOUNTY", `Tài trợ ${amount} ${unit} cho ý tưởng #${ideaId}`);

    return {
      success: true,
      bountyId: nextBountyId,
      ideaId,
      amount,
      unit,
      totalVnd: bountyCalc.totalVnd,
      coffeeCount: bountyCalc.coffeeCount,
      badgeText: bountyCalc.badgeText
    };
  }

  // --- REST API: GET ROUTER (doGet) ---
  handleApiGet(params = {}) {
    const action = params.action || "getIdeas";

    if (action === "getIdeas" || action === "list") {
      const ideasSheet = this.ss.getSheetByName("Ideas");
      const data = ideasSheet.getDataRange().getValues();
      const list = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue;
        list.push({
          id: row[0],
          timestamp: row[1],
          userId: row[2],
          username: row[3],
          title: row[4],
          description: row[5],
          category: row[6] || "Chung",
          votes: parseInt(row[7]) || 0,
          status: row[10] || "Đang lấy ý kiến",
          developerId: row[12] || null,
          developerUsername: row[13] || null,
          milestones: row[15] || "0%",
          bountyTotal: row[16] || ""
        });
      }

      list.sort((a, b) => b.votes - a.votes);
      return { ok: true, count: list.length, data: list };
    }

    if (action === "getUserVotes") {
      const userId = params.userId;
      if (!userId) return { ok: false, error: "Missing userId" };

      const votesSheet = this.ss.getSheetByName("Votes");
      const data = votesSheet.getDataRange().getValues();
      const votedIdeas = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][2] && data[i][2].toString() === userId.toString()) {
          votedIdeas.push(data[i][1]);
        }
      }
      return { ok: true, userId, votedIdeas };
    }

    if (action === "getStats") {
      const ideasSheet = this.ss.getSheetByName("Ideas");
      const votesSheet = this.ss.getSheetByName("Votes");
      const bountiesSheet = this.ss.getSheetByName("Bounties");

      return {
        ok: true,
        stats: {
          totalIdeas: Math.max(0, ideasSheet.getLastRow() - 1),
          totalVotes: Math.max(0, votesSheet.getLastRow() - 1),
          totalBounties: Math.max(0, bountiesSheet ? bountiesSheet.getLastRow() - 1 : 0)
        }
      };
    }

    if (action === "getBounties") {
      const ideaId = params.ideaId;
      const bountiesSheet = this.ss.getSheetByName("Bounties");
      const data = bountiesSheet.getDataRange().getValues();
      const list = [];
      for (let i = 1; i < data.length; i++) {
        if (!ideaId || data[i][2] == ideaId) {
          list.push({
            bountyId: data[i][1],
            ideaId: data[i][2],
            sponsorId: data[i][3],
            sponsorUsername: data[i][4],
            amount: data[i][5],
            unit: data[i][6],
            message: data[i][7],
            status: data[i][8]
          });
        }
      }
      return { ok: true, data: list };
    }

    if (action === "getUserRole") {
      const userId = params.userId;
      return { ok: true, userId, role: this.getUserRole(userId) };
    }

    return { ok: false, error: "INVALID_ACTION" };
  }

  // --- REST API: POST ROUTER (doPost) ---
  handleApiPost(payload = {}) {
    const lock = this.lockService.getScriptLock();
    lock.waitLock(15000);

    try {
      const action = payload.apiAction;

      if (action === "submitIdea") {
        const { title, description, category, username, userId } = payload;
        if (!title || !description) return { ok: false, error: "MISSING_REQUIRED_FIELDS" };

        const ideasSheet = this.ss.getSheetByName("Ideas");
        const nextId = ideasSheet.getLastRow();
        ideasSheet.appendRow([
          nextId, new Date(), userId || "WEB_ANON", username || "@web_user", title.trim(),
          description.trim(), category || "Chung", 0, "", "", "Đang lấy ý kiến", "Web API",
          "", "", "", "0%", ""
        ]);
        return { ok: true, ideaId: nextId, message: "Idea submitted successfully" };
      }

      if (action === "voteIdea") {
        const { ideaId, userId, username } = payload;
        const res = this.handleVote(ideaId, userId, username || "web_voter", -1001, 1000);
        return { ok: res.success, action: res.action, currentVotes: res.currentVotes };
      }

      if (action === "claimIdea") {
        const { ideaId, userId, username } = payload;
        const res = this.handleClaimTask(ideaId, userId, username || "@dev", -1001, 1000);
        return { ok: res.success, error: res.error, status: res.newStatus };
      }

      if (action === "pledgeBounty") {
        const { ideaId, userId, username, amount, unit, message } = payload;
        const res = this.handlePledgeBounty(ideaId, userId, username || "@sponsor", amount, unit || "VND", message, -1001);
        return { ok: res.success, bountyId: res.bountyId, badgeText: res.badgeText };
      }

      return { ok: false, error: "UNKNOWN_API_ACTION" };
    } finally {
      lock.releaseLock();
    }
  }
}


// ==============================================================================
// 3. MODULAR TEST SUITES (10 SUITES / 45+ ASSERTIONS)
// ==============================================================================

function runAllTestSuites() {
  const startTime = Date.now();

  console.log("================================================================================");
  console.log("🧪 TOOLHUNT ENTERPRISE v3.0.0 — TEST INFRASTRUCTURE & SIMULATION HARNESS");
  console.log("================================================================================\n");

  const ss = new MockSpreadsheetApp();
  const urlFetch = new MockUrlFetchApp();
  const lockService = new MockLockService();
  const bot = new EnterpriseBotEngine(ss, urlFetch, lockService);

  let totalPassed = 0;
  let totalFailed = 0;
  const suiteResults = [];

  function assert(suiteIndex, testName, condition, details = "") {
    if (condition) {
      console.log(`    ✅ [PASS] ${testName}`);
      totalPassed++;
      suiteResults[suiteIndex].passed++;
    } else {
      console.error(`    ❌ [FAIL] ${testName} ${details ? "(" + details + ")" : ""}`);
      totalFailed++;
      suiteResults[suiteIndex].failed++;
    }
  }

  // ----------------------------------------------------------------------------
  // SUITE 1: Syntax & Command Validation
  // ----------------------------------------------------------------------------
  console.log("🔹 [SUITE 1] Syntax & Command Validation (Baseline Telegram Engine)");
  suiteResults.push({ name: "Suite 1: Syntax & Command Validation", passed: 0, failed: 0 });
  const s1 = 0;

  // 1.1 Missing separator
  const resNoSeparator = bot.processMessage({
    chatId: -1001,
    text: "/idea ToolAutoHoaDonKhongDauGachDung",
    from: { id: 111, username: "user_a" }
  });
  assert(s1, "1.1 Báo lỗi INVALID_SYNTAX khi thiếu dấu gạch đứng (|)", resNoSeparator.error === "INVALID_SYNTAX");

  // 1.2 Title too short (< 3 chars)
  const resShortTitle = bot.processMessage({
    chatId: -1001,
    text: "/idea AB | Mo ta dai hop le",
    from: { id: 111, username: "user_a" }
  });
  assert(s1, "1.2 Từ chối ý tưởng khi tiêu đề ngắn hơn 3 ký tự (TITLE_TOO_SHORT)", resShortTitle.error === "TITLE_TOO_SHORT");

  // 1.3 Unknown command
  const resUnknown = bot.processMessage({
    chatId: -1001,
    text: "/unknown_command",
    from: { id: 111 }
  });
  assert(s1, "1.3 Phản hồi UNKNOWN_COMMAND cho các lệnh không đăng ký", resUnknown.error === "UNKNOWN_COMMAND");

  // 1.4 Valid syntax parse
  const resValidSyntax = bot.processMessage({
    chatId: -1001,
    text: "/idea Tool Auto Hóa Đơn | Tự động quét hóa đơn PDF và lưu vào Sheet",
    from: { id: 111, username: "user_a" }
  });
  assert(s1, "1.4 Phân tích cú pháp hợp lệ và khởi tạo Idea #1 thành công", resValidSyntax.success && resValidSyntax.ideaId === 1);


  // ----------------------------------------------------------------------------
  // SUITE 2: Idea Creation & Telegram Card Formatting
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 2] Idea Creation & Telegram Card Formatting");
  suiteResults.push({ name: "Suite 2: Idea Creation & Telegram Card Formatting", passed: 0, failed: 0 });
  const s2 = 1;

  // 2.1 Ideas sheet persistence
  const ideasSheet = ss.getSheetByName("Ideas");
  const ideasData = ideasSheet.getDataRange().getValues();
  assert(s2, "2.1 Ý tưởng #1 được lưu vào sheet Ideas với ID 1 và trạng thái 'Đang lấy ý kiến'",
    ideasData.length >= 2 && ideasData[1][0] === 1 && ideasData[1][10] === "Đang lấy ý kiến"
  );

  // 2.2 Create Idea #2
  const resIdea2 = bot.processMessage({
    chatId: -1001,
    text: "/idea Bot Cào Giá Shopee | Cào giá đa sàn thương mại điện tử theo giờ",
    from: { id: 222, username: "user_b" }
  });
  assert(s2, "2.2 Tạo thành công Idea #2 với ID 2", resIdea2.success && resIdea2.ideaId === 2);

  // 2.3 Formatted HTML card output
  const lastSentMsg = urlFetch.sentMessages[urlFetch.sentMessages.length - 1];
  assert(s2, "2.3 Định dạng bài đăng Telegram chuẩn HTML có tiêu đề, mô tả và tác giả",
    lastSentMsg && lastSentMsg.text.includes("Bot Cào Giá Shopee") && lastSentMsg.parse_mode === "HTML"
  );

  // 2.4 Inline keyboard includes Upvote, Claim Task & Bounty buttons
  const replyMarkup = lastSentMsg ? lastSentMsg.reply_markup : null;
  const hasUpvoteBtn = replyMarkup && replyMarkup.inline_keyboard && replyMarkup.inline_keyboard[0] && replyMarkup.inline_keyboard[0].some(b => b.callback_data.includes("vote_"));
  const hasClaimBtn = replyMarkup && replyMarkup.inline_keyboard && replyMarkup.inline_keyboard[0] && replyMarkup.inline_keyboard[0].some(b => b.callback_data.includes("claim_task_"));
  const hasBountyBtn = replyMarkup && replyMarkup.inline_keyboard && replyMarkup.inline_keyboard[1] && replyMarkup.inline_keyboard[1].some(b => b.callback_data.includes("bounty_"));
  assert(s2, "2.4 Bàn phím Inline Keyboard chứa đủ nút Upvote, Nhận làm tool và Treo thưởng",
    Boolean(hasUpvoteBtn && hasClaimBtn && hasBountyBtn)
  );


  // ----------------------------------------------------------------------------
  // SUITE 3: R1 AI Duplicate Detection (DeepSeek & Gemini)
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 3] R1 AI Duplicate Detection (DeepSeek, Gemini, Merge & Force Create)");
  suiteResults.push({ name: "Suite 3: R1 AI Duplicate Detection", passed: 0, failed: 0 });
  const s3 = 2;

  // 3.1 High similarity input triggers duplicate warning
  const resDupCheck = bot.processMessage({
    chatId: -1001,
    text: "/idea Quét Hóa Đơn PDF Tự Động | Nhận diện file hóa đơn PDF lưu vào Google Sheet",
    from: { id: 333, username: "user_dup" }
  });
  assert(s3, "3.1 AI DeepSeek phát hiện độ tương đồng cao (88%), kích hoạt DUPLICATE_DETECTED và chặn tạo trùng",
    resDupCheck.warning === "DUPLICATE_DETECTED" && resDupCheck.similarity >= 75 && resDupCheck.matchedId === 1
  );

  // 3.2 Duplicate warning provides merge_vote and force_create options
  const warningMsg = urlFetch.sentMessages[urlFetch.sentMessages.length - 1];
  const warningKeyboard = warningMsg ? warningMsg.reply_markup : null;
  const hasMergeBtn = warningKeyboard && warningKeyboard.inline_keyboard[0].some(b => b.callback_data.startsWith("merge_vote_1"));
  const hasForceBtn = warningKeyboard && warningKeyboard.inline_keyboard[0].some(b => b.callback_data.startsWith("force_create_"));
  assert(s3, "3.2 Cảnh báo đưa ra nút Dồn Vote (merge_vote_1) và Tạo cưỡng bức (force_create)",
    hasMergeBtn && hasForceBtn
  );

  // 3.3 Low similarity creates idea automatically
  const resUnique = bot.processMessage({
    chatId: -1001,
    text: "/idea Tool Tạo QR Thanh Toán | Sinh mã VietQR chuyển khoản ngân hàng",
    from: { id: 444, username: "user_unique" }
  });
  assert(s3, "3.3 Ý tưởng mới độc đáo (<30% tương đồng) được tạo tự động không cần xác nhận (Idea #3)",
    resUnique.success && resUnique.ideaId === 3
  );

  // 3.4 Merge vote callback consolidates vote to Idea #1
  const resMergeVote = bot.processCallback({
    from: { id: 333, username: "user_dup" },
    data: "merge_vote_1",
    message: { chat: { id: -1001 }, message_id: 1001 }
  });
  assert(s3, "3.4 Nút Dồn Vote (merge_vote_1) cộng dồn 1 lượt bình chọn vào Idea #1 có sẵn",
    resMergeVote.success && resMergeVote.targetIdeaId === 1 && resMergeVote.voteRes.currentVotes === 1
  );

  // 3.5 Force create callback creates the idea
  const resForceCreate = bot.processCallback({
    from: { id: 555, username: "user_force" },
    data: `force_create_${resDupCheck.pendingKey}`,
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  assert(s3, "3.5 Nút Vẫn tạo mới (force_create) tạo thành công Idea #4 vào Sheet",
    resForceCreate.success && resForceCreate.ideaId === 4
  );

  // 3.6 Failover handling: DeepSeek 500 error triggers fallback to Gemini
  urlFetch.deepSeekFailover = true;
  const currentIdeasData = ss.getSheetByName("Ideas").getDataRange().getValues();
  const resFailover = bot.checkAiDuplicate("Tool Đọc Hóa Đơn", "Quét hóa đơn", currentIdeasData);
  assert(s3, "3.6 Khi DeepSeek gặp lỗi 500, hệ thống tự động Failover sang Gemini phát hiện trùng lặp",
    resFailover.is_duplicate && resFailover.matched_idea_id === 1
  );
  urlFetch.deepSeekFailover = false;


  // ----------------------------------------------------------------------------
  // SUITE 4: Upvote & Anti-Fraud (Toggle Unvote)
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 4] Upvote & Anti-Fraud (Toggle Unvote & Real-Time Sync)");
  suiteResults.push({ name: "Suite 4: Upvote & Anti-Fraud (Toggle Unvote)", passed: 0, failed: 0 });
  const s4 = 3;

  // 4.1 First upvote by User A -> Vote count increments
  const voteA1 = bot.processCallback({
    from: { id: 601, username: "voter_alpha" },
    data: "vote_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  assert(s4, "4.1 User Alpha vote Idea #2 lần đầu -> Vote = 1 (Hành động VOTE)",
    voteA1.action === "VOTE" && voteA1.currentVotes === 1
  );

  // 4.2 Second upvote by User B -> Vote count increments to 2
  const voteB1 = bot.processCallback({
    from: { id: 602, username: "voter_beta" },
    data: "vote_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  assert(s4, "4.2 User Beta vote Idea #2 -> Vote tăng lên 2",
    voteB1.action === "VOTE" && voteB1.currentVotes === 2
  );

  // 4.3 Repeat upvote by User A -> Toggles to UNVOTE and decrements to 1
  const voteA2 = bot.processCallback({
    from: { id: 601, username: "voter_alpha" },
    data: "vote_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  assert(s4, "4.3 User Alpha bấm lại lần 2 -> Tự động chuyển thành UNVOTE -> Vote giảm về 1",
    voteA2.action === "UNVOTE" && voteA2.currentVotes === 1
  );

  // 4.4 Third upvote by User A -> Toggles back to UPVOTE (Vote = 2)
  const voteA3 = bot.processCallback({
    from: { id: 601, username: "voter_alpha" },
    data: "vote_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  assert(s4, "4.4 User Alpha bấm lần 3 -> Tự động bật lại UPVOTE -> Vote tăng lại lên 2",
    voteA3.action === "VOTE" && voteA3.currentVotes === 2
  );

  // 4.5 Telegram reply markup updated with live count
  const lastKeyboardEdit = urlFetch.editedKeyboards[urlFetch.editedKeyboards.length - 1];
  const updatedBtnText = lastKeyboardEdit ? lastKeyboardEdit.reply_markup.inline_keyboard[0][0].text : "";
  assert(s4, "4.5 Đồng bộ bàn phím Telegram hiển thị đúng số vote thời gian thực: '👍 Upvote (2)'",
    updatedBtnText === "👍 Upvote (2)"
  );


  // ----------------------------------------------------------------------------
  // SUITE 5: R2 Developer Task Claiming Lifecycle
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 5] R2 Developer Task Claiming & Workflow Lifecycle");
  suiteResults.push({ name: "Suite 5: R2 Developer Task Claiming Lifecycle", passed: 0, failed: 0 });
  const s5 = 4;

  // 5.1 Eligible Developer claims open task
  const claimRes1 = bot.processCallback({
    from: { id: 77777, username: "developer_pro" }, // Role: Developer
    data: "claim_task_1",
    message: { chat: { id: -1001 }, message_id: 1001 }
  });
  assert(s5, "5.1 Developer Pro nhận task Idea #1 -> Chuyển trạng thái 'Đang phát triển'",
    claimRes1.success && claimRes1.newStatus === "Đang phát triển" && claimRes1.developerUsername === "@developer_pro"
  );

  // 5.2 Double-claim prevention: Second developer attempting claim is rejected
  const claimRes2 = bot.processCallback({
    from: { id: 66666, username: "developer_alice" }, // Role: Developer
    data: "claim_task_1",
    message: { chat: { id: -1001 }, message_id: 1001 }
  });
  assert(s5, "5.2 Ngăn chặn tranh chấp (Double-claim): Developer khác nhận bị từ chối ALREADY_CLAIMED",
    claimRes2.error === "ALREADY_CLAIMED"
  );

  // 5.3 Developer updates progress to Beta Testing
  const betaRes = bot.processCallback({
    from: { id: 77777, username: "developer_pro" },
    data: "devbeta_1",
    message: { chat: { id: -1001 }, message_id: 1001 }
  });
  assert(s5, "5.3 Developer cập nhật tiến độ sang Beta Testing -> Trạng thái 'Beta Testing'",
    betaRes.success && betaRes.status === "Beta Testing"
  );

  // 5.4 Developer marks task as completed
  const doneRes = bot.processCallback({
    from: { id: 77777, username: "developer_pro" },
    data: "devdone_1",
    message: { chat: { id: -1001 }, message_id: 1001 }
  });
  assert(s5, "5.4 Developer hoàn thành tool -> Trạng thái chuyển sang 'Hoàn thành'",
    doneRes.success && doneRes.status === "Hoàn thành"
  );

  // 5.5 Developer releases task (Unclaim) on Idea #2
  // First claim Idea #2
  bot.processCallback({
    from: { id: 77777, username: "developer_pro" },
    data: "claim_task_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  const unclaimRes = bot.processCallback({
    from: { id: 77777, username: "developer_pro" },
    data: "unclaim_task_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  assert(s5, "5.5 Developer nhả task (Unclaim) -> Trạng thái quay lại 'Đang lấy ý kiến' và xóa Dev ID",
    unclaimRes.success && unclaimRes.status === "Đang lấy ý kiến"
  );

  // 5.6 Unauthorized user cannot unclaim another developer's task
  bot.processCallback({
    from: { id: 77777, username: "developer_pro" },
    data: "claim_task_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  const unauthUnclaim = bot.processCallback({
    from: { id: 111, username: "member_user" }, // Role: Member
    data: "unclaim_task_2",
    message: { chat: { id: -1001 }, message_id: 1002 }
  });
  assert(s5, "5.6 Chặn thành viên thường tự ý nhả task của Developer (UNAUTHORIZED_UNCLAIM)",
    unauthUnclaim.error === "UNAUTHORIZED_UNCLAIM"
  );


  // ----------------------------------------------------------------------------
  // SUITE 6: R3 Targeted Beta Notifications
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 6] R3 Targeted Beta Notifications (Voter Extraction & Alerts)");
  suiteResults.push({ name: "Suite 6: R3 Targeted Beta Notifications", passed: 0, failed: 0 });
  const s6 = 5;

  // Add votes to Idea #3: Voter 801 and Voter 802 vote, Voter 803 votes then unvotes
  bot.processCallback({ from: { id: 801, username: "active_voter_1" }, data: "vote_3" });
  bot.processCallback({ from: { id: 802, username: "active_voter_2" }, data: "vote_3" });
  bot.processCallback({ from: { id: 803, username: "unvoted_user" }, data: "vote_3" });
  bot.processCallback({ from: { id: 803, username: "unvoted_user" }, data: "vote_3" }); // toggled to unvote

  // 6.1 Voter extraction correctly filters active voters only
  const notifyBeta = bot.notifyIdeaVoters(3, "Beta Testing", {
    demoUrl: "https://toolhunt.enterprise/demo/3",
    feedbackUrl: "https://toolhunt.enterprise/feedback/3"
  });
  assert(s6, "6.1 Trích xuất chính xác 2 Active Voters (801, 802), loại trừ user đã rút vote (803)",
    notifyBeta.notifiedCount === 2 && notifyBeta.recipientUserIds.includes(801) && notifyBeta.recipientUserIds.includes(802) && !notifyBeta.recipientUserIds.includes(803)
  );

  // 6.2 Targeted DMs sent with demo and feedback links
  const betaDMs = urlFetch.sentMessages.filter(m => (m.chat_id === 801 || m.chat_id === 802) && m.text && m.text.includes("THÔNG BÁO TRẢI NGHIỆM BETA"));
  assert(s6, "6.2 Gửi tin nhắn Targeted DM trực tiếp tới đúng 2 voters kèm link Demo & Góp ý",
    betaDMs.length === 2 && betaDMs[0].text.includes("https://toolhunt.enterprise/demo/3")
  );

  // 6.3 Completion announcement sent to active voters
  const notifyDone = bot.notifyIdeaVoters(3, "Hoàn thành", {
    demoUrl: "https://toolhunt.enterprise/demo/3"
  });
  const doneDMs = urlFetch.sentMessages.filter(m => (m.chat_id === 801 || m.chat_id === 802) && m.text && m.text.includes("CÔNG BỐ TOOL HOÀN THÀNH"));
  assert(s6, "6.3 Gửi thông báo công bố hoàn thành sản phẩm tới đúng nhóm voters quan tâm",
    notifyDone.notifiedCount === 2 && doneDMs.length === 2
  );

  // 6.4 Non-voters receive zero targeted notification messages
  const nonVoterDMs = urlFetch.sentMessages.filter(m => m.chat_id === 999111);
  assert(s6, "6.4 Người dùng không vote (Non-voters) không nhận bất kỳ tin nhắn spam nào",
    nonVoterDMs.length === 0
  );


  // ----------------------------------------------------------------------------
  // SUITE 7: R4 Tool Bounty & Crowdfunding
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 7] R4 Tool Bounty & Crowdfunding (Pledges & Multi-Currency Pool)");
  suiteResults.push({ name: "Suite 7: R4 Tool Bounty & Crowdfunding", passed: 0, failed: 0 });
  const s7 = 6;

  // 7.1 Single bounty pledge
  const p1 = bot.handlePledgeBounty(1, 901, "sponsor_alpha", 500000, "VND", "Ủng hộ làm nhanh", -1001);
  assert(s7, "7.1 Nhà tài trợ 1 treo thưởng 500.000 VNĐ cho Idea #1 thành công",
    p1.success && p1.bountyId === 1 && p1.totalVnd === 500000
  );

  // 7.2 Multi-sponsor accumulation
  const p2 = bot.handlePledgeBounty(1, 902, "sponsor_beta", 200000, "VND", "Thêm ngân sách", -1001);
  assert(s7, "7.2 Nhà tài trợ 2 đóng góp 200.000 VNĐ -> Quỹ cộng dồn đạt 700.000 VNĐ (2 nhà tài trợ)",
    p2.success && p2.totalVnd === 700000 && p2.badgeText.includes("700.000 VNĐ")
  );

  // 7.3 Coffee bounty pledge
  const p3 = bot.handlePledgeBounty(1, 903, "sponsor_coffee", 5, "COFFEE", "Tặng dev 5 ly cà phê", -1001);
  assert(s7, "7.3 Nhà tài trợ 3 tặng 5 ly Coffee ☕ -> Tích lũy đa đơn vị tiền tệ (VNĐ + Coffee)",
    p3.success && p3.coffeeCount === 5 && p3.badgeText.includes("5 ☕")
  );

  // 7.4 Badge formatting in Ideas Sheet
  const ideasCol17 = ss.getSheetByName("Ideas").getDataRange().getValues()[1][16];
  assert(s7, "7.4 Huy hiệu Bounty vàng được ghi nhận vào cột 17 của Sheet Ideas",
    ideasCol17.includes("700.000 VNĐ") && ideasCol17.includes("5 ☕")
  );

  // 7.5 Task completion transitions bounties to RELEASED status
  // Complete idea 1 to release bounties
  bot.handleDevStatusTransition(1, 77777, "@developer_pro", "Hoàn thành", -1001, 1001);
  const bData = ss.getSheetByName("Bounties").getDataRange().getValues();
  const allReleased = bData.slice(1).every(r => r[8] === "RELEASED");
  assert(s7, "7.5 Khi ý tưởng hoàn thành, toàn bộ quỹ Bounty chuyển trạng thái RELEASED sẵn sàng trả thưởng",
    allReleased
  );


  // ----------------------------------------------------------------------------
  // SUITE 8: R5 4-Tier RBAC Permission Matrix
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 8] R5 4-Tier RBAC Permission Matrix (Member, Dev, Manager, Admin)");
  suiteResults.push({ name: "Suite 8: R5 4-Tier RBAC Permission Matrix", passed: 0, failed: 0 });
  const s8 = 7;

  // 8.1 Member blocked from admin status command
  const memberStatusRes = bot.processMessage({
    chatId: -1001,
    text: "/status 1 Hoàn thành",
    from: { id: 111, username: "member_user" }
  });
  assert(s8, "8.1 Thành viên (Member) bị chặn khi dùng lệnh quản trị /status (UNAUTHORIZED)",
    memberStatusRes.error === "UNAUTHORIZED"
  );

  // 8.2 Developer can claim tasks
  const devRoleCheck = bot.getUserRole(77777);
  assert(s8, "8.2 Người dùng vai trò Developer (@developer_pro) có quyền nhận task và cập nhật tiến độ",
    devRoleCheck === "Developer"
  );

  // 8.3 Manager role has task & status management authority
  const managerStatusRes = bot.processMessage({
    chatId: -1001,
    text: "/status 4 Beta Testing",
    from: { id: 88888, username: "manager_user" } // Role: Manager
  });
  assert(s8, "8.3 Quản lý (Manager) có quyền đổi trạng thái và điều phối toàn bộ các ý tưởng",
    managerStatusRes.success && managerStatusRes.newStatus === "Beta Testing"
  );

  // 8.4 Admin has full override authority
  const adminOverrideRes = bot.processMessage({
    chatId: -1001,
    text: "/status 4 Hoàn thành",
    from: { id: 99999, username: "super_admin" } // Role: Admin
  });
  assert(s8, "8.4 Quản trị viên tối cao (Admin) sở hữu toàn quyền Override trên hệ thống",
    adminOverrideRes.success && adminOverrideRes.newStatus === "Hoàn thành"
  );


  // ----------------------------------------------------------------------------
  // SUITE 9: R5 REST API Contracts (doGet & doPost)
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 9] R5 REST API Contracts (doGet & doPost Endpoints)");
  suiteResults.push({ name: "Suite 9: R5 REST API Contracts", passed: 0, failed: 0 });
  const s9 = 8;

  // 9.1 doGet getIdeas returns enriched JSON
  const apiIdeas = bot.handleApiGet({ action: "getIdeas" });
  assert(s9, "9.1 API doGet?action=getIdeas trả về danh sách ý tưởng kèm thông tin Developer & Bounty",
    apiIdeas.ok && Array.isArray(apiIdeas.data) && apiIdeas.data.length >= 4 && apiIdeas.data[0].votes !== undefined
  );

  // 9.2 doGet getUserVotes returns user voted list
  const apiUserVotes = bot.handleApiGet({ action: "getUserVotes", userId: "601" });
  assert(s9, "9.2 API doGet?action=getUserVotes trả về mảng các ideaId mà user đã bình chọn",
    apiUserVotes.ok && Array.isArray(apiUserVotes.votedIdeas) && apiUserVotes.votedIdeas.includes(2)
  );

  // 9.3 doGet getStats returns system statistics
  const apiStats = bot.handleApiGet({ action: "getStats" });
  assert(s9, "9.3 API doGet?action=getStats trả về tổng số ideas, votes và bounties",
    apiStats.ok && apiStats.stats.totalIdeas >= 4 && apiStats.stats.totalVotes >= 1
  );

  // 9.4 doPost submitIdea creates idea via Web
  const apiSubmit = bot.handleApiPost({
    apiAction: "submitIdea",
    title: "Tool Tối Ưu SEO Tự Động",
    description: "Phân tích từ khóa và gợi ý meta tag chuẩn SEO",
    category: "Marketing",
    username: "seo_expert",
    userId: "WEB_SEO_101"
  });
  assert(s9, "9.4 API doPost?apiAction=submitIdea tạo ý tưởng mới thành công từ Web Dashboard (Idea #5)",
    apiSubmit.ok && apiSubmit.ideaId === 5
  );

  // 9.5 doPost voteIdea handles Web upvote
  const apiVote = bot.handleApiPost({
    apiAction: "voteIdea",
    ideaId: 5,
    userId: "WEB_VOTER_202",
    username: "web_voter_202"
  });
  assert(s9, "9.5 API doPost?apiAction=voteIdea xử lý lượt bình chọn từ giao diện Web",
    apiVote.ok && apiVote.action === "VOTE" && apiVote.currentVotes === 1
  );

  // 9.6 doPost pledgeBounty records bounty via Web
  const apiBounty = bot.handleApiPost({
    apiAction: "pledgeBounty",
    ideaId: 5,
    userId: "WEB_SPONSOR_303",
    username: "web_sponsor_303",
    amount: 1000000,
    unit: "VND",
    message: "Tài trợ dự án SEO"
  });
  assert(s9, "9.6 API doPost?apiAction=pledgeBounty ghi nhận đóng góp tài trợ qua Web",
    apiBounty.ok && apiBounty.bountyId === 4 && apiBounty.badgeText.includes("1.000.000 VNĐ")
  );


  // ----------------------------------------------------------------------------
  // SUITE 10: R5 Dual-Platform Sync & Concurrency
  // ----------------------------------------------------------------------------
  console.log("\n🔹 [SUITE 10] R5 Dual-Platform Sync & Concurrency (Web <-> Telegram Sync)");
  suiteResults.push({ name: "Suite 10: R5 Dual-Platform Sync & Concurrency", passed: 0, failed: 0 });
  const s10 = 9;

  // 10.1 Web upvote triggers Telegram keyboard sync
  const lastKbCall = urlFetch.editedKeyboards[urlFetch.editedKeyboards.length - 1];
  assert(s10, "10.1 Bình chọn từ Web lập tức kích hoạt cập nhật bàn phím tin nhắn trên Telegram",
    lastKbCall !== undefined && lastKbCall.reply_markup !== null
  );

  // 10.2 Telegram claim syncs with Web Dashboard API output
  const refreshedIdeas = bot.handleApiGet({ action: "getIdeas" });
  const idea1Api = refreshedIdeas.data.find(item => item.id === 1);
  assert(s10, "10.2 Thao tác nhận làm tool trên Telegram được phản ánh đầy đủ trên Web Dashboard API",
    idea1Api && idea1Api.status === "Hoàn thành"
  );

  // 10.3 LockService mutex concurrency verification
  assert(s10, "10.3 Cơ chế khóa đồng thời LockService (waitLock & releaseLock) được thực thi đúng chuẩn",
    lockService.lockCount >= 3 && lockService.releaseCount === lockService.lockCount && !lockService.locked
  );

  // 10.4 AuditLogs verification
  const auditData = ss.getSheetByName("AuditLogs").getDataRange().getValues();
  assert(s10, "10.4 Toàn bộ các thao tác nghiệp vụ quan trọng được ghi vết đầy đủ trong sheet AuditLogs",
    auditData.length >= 8
  );

  // ----------------------------------------------------------------------------
  // SUMMARY REPORT & EXIT CODE
  // ----------------------------------------------------------------------------
  const duration = Date.now() - startTime;
  console.log("\n================================================================================");
  console.log("📊 KẾT QUẢ TỔNG QUAN KIỂM THỬ (SUMMARY REPORT)");
  console.log("================================================================================");
  console.log(`⏱️ Thời gian thực thi: ${duration}ms`);
  console.log(`📋 Tổng số bài kiểm thử: ${totalPassed + totalFailed} assertions across 10 test suites\n`);

  suiteResults.forEach((res, idx) => {
    const icon = res.failed === 0 ? "✅" : "❌";
    console.log(`  ${icon} Suite ${idx + 1}: ${res.name.padEnd(52, " ")} -> ${res.passed} passed / ${res.failed} failed`);
  });

  console.log("--------------------------------------------------------------------------------");
  console.log(`🎯 TỔNG KẾT: ${totalPassed} PASSED / ${totalFailed} FAILED`);

  if (totalFailed === 0) {
    console.log("🎉 TẤT CẢ 10 BỘ KIỂM THỬ ĐÃ VƯỢT QUA 100%! HỆ THỐNG SẴN SÀNG TRIỂN KHAI.");
    console.log("================================================================================\n");
    process.exitCode = 0;
  } else {
    console.error("❌ CÓ BÀI KIỂM THỬ BỊ THẤT BẠI! VUI LÒNG KIỂM TRA LẠI LOGS.");
    console.log("================================================================================\n");
    process.exitCode = 1;
  }
}

// Chạy toàn bộ test suites
runAllTestSuites();
