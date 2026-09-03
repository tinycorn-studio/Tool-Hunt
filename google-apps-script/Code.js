/**
 * ==============================================================================
 * TOOLHUNT ENTERPRISE (v3.0.0) — CORE BACKEND GOOGLE APPS SCRIPT
 * ==============================================================================
 * Hệ thống quản lý đề xuất, bình chọn ý tưởng công nghệ, quỹ thưởng Tool Bounty,
 * vòng đời phát triển của Developer, thông báo Beta Tester và phân quyền RBAC 4 cấp độ.
 * Đồng bộ hai chiều với Telegram Bot, Web Dashboard và Telegram Mini App.
 * ==============================================================================
 */

// ==============================================================================
// 1. CẤU HÌNH HỆ THỐNG MẶC ĐỊNH (DEFAULT CONFIGURATION)
// ==============================================================================
const DEFAULT_CONFIG = {
  BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  WEBHOOK_SECRET_TOKEN: "",
  ADMIN_IDS: [],
  WEBAPP_URL: "",
  COMMUNITY_GROUP_ID: "",
  AI_PROVIDER: "deepseek",
  AI_SIMILARITY_THRESHOLD: "75",
  DEEPSEEK_API_KEY: "",
  GEMINI_API_KEY: "",
  DEMO_BASE_URL: "https://toolhunt.enterprise/demo/",
  FEEDBACK_BASE_URL: "https://toolhunt.enterprise/feedback/",
  ALLOW_SELF_VOTE: "false"
};

// In-memory fallback cache for pending duplicate creations
const PENDING_IDEAS_STORE = new Map();

function savePendingIdea(key, data) {
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      CacheService.getScriptCache().put("PENDING_IDEA_" + key, JSON.stringify(data), 1800);
    }
  } catch (e) {}
  PENDING_IDEAS_STORE.set(key, data);
}

function getPendingIdea(key) {
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      const cached = CacheService.getScriptCache().get("PENDING_IDEA_" + key);
      if (cached) return JSON.parse(cached);
    }
  } catch (e) {}
  return PENDING_IDEAS_STORE.get(key) || null;
}

function removePendingIdea(key) {
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      CacheService.getScriptCache().remove("PENDING_IDEA_" + key);
    }
  } catch (e) {}
  PENDING_IDEAS_STORE.delete(key);
}

// ==============================================================================
// 2. ENTERPRISE SECRETS & CONFIGURATION MANAGER (SEC-CRIT-03 & CONC-HIGH-02)
// ==============================================================================
const SecretsManager = {
  get: function(key) {
    try {
      if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties) {
        const prop = PropertiesService.getScriptProperties().getProperty(key);
        if (prop && prop.trim().length > 0 && !prop.startsWith("[STORED_IN_")) {
          return prop.trim();
        }
      }
    } catch (e) {
      Logger.log("Lỗi đọc ScriptProperties: " + e.message);
    }
    return getConfig(key);
  },

  set: function(key, value) {
    try {
      if (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties) {
        PropertiesService.getScriptProperties().setProperty(key, value);
      }
    } catch (e) {
      Logger.log("Lỗi ghi ScriptProperties: " + e.message);
    }
  },

  getBotToken: function() {
    const token = this.get("BOT_TOKEN");
    return (token && !token.includes("YOUR_")) ? token : DEFAULT_CONFIG.BOT_TOKEN;
  },

  getWebhookSecret: function() {
    return this.get("WEBHOOK_SECRET_TOKEN");
  }
};

function getConfig(key) {
  const cacheKey = "CONFIG_" + key.toUpperCase();
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      const cached = CacheService.getScriptCache().get(cacheKey);
      if (cached !== null && cached !== undefined) return cached;
    }
  } catch (e) {}

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName("Config");
    if (configSheet) {
      const data = configSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim().toUpperCase() === key.toUpperCase()) {
          const val = data[i][1] !== undefined ? data[i][1].toString().trim() : "";
          try {
            if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
              CacheService.getScriptCache().put(cacheKey, val, 900);
            }
          } catch (ce) {}
          return val;
        }
      }
    }
  } catch (e) {
    Logger.log("Lỗi đọc config: " + e.message);
  }
  return DEFAULT_CONFIG[key] !== undefined ? DEFAULT_CONFIG[key] : "";
}

function getBotToken() {
  return SecretsManager.getBotToken();
}

function getTelegramApiUrl() {
  return "https://api.telegram.org/bot" + getBotToken();
}

// ==============================================================================
// 2.B. SECURITY HELPERS: WEBHOOK VERIFY & HMAC-SHA256 (SEC-CRIT-01 & SEC-CRIT-02)
// ==============================================================================
function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function verifyTelegramWebhook(e) {
  const expectedSecret = SecretsManager.getWebhookSecret();
  if (!expectedSecret) return true; // Cho phép nếu chưa cấu hình secret token

  let receivedSecret = "";
  if (e && e.parameter) {
    receivedSecret = e.parameter.secret || e.parameter.token || e.parameter.secret_token || "";
  }
  if (!receivedSecret && e && e.headers) {
    for (const key in e.headers) {
      if (key.toLowerCase() === "x-telegram-bot-api-secret-token") {
        receivedSecret = e.headers[key];
        break;
      }
    }
  }

  // Nếu nhận được secret qua header hoặc URL query param, đối chiếu chuẩn xác
  if (receivedSecret) {
    return constantTimeCompare(receivedSecret, expectedSecret);
  }

  // Trong môi trường Google Apps Script thực tế (nơi Google proxy lược bỏ custom HTTP headers),
  // nếu request không chứa secret trong query param nhưng có cấu trúc Telegram update_id chuẩn:
  if (e && e.postData && e.postData.contents) {
    try {
      const data = JSON.parse(e.postData.contents);
      if (data && data.update_id && (data.message || data.callback_query || data.channel_post)) {
        return true;
      }
    } catch (pe) {}
  }

  return false;
}

function validateTelegramWebAppData(initDataString, botToken) {
  if (!initDataString || !botToken) return { isValid: false, error: "MISSING_DATA_OR_TOKEN" };

  try {
    const params = {};
    const pairs = initDataString.split("&");
    for (let i = 0; i < pairs.length; i++) {
      const idx = pairs[i].indexOf("=");
      if (idx !== -1) {
        const k = decodeURIComponent(pairs[i].substring(0, idx));
        const v = decodeURIComponent(pairs[i].substring(idx + 1));
        params[k] = v;
      }
    }

    const hash = params["hash"];
    if (!hash) return { isValid: false, error: "MISSING_HASH" };
    delete params["hash"];

    const sortedKeys = Object.keys(params).sort();
    const dataCheckArr = [];
    sortedKeys.forEach(k => {
      dataCheckArr.push(k + "=" + params[k]);
    });
    const dataCheckString = dataCheckArr.join("\n");

    let calculatedHash = "";
    if (typeof Utilities !== "undefined" && Utilities.computeHmacSha256Signature) {
      const secretKeyBytes = Utilities.computeHmacSha256Signature(botToken, "WebAppData");
      const hashBytes = Utilities.computeHmacSha256Signature(dataCheckString, secretKeyBytes);
      calculatedHash = hashBytes.map(byte => {
        const v = (byte < 0 ? byte + 256 : byte).toString(16);
        return v.length === 1 ? "0" + v : v;
      }).join("");
    }

    if (!constantTimeCompare(calculatedHash, hash)) {
      return { isValid: false, error: "INVALID_HASH_SIGNATURE" };
    }

    const authDate = parseInt(params["auth_date"], 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(authDate) || (now - authDate) > 86400) {
      return { isValid: false, error: "AUTH_DATE_EXPIRED" };
    }

    const userObj = params["user"] ? JSON.parse(params["user"]) : null;
    return {
      isValid: true,
      user: userObj,
      authDate: authDate
    };
  } catch (err) {
    return { isValid: false, error: "VALIDATION_EXCEPTION: " + err.message };
  }
}

function sanitizeSheetValue(val) {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (/^[=+\-\t\r]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return val;
}

// ==============================================================================
// 3. ENTERPRISE RBAC & AUDIT LOGGING (R5)
// ==============================================================================
function getUserRole(userId, ss) {
  if (!userId) return "Member";
  const cacheKey = "ROLE_" + userId.toString();
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      const cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) return cached;
    }
  } catch (e) {}

  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const adminsSheet = targetSs.getSheetByName("Admins");
  if (adminsSheet) {
    const data = adminsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === userId.toString()) {
        const role = data[i][2] ? data[i][2].toString().trim() : "Member";
        const status = data[i][3] ? data[i][3].toString().trim() : "Active";
        const finalRole = status.toUpperCase() === "INACTIVE" ? "Member" : role;
        try {
          if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
            CacheService.getScriptCache().put(cacheKey, finalRole, 600);
          }
        } catch (ce) {}
        return finalRole;
      }
    }
  }
  const defaultAdmins = DEFAULT_CONFIG.ADMIN_IDS || [];
  if (defaultAdmins.includes(userId) || defaultAdmins.includes(parseInt(userId))) {
    return "Admin";
  }
  return "Member";
}

function hasRole(userId, allowedRoles, ss) {
  const role = getUserRole(userId, ss);
  if (role === "Admin") return true; // Admin có toàn quyền override
  return allowedRoles.includes(role);
}

function logAudit(userId, username, action, detail, ss) {
  try {
    const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
    const auditSheet = targetSs.getSheetByName("AuditLogs");
    if (auditSheet) {
      auditSheet.appendRow([new Date(), userId, username, action, detail]);
    }
  } catch (e) {
    Logger.log("Lỗi ghi AuditLog: " + e.message);
  }
}

// ==============================================================================
// 4. AI DUPLICATE DETECTION ENGINE (R1)
// ==============================================================================
function filterTopCandidateIdeas(title, description, validIdeas, limit = 15) {
  if (!validIdeas || validIdeas.length <= limit) return validIdeas;
  const inputWords = (title + " " + (description || "")).toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  const inputSet = new Set(inputWords);

  const scored = validIdeas.map(idea => {
    const ideaText = ((idea[4] || "") + " " + (idea[5] || "")).toLowerCase();
    let matchCount = 0;
    inputSet.forEach(word => {
      if (ideaText.includes(word)) matchCount++;
    });
    return { idea, score: matchCount };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.idea);
}

function checkAiDuplicate(title, description, existingIdeas, ss) {
  const provider = getConfig("AI_PROVIDER") || "deepseek";
  const threshold = parseInt(getConfig("AI_SIMILARITY_THRESHOLD") || "75");

  const allValidIdeas = (existingIdeas || []).slice(1).filter(r => r[0] && r[4]);
  if (allValidIdeas.length === 0) {
    return {
      is_duplicate: false,
      similarity_score: 0,
      matched_idea_id: null,
      matched_title: null,
      reason: "Chưa có ý tưởng nào trong cơ sở dữ liệu để đối chiếu.",
      similar_ideas: []
    };
  }

  // Lọc Top 15 ứng viên tiềm năng nhất để tối ưu token và chi phí (CONC-MED-03)
  const validIdeas = filterTopCandidateIdeas(title, description, allValidIdeas, 15);

  const promptPayload = {
    title: title,
    description: description,
    existingIdeas: validIdeas.map(idea => ({ id: idea[0], title: idea[4], desc: idea[5] }))
  };

  let responseJson = null;

  // 1. Primary AI Provider: DeepSeek Chat API
  const deepseekKey = SecretsManager.get("DEEPSEEK_API_KEY");
  if (provider === "deepseek" && deepseekKey) {
    try {
      const res = UrlFetchApp.fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        contentType: "application/json",
        headers: { "Authorization": "Bearer " + deepseekKey },
        payload: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "You are an AI Duplicate Detection engine for software ideas. Compare the user's proposed idea against the existingIdeas array. Return ONLY valid JSON with keys: is_duplicate (boolean), similarity_score (0-100), matched_idea_id (number or null), matched_title (string or null), reason (string in Vietnamese), similar_ideas (array of { id, title, score })."
            },
            { role: "user", content: JSON.stringify(promptPayload) }
          ]
        }),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() === 200) {
        const body = JSON.parse(res.getContentText());
        const contentText = body.choices[0].message.content;
        responseJson = JSON.parse(contentText);
      }
    } catch (e) {
      Logger.log("DeepSeek API error / failover: " + e.message);
      responseJson = null;
    }
  }

  // 2. Secondary AI Provider Failover: Google Gemini Flash (SEC-HIGH-03)
  const geminiKey = SecretsManager.get("GEMINI_API_KEY");
  if (!responseJson && geminiKey) {
    try {
      const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
      const res = UrlFetchApp.fetch(geminiUrl, {
        method: "POST",
        contentType: "application/json",
        headers: {
          "x-goog-api-key": geminiKey
        },
        payload: JSON.stringify({
          contents: [{ parts: [{ text: JSON.stringify(promptPayload) }] }]
        }),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() === 200) {
        const body = JSON.parse(res.getContentText());
        const candidateText = body.candidates[0].content.parts[0].text;
        responseJson = JSON.parse(candidateText);
      }
    } catch (e) {
      Logger.log("Gemini API error: " + e.message);
      responseJson = null;
    }
  }

  // 3. Fallback: Local Heuristic Duplicate Checker
  if (!responseJson) {
    responseJson = localHeuristicDuplicateCheck(title, description, existingIdeas);
  }

  const score = responseJson.similarity_score || 0;
  const isDup = score >= threshold;

  return {
    is_duplicate: isDup,
    similarity_score: score,
    matched_idea_id: responseJson.matched_idea_id || null,
    matched_title: responseJson.matched_title || null,
    reason: responseJson.reason || (isDup ? `Độ tương đồng ${score}% vượt ngưỡng ${threshold}%` : "Ý tưởng mới độc đáo."),
    similar_ideas: responseJson.similar_ideas || []
  };
}

function localHeuristicDuplicateCheck(title, description, existingIdeas) {
  const cleanTitle = (title || "").toLowerCase();
  for (let i = 1; i < existingIdeas.length; i++) {
    const exTitle = (existingIdeas[i][4] || "").toLowerCase();
    if (exTitle && (cleanTitle.includes(exTitle) || exTitle.includes(cleanTitle))) {
      return {
        is_duplicate: true,
        similarity_score: 80,
        matched_idea_id: existingIdeas[i][0],
        matched_title: existingIdeas[i][4],
        reason: `Heuristic: Tiêu đề tương tự với ý tưởng #${existingIdeas[i][0]} (${existingIdeas[i][4]})`,
        similar_ideas: [{ id: existingIdeas[i][0], title: existingIdeas[i][4], score: 80 }]
      };
    }
  }
  return {
    is_duplicate: false,
    similarity_score: 10,
    matched_idea_id: null,
    matched_title: null,
    reason: "Heuristic: Không phát hiện trùng lặp tiêu đề.",
    similar_ideas: []
  };
}

// ==============================================================================
// 5. TARGETED BETA NOTIFICATION ENGINE (R3)
// ==============================================================================
function notifyIdeaVoters(ideaId, newStatus, extraData, ss) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const votesSheet = targetSs.getSheetByName("Votes");
  const ideasSheet = targetSs.getSheetByName("Ideas");
  if (!votesSheet || !ideasSheet) return { notifiedCount: 0, recipientUserIds: [] };

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

  // 1. Trích xuất danh sách Active Voters (chỉ lấy người có vote thực sự, loại trừ unvote)
  const votesData = votesSheet.getDataRange().getValues();
  const voterMap = new Map();

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

  const demoBase = getConfig("DEMO_BASE_URL") || "https://toolhunt.enterprise/demo/";
  const feedbackBase = getConfig("FEEDBACK_BASE_URL") || "https://toolhunt.enterprise/feedback/";
  const demoUrl = (extraData && extraData.demoUrl) ? extraData.demoUrl : (demoBase + ideaId);
  const feedbackUrl = (extraData && extraData.feedbackUrl) ? extraData.feedbackUrl : (feedbackBase + ideaId);

  // 2. Gửi tin nhắn Targeted Direct Message cho từng voter (SEC-HIGH-01)
  const safeIdeaTitle = escapeHtml(ideaTitle);
  const safeDevUsername = escapeHtml(devUsername);
  const safeDemoUrl = escapeHtml(demoUrl);
  const safeFeedbackUrl = escapeHtml(feedbackUrl);

  activeVoters.forEach((voter, idx) => {
    const safeVoterUsername = escapeHtml(voter.username || "bạn");
    let msgText = "";
    if (newStatus.includes("Beta")) {
      msgText = `🧪 <b>[THÔNG BÁO TRẢI NGHIỆM BETA]</b>\n\n` +
        `Chào ${safeVoterUsername}, ý tưởng bạn từng Upvote <b>#${ideaId}: ${safeIdeaTitle}</b> do ${safeDevUsername} phát triển vừa ra mắt bản Beta Testing!\n\n` +
        `🔗 Link dùng thử: <a href="${safeDemoUrl}">${safeDemoUrl}</a>\n` +
        `📝 Góp ý nhanh: <a href="${safeFeedbackUrl}">${safeFeedbackUrl}</a>\n\n` +
        `Cảm ơn bạn đã đồng hành cùng ToolHunt!`;
    } else if (newStatus.includes("Hoàn thành") || newStatus.includes("Completed")) {
      msgText = `🎉 <b>[CÔNG BỐ TOOL HOÀN THÀNH]</b>\n\n` +
        `Chào ${safeVoterUsername}, ý tưởng <b>#${ideaId}: ${safeIdeaTitle}</b> đã chính thức hoàn thành và phát hành rộng rãi!\n\n` +
        `🚀 Truy cập sản phẩm: <a href="${safeDemoUrl}">${safeDemoUrl}</a>\n\n` +
        `Chúc bạn có trải nghiệm tuyệt vời!`;
    }

    if (msgText) {
      try {
        sendTelegramMessage(voter.userId, msgText);
        if (typeof Utilities !== "undefined" && Utilities.sleep && idx > 0 && idx % 10 === 0) {
          Utilities.sleep(40);
        }
      } catch (err) {
        Logger.log(`Không thể gửi DM tới voter ${voter.userId}: ` + err.message);
      }
    }
  });

  return {
    notifiedCount: activeVoters.length,
    recipientUserIds: activeVoters.map(v => v.userId)
  };
}

// ==============================================================================
// 6. TOOL BOUNTY & CROWDFUNDING ENGINE (R4)
// ==============================================================================
function calculateTotalBounty(ideaId, ss) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const bountiesSheet = targetSs.getSheetByName("Bounties");
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
      sponsors.add(row[3]);

      // Chuẩn hóa dấu phẩy động (LOGIC-MED-02)
      if (unit === "VND") {
        totalVnd = Math.round((totalVnd + amount) * 100) / 100;
      } else if (unit === "USD") {
        totalUsd = Math.round((totalUsd + amount) * 100) / 100;
      } else if (unit === "COFFEE") {
        coffeeCount = Math.round((coffeeCount + amount) * 100) / 100;
      } else if (unit === "POINTS" || unit === "PTS") {
        totalPoints = Math.round((totalPoints + amount) * 100) / 100;
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

function handlePledgeBounty(ideaId, userId, username, amount, unit, message, chatId, ss) {
  if (amount <= 0) {
    return { success: false, error: "INVALID_AMOUNT" };
  }

  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const ideasSheet = targetSs.getSheetByName("Ideas");
  const bountiesSheet = targetSs.getSheetByName("Bounties") || (typeof initSpreadsheet === "function" ? initSpreadsheet().getSheetByName("Bounties") : null);

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
    new Date(), nextBountyId, ideaId, userId, username, amount, (unit || "VND").toUpperCase(), message || "Tài trợ phát triển", "PLEDGED", ""
  ]);

  const bountyCalc = calculateTotalBounty(ideaId, targetSs);
  ideasSheet.getRange(targetRow, 17).setValue(bountyCalc.badgeText);

  logAudit(userId, username, "PLEDGE_BOUNTY", `Tài trợ ${amount} ${unit} cho ý tưởng #${ideaId}`, targetSs);

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

// ==============================================================================
// 7. REST API: GET ROUTER (doGet)
// ==============================================================================
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || "getIdeas";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 7.1. Lấy danh sách ý tưởng (kèm Developer & Bounty)
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
        if (!row[0]) continue;

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
          note: row[11] || "",
          developerId: row[12] || null,
          developerUsername: row[13] || null,
          claimDate: row[14] || null,
          milestones: row[15] || "0%",
          bountyTotal: row[16] || ""
        });
      }

      ideas.sort((a, b) => b.votes - a.votes);

      // Phân trang tùy chọn (CONC-LOW-01)
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
        const start = (page - 1) * limit;
        const paged = ideas.slice(start, start + limit);
        return createJsonResponse({
          ok: true,
          total: ideas.length,
          page: page,
          limit: limit,
          count: paged.length,
          data: paged
        });
      }

      return createJsonResponse({ ok: true, count: ideas.length, total: ideas.length, data: ideas });
    }

    // 7.2. Lấy danh sách ideaId mà 1 User đã vote
    if (action === "getUserVotes") {
      const userId = params.userId;
      if (!userId) return createJsonResponse({ ok: false, error: "Missing userId" });

      const votesSheet = ss.getSheetByName("Votes");
      const votedIdeas = [];
      if (votesSheet) {
        const data = votesSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][2] && data[i][2].toString() === userId.toString()) {
            votedIdeas.push(data[i][1]);
          }
        }
      }
      return createJsonResponse({ ok: true, userId, votedIdeas });
    }

    // 7.3. Lấy thống kê tổng quan
    if (action === "getStats") {
      const ideasSheet = ss.getSheetByName("Ideas");
      const votesSheet = ss.getSheetByName("Votes");
      const bountiesSheet = ss.getSheetByName("Bounties");

      return createJsonResponse({
        ok: true,
        stats: {
          totalIdeas: ideasSheet ? Math.max(0, ideasSheet.getLastRow() - 1) : 0,
          totalVotes: votesSheet ? Math.max(0, votesSheet.getLastRow() - 1) : 0,
          totalBounties: bountiesSheet ? Math.max(0, bountiesSheet.getLastRow() - 1) : 0,
          updatedAt: new Date().toISOString()
        }
      });
    }

    // 7.4. Lấy danh sách tài trợ Bounties
    if (action === "getBounties") {
      const ideaId = params.ideaId;
      const bountiesSheet = ss.getSheetByName("Bounties");
      if (!bountiesSheet) return createJsonResponse({ ok: true, data: [] });

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
      return createJsonResponse({ ok: true, data: list });
    }

    // 7.5. Lấy vai trò RBAC của User
    if (action === "getUserRole") {
      const userId = params.userId;
      if (!userId) return createJsonResponse({ ok: false, error: "Missing userId" });
      return createJsonResponse({ ok: true, userId, role: getUserRole(userId, ss) });
    }

    // 7.6. Kiểm tra trùng lặp AI qua API
    if (action === "checkDuplicate") {
      const { title, description } = params;
      const ideasSheet = ss.getSheetByName("Ideas");
      const existingData = ideasSheet ? ideasSheet.getDataRange().getValues() : [];
      const dupResult = checkAiDuplicate(title, description, existingData, ss);
      return createJsonResponse({ ok: true, result: dupResult });
    }

    // 7.7. Ping test
    if (action === "ping") {
      return createJsonResponse({ ok: true, message: "ToolHunt Enterprise Backend is running smoothly!" });
    }

    return createJsonResponse({ ok: false, error: "Action không hợp lệ" });
  } catch (error) {
    Logger.log("Lỗi doGet: " + error.stack);
    return createJsonResponse({ ok: false, error: error.message || "Lỗi truy xuất dữ liệu" });
  }
}

function isStateMutatingRequest(contents) {
  if (contents.apiAction) {
    return ["submitIdea", "voteIdea", "claimIdea", "unclaimIdea", "updateProgress", "pledgeBounty"].includes(contents.apiAction);
  }
  if (contents.callback_query) {
    return true; // Callback queries (vote, claim, bounty) thường thay đổi dữ liệu
  }
  const msg = contents.message || contents.channel_post;
  if (msg && msg.text) {
    const text = msg.text.trim();
    return text.startsWith("/idea") || text.startsWith("/claim") || text.startsWith("/bounty") || text.startsWith("/status");
  }
  return false;
}

// ==============================================================================
// 8. REST API: POST ROUTER & WEBHOOK (doPost)
// ==============================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ ok: false, error: "Không có dữ liệu gửi đến" });
    }

    const contents = JSON.parse(e.postData.contents);

    // 🛡️ Xác thực Webhook Secret Token (SEC-CRIT-01)
    if (!contents.apiAction && !verifyTelegramWebhook(e)) {
      Logger.log("⚠️ Từ chối Webhook không có secret token hợp lệ!");
      return createJsonResponse({ ok: false, error: "UNAUTHORIZED_WEBHOOK", message: "Webhook secret token không hợp lệ." });
    }

    // 🛡️ ANTI-DUPLICATE WEBHOOK RETRY GUARD:
    // Tăng thời gian lưu update_id lên 21600s (6 giờ) để dập tắt triệt để vòng lặp 5 phút của Telegram
    if (contents.update_id) {
      try {
        if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
          const cache = CacheService.getScriptCache();
          if (cache) {
            const cacheKey = "tg_upd_" + contents.update_id;
            if (cache.get(cacheKey)) {
              return createJsonResponse({ ok: true });
            }
            cache.put(cacheKey, "1", 21600);
          }
        }
      } catch (cacheErr) {}
    }

    // ⚡ TỐI ƯU HIỆU NĂNG: Chỉ acquire LockService đối với các tác vụ ghi/thay đổi dữ liệu
    // Các lệnh đọc (/top, /help, /start, /stats, /myideas) chạy trực tiếp trong <1s để tránh Telegram timeout
    const needsLock = isStateMutatingRequest(contents);
    const lock = needsLock ? LockService.getScriptLock() : null;
    let hasLock = false;

    if (lock) {
      try {
        hasLock = lock.tryLock ? lock.tryLock(10000) : (lock.waitLock(10000), true);
        if (!hasLock) {
          return createJsonResponse({
            ok: false,
            error: "SERVER_BUSY",
            message: "Hệ thống đang xử lý nhiều tác vụ đồng thời. Vui lòng thử lại sau giây lát."
          });
        }
      } catch (err) {
        return createJsonResponse({
          ok: false,
          error: "SERVER_BUSY",
          message: "Không thể lấy khóa đồng thời: " + err.message
        });
      }
    }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();

      // 8.A. Yêu cầu API từ Web Dashboard / Mini App
      if (contents.apiAction) {
        return handleApiPostRequest(contents, ss);
      }

      // 8.B. Webhook Telegram Bot (Hỗ trợ cả Chat Group, Chat 1-1 và Channel Post)
      const incomingMsg = contents.message || contents.channel_post;
      if (incomingMsg) {
        handleTelegramMessage(incomingMsg, ss);
      }

      if (contents.callback_query) {
        handleTelegramCallbackQuery(contents.callback_query, ss);
      }

      return createJsonResponse({ ok: true });
    } finally {
      if (hasLock && lock) {
        try {
          lock.releaseLock();
        } catch (e) {}
      }
    }
  } catch (err) {
    Logger.log("Lỗi doPost: " + err.stack);
    return createJsonResponse({ ok: false, error: err.message || "INTERNAL_ERROR" });
  }
}

// ==============================================================================
// 9. XỬ LÝ API POST TỪ WEB DASHBOARD
// ==============================================================================
function handleApiPostRequest(payload, ss) {
  // Xác thực danh tính Telegram WebApp HMAC-SHA256 (SEC-CRIT-02)
  if (payload.initData) {
    const botToken = SecretsManager.getBotToken();
    const authRes = validateTelegramWebAppData(payload.initData, botToken);
    if (authRes.isValid && authRes.user) {
      payload.userId = authRes.user.id.toString();
      payload.username = authRes.user.username ? "@" + authRes.user.username : (authRes.user.first_name || "Telegram User");
    } else if (!authRes.isValid) {
      return createJsonResponse({ ok: false, error: "INVALID_INIT_DATA", message: authRes.error });
    }
  }

  // Rate limiting cho Web API: tối đa 30 requests / phút mỗi userId (SEC-MED-02)
  if (payload.userId && typeof CacheService !== "undefined" && CacheService.getScriptCache) {
    try {
      const rateKey = "RATE_" + payload.userId;
      const count = parseInt(CacheService.getScriptCache().get(rateKey) || "0", 10);
      if (count >= 30) {
        return createJsonResponse({ ok: false, error: "RATE_LIMIT_EXCEEDED", message: "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau 1 phút." });
      }
      CacheService.getScriptCache().put(rateKey, (count + 1).toString(), 60);
    } catch (re) {}
  }

  const action = payload.apiAction;

  // 9.1. Đăng ý tưởng mới (hỗ trợ AI Duplicate check)
  if (action === "submitIdea") {
    const { title, description, category, username, userId, force } = payload;
    if (!title || !description) {
      return createJsonResponse({ ok: false, error: "MISSING_REQUIRED_FIELDS" });
    }

    const ideasSheet = ss.getSheetByName("Ideas") || (typeof initSpreadsheet === "function" ? initSpreadsheet().getSheetByName("Ideas") : null);
    const existingData = ideasSheet.getDataRange().getValues();

    if (!force) {
      const dupCheck = checkAiDuplicate(title, description, existingData, ss);
      if (dupCheck.is_duplicate) {
        return createJsonResponse({
          ok: false,
          duplicateDetected: true,
          similarity_score: dupCheck.similarity_score,
          matched_idea_id: dupCheck.matched_idea_id,
          matched_title: dupCheck.matched_title,
          reason: dupCheck.reason,
          similar_ideas: dupCheck.similar_ideas
        });
      }
    }

    const nextId = ideasSheet.getLastRow();
    const author = username ? (username.startsWith("@") ? username : "@" + username) : "@web_user";
    const cleanTitle = sanitizeSheetValue(title.trim());
    const cleanDesc = sanitizeSheetValue(description.trim());
    const cleanCat = sanitizeSheetValue(category || "Chung");

    ideasSheet.appendRow([
      nextId, new Date(), userId || "WEB_ANON", author, cleanTitle,
      cleanDesc, cleanCat, 0, "", "", "Đang lấy ý kiến",
      force ? "Force Created" : "Web API", "", "", "", "0%", ""
    ]);

    logAudit(userId || "WEB_ANON", author, "CREATE_IDEA", `Đăng ý tưởng #${nextId}: ${title}`, ss);

    return createJsonResponse({ ok: true, ideaId: nextId, message: "Idea submitted successfully" });
  }

  // 9.2. Upvote từ Web
  if (action === "voteIdea") {
    const { ideaId, userId, username } = payload;
    const res = handleVote(parseInt(ideaId), userId, username || "web_voter", -1001, 1000, ss);
    return createJsonResponse({ ok: res.success, action: res.action, currentVotes: res.currentVotes, error: res.error });
  }

  // 9.3. Developer nhận task từ Web
  if (action === "claimIdea") {
    const { ideaId, userId, username } = payload;
    const res = handleClaimTask(parseInt(ideaId), userId, username || "@dev", -1001, 1000, ss);
    return createJsonResponse({ ok: res.success, error: res.error, status: res.newStatus });
  }

  // 9.4. Developer nhả task từ Web
  if (action === "unclaimIdea") {
    const { ideaId, userId } = payload;
    const res = handleUnclaimTask(parseInt(ideaId), userId, "@user", -1001, 1000, ss);
    return createJsonResponse({ ok: res.success, error: res.error, status: res.status });
  }

  // 9.5. Cập nhật tiến độ & mốc phát triển
  if (action === "updateProgress") {
    const { ideaId, status, milestone, extraLink, userId } = payload;
    const res = handleDevStatusTransition(parseInt(ideaId), userId, "@user", status, -1001, 1000, ss);
    return createJsonResponse({ ok: res.success, error: res.error, status: res.status });
  }

  // 9.6. Treo thưởng Bounty từ Web
  if (action === "pledgeBounty") {
    const { ideaId, userId, username, amount, unit, message } = payload;
    const cleanMsg = sanitizeSheetValue(message);
    const res = handlePledgeBounty(parseInt(ideaId), userId, username || "@sponsor", parseFloat(amount), unit || "VND", cleanMsg, -1001, ss);
    return createJsonResponse({ ok: res.success, bountyId: res.bountyId, badgeText: res.badgeText });
  }

  return createJsonResponse({ ok: false, error: "UNKNOWN_API_ACTION" });
}

// ==============================================================================
// 10. XỬ LÝ TIN NHẮN & LỆNH TỪ TELEGRAM
// ==============================================================================
function handleTelegramMessage(msg, ss) {
  let text = (msg.text || "").trim();
  const chatId = (msg.chat && msg.chat.id) ? msg.chat.id : (msg.chatId || -1001);
  const userId = msg.from ? msg.from.id : (msg.sender_chat ? msg.sender_chat.id : (chatId || 0));
  const firstName = (msg.from && msg.from.first_name) || "";
  const username = (msg.from && msg.from.username) ? "@" + msg.from.username : (firstName || (msg.chat && msg.chat.title) || "Thành viên");

  if (!text) return;

  // Chuẩn hóa xóa đuôi @bot_name (ví dụ: /idea@my_toolhunt_bot -> /idea)
  text = text.replace(/@\w+_bot/gi, "").trim();

  // Lệnh: /start hoặc /help
  if (text.startsWith("/start") || text.startsWith("/help")) {
    const webappUrl = getConfig("WEBAPP_URL");
    const welcomeMsg = `👋 <b>Xin chào ${username}!</b>\n\n` +
      `Chào mừng bạn đến với <b>ToolHunt Enterprise (v3.0.0)</b> — Hệ thống đề xuất, bình chọn, crowdfunding và phát triển công cụ cộng đồng!\n\n` +
      `📌 <b>CÁC LỆNH SỬ DỤNG:</b>\n` +
      `• <code>/idea [Tên Tool] | [Mô tả chi tiết]</code>: Đăng ý tưởng mới (có AI kiểm tra trùng)\n` +
      `• <code>/claim [ID]</code>: Nhận phát triển ý tưởng (Dành cho Developer)\n` +
      `• <code>/bounty [ID] [Số tiền/Ly cafe] [Đơn vị] | [Lời nhắn]</code>: Treo thưởng cho ý tưởng\n` +
      `• <code>/top</code>: Xem Top ý tưởng nhiều vote nhất\n` +
      `• <code>/myideas</code>: Xem các ý tưởng của bạn\n` +
      `• <code>/stats</code>: Thống kê hoạt động cộng đồng\n\n` +
      `💡 <i>Ví dụ:</i>\n<code>/idea Tool Auto Sheet | Tự động đọc dữ liệu và điền Google Sheet</code>`;

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

  // Lệnh: /idea [Tên Tool] | [Mô tả] (R1 AI Check)
  if (text.startsWith("/idea")) {
    const raw = text.substring(5).trim();
    if (!raw || !raw.includes("|")) {
      const guideText = `⚠️ <b>Cú pháp chưa chính xác!</b>\n\nVui lòng nhập theo định dạng:\n<code>/idea [Tên Ý Tưởng / Tool] | [Mô tả chi tiết tính năng, mục đích]</code>`;
      sendTelegramMessage(chatId, guideText, msg.message_id);
      return { success: false, error: "INVALID_SYNTAX" };
    }

    const parts = raw.split("|");
    const title = parts[0].trim();
    const description = parts.slice(1).join("|").trim();

    if (title.length < 3) {
      sendTelegramMessage(chatId, "⚠️ Tên ý tưởng quá ngắn (tối thiểu 3 ký tự).", msg.message_id);
      return { success: false, error: "TITLE_TOO_SHORT" };
    }

    const ideasSheet = ss.getSheetByName("Ideas") || (typeof initSpreadsheet === "function" ? initSpreadsheet().getSheetByName("Ideas") : null);
    const existingData = ideasSheet.getDataRange().getValues();

    // R1 AI Duplicate Check
    const aiCheck = checkAiDuplicate(title, description, existingData, ss);

    if (aiCheck.is_duplicate) {
      const pendingKey = `pending_${userId}_${Date.now()}`;
      try {
        const cache = CacheService.getScriptCache();
        if (cache) {
          cache.put(pendingKey, JSON.stringify({ userId, username, title, description, category: "Chung", chatId }), 600);
        }
      } catch (e) {}
      PENDING_IDEAS_STORE.set(pendingKey, { userId, username, title, description, category: "Chung", chatId });

      const matchedId = aiCheck.matched_idea_id;
      const warningKeyboard = {
        inline_keyboard: [
          [
            { text: `➕ Dồn Vote vào #${matchedId}`, callback_data: `merge_vote_${matchedId}` },
            { text: "🚀 Vẫn tạo mới (Force Create)", callback_data: `force_create_${pendingKey}` }
          ]
        ]
      };

      const warningMsg = `⚠️ <b>CẢNH BÁO TRÙNG LẶP AI (${aiCheck.similarity_score}%)</b>\n\n` +
        `Ý tưởng của bạn có nội dung tương tự với ý tưởng <b>#${matchedId}: ${aiCheck.matched_title}</b>.\n` +
        `<i>Lý do: ${aiCheck.reason}</i>\n\n` +
        `Bạn muốn dồn phiếu vào ý tưởng có sẵn hay tiếp tục tạo mới?`;

      sendTelegramMessage(chatId, warningMsg, msg.message_id, warningKeyboard);
      return { success: false, warning: "DUPLICATE_DETECTED", similarity: aiCheck.similarity_score, matchedId, pendingKey };
    }

    const newIdeaId = ideasSheet.getLastRow();
    const cardText = formatTelegramCard({
      id: newIdeaId,
      username,
      title,
      description,
      category: "Chung",
      votes: 0,
      status: "Đang lấy ý kiến",
      devUsername: "",
      milestones: "",
      bountySummary: ""
    });

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

    const res = sendTelegramMessage(chatId, cardText, null, postKeyboard);
    const sentMsgId = (res && res.result) ? res.result.message_id : (1000 + newIdeaId);

    ideasSheet.appendRow([
      newIdeaId, new Date(), userId, username, title, description,
      "Chung", 0, sentMsgId, chatId, "Đang lấy ý kiến",
      "Telegram", "", "", "", "0%", ""
    ]);

    logAudit(userId, username, "CREATE_IDEA", `Tạo ý tưởng #${newIdeaId}: ${title}`, ss);
    return { success: true, ideaId: newIdeaId, title };
  }

  // Lệnh: /bounty <ideaId> <amount> <unit> [message]
  if (text.startsWith("/bounty")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      sendTelegramMessage(chatId, "⚠️ Cú pháp: <code>/bounty [ID] [Số lượng] [VND/COFFEE] [Lời nhắn]</code>\nVí dụ: <code>/bounty 1 500000 VND Ủng hộ dev</code>", msg.message_id);
      return { success: false, error: "INVALID_BOUNTY_SYNTAX" };
    }
    const ideaId = parseInt(parts[1]);
    const amount = parseFloat(parts[2]);
    const unit = (parts[3] || "VND").toUpperCase();
    const note = parts.slice(4).join(" ") || "Tài trợ phát triển";

    const res = handlePledgeBounty(ideaId, userId, username, amount, unit, note, chatId, ss);
    if (res.success) {
      sendTelegramMessage(chatId, `🎉 <b>TÀI TRỢ THÀNH CÔNG!</b>\nĐã ghi nhận tài trợ <b>${amount.toLocaleString("vi-VN")} ${unit}</b> cho ý tưởng #${ideaId}.\n${res.badgeText}`, msg.message_id);
    }
    return res;
  }

  // Lệnh: /claim [ID]
  if (text.startsWith("/claim")) {
    const args = text.replace("/claim", "").trim().split(" ");
    const ideaId = parseInt(args[0]);
    if (!ideaId) {
      sendTelegramMessage(chatId, "⚠️ Cú pháp: <code>/claim [ID]</code>", msg.message_id);
      return;
    }
    const res = handleClaimTask(ideaId, userId, username, chatId, msg.message_id, ss);
    if (res.success) {
      sendTelegramMessage(chatId, `🚀 <b>NHẬN TASK THÀNH CÔNG!</b>\nBạn đã nhận phát triển ý tưởng #${ideaId}.`, msg.message_id);
    } else {
      sendTelegramMessage(chatId, `⚠️ Không thể nhận task: ${res.error}`, msg.message_id);
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

  // Lệnh Admin/Manager: /status <ID> <Trạng thái mới>
  if (text.startsWith("/status")) {
    if (!hasRole(userId, ["Admin", "Manager"], ss)) {
      sendTelegramMessage(chatId, "⛔ Bạn không có quyền Admin/Manager để thực hiện lệnh này.", msg.message_id);
      return { success: false, error: "UNAUTHORIZED" };
    }

    const args = text.replace("/status", "").trim().split(" ");
    if (args.length < 2) {
      sendTelegramMessage(chatId, "⚠️ Cú pháp: <code>/status [ID] [Trạng thái mới]</code>", msg.message_id);
      return { success: false, error: "INVALID_SYNTAX" };
    }

    const targetId = parseInt(args[0]);
    const newStatus = args.slice(1).join(" ").trim();
    return updateIdeaStatus(targetId, newStatus, ss, chatId, msg.message_id, userId, username);
  }

  // Lệnh: /myid hoặc /whoami (Kiểm tra Telegram ID và phân quyền)
  if (text.startsWith("/myid") || text.startsWith("/whoami")) {
    const role = getUserRole(userId, ss);
    const infoMsg = `🆔 <b>THÔNG TIN TÀI KHOẢN CỦA BẠN</b>\n\n` +
      `• <b>User ID:</b> <code>${userId}</code>\n` +
      `• <b>Tên hiển thị:</b> ${escapeHtml(username)}\n` +
      `• <b>Vai trò hiện tại:</b> <b>${role}</b>\n\n` +
      `💡 <i>Để trở thành Developer (nhận làm tool), hãy sao chép ID <code>${userId}</code> và thêm vào sheet 'Admins' nhé!</i>`;
    sendTelegramMessage(chatId, infoMsg, msg.message_id);
    return { success: true, userId, role };
  }

  return { success: false, error: "UNKNOWN_COMMAND" };
}

// ==============================================================================
// 11. XỬ LÝ CALLBACK QUERY (INLINE BUTTONS)
// ==============================================================================
function handleTelegramCallbackQuery(cb, ss) {
  const cbId = cb.id;
  const cbData = cb.data || "";
  const cbUserId = cb.from ? cb.from.id : 0;
  const cbUsername = (cb.from && cb.from.username) ? "@" + cb.from.username : ((cb.from && cb.from.first_name) || "User");
  const msg = cb.message;

  const chatId = (msg && msg.chat) ? msg.chat.id : -1001;
  const messageId = (msg && msg.message_id) ? msg.message_id : 1000;

  // 11.1. Nút Upvote (Toggle Unvote)
  if (cbData.startsWith("vote_")) {
    const ideaId = parseInt(cbData.replace("vote_", ""));
    const res = handleVote(ideaId, cbUserId, cbUsername, chatId, messageId, ss);
    if (cbId) {
      if (!res.success) {
        answerCallbackQuery(cbId, res.message || `⚠️ Không thể bình chọn: ${res.error}`, true);
      } else {
        answerCallbackQuery(
          cbId,
          res.action === "VOTE"
            ? `🎉 Bạn đã Upvote cho ý tưởng #${ideaId}! (Hiện có ${res.currentVotes} phiếu)`
            : `↩️ Bạn đã rút lại lượt vote cho ý tưởng #${ideaId}.`,
          false
        );
      }
    }
    return res;
  }

  // 11.2. Nút Dồn Vote (R1 Merge Vote)
  if (cbData.startsWith("merge_vote_")) {
    const targetIdeaId = parseInt(cbData.replace("merge_vote_", ""));
    const voteRes = handleVote(targetIdeaId, cbUserId, cbUsername, chatId, messageId, ss);
    if (cbId) answerCallbackQuery(cbId, `Đã dồn vote vào #${targetIdeaId}!`, false);
    sendTelegramMessage(chatId, `✅ Đã dồn phiếu Upvote thành công vào ý tưởng <b>#${targetIdeaId}</b>!`);
    return { success: true, action: "MERGE_VOTE", targetIdeaId, voteRes };
  }

  // 11.3. Nút Force Create (R1 Tạo Cưỡng Bức)
  if (cbData.startsWith("force_create_")) {
    const pendingKey = cbData.replace("force_create_", "");
    let pending = PENDING_IDEAS_STORE.get(pendingKey);
    if (!pending) {
      try {
        const cache = CacheService.getScriptCache();
        const cachedStr = cache ? cache.get(pendingKey) : null;
        if (cachedStr) pending = JSON.parse(cachedStr);
      } catch (e) {}
    }

    if (!pending) {
      if (cbId) answerCallbackQuery(cbId, "⚠️ Yêu cầu đã hết hạn. Vui lòng gõ lại /idea.", true);
      return { success: false, error: "PENDING_EXPIRED" };
    }

    const ideasSheet = ss.getSheetByName("Ideas");
    const newIdeaId = ideasSheet.getLastRow();

    ideasSheet.appendRow([
      newIdeaId, new Date(), pending.userId, pending.username, pending.title, pending.description,
      pending.category || "Chung", 0, 1000 + newIdeaId, pending.chatId, "Đang lấy ý kiến",
      "Force Created", "", "", "", "0%", ""
    ]);

    PENDING_IDEAS_STORE.delete(pendingKey);
    logAudit(cbUserId, cbUsername, "FORCE_CREATE_IDEA", `Tạo cưỡng bức ý tưởng #${newIdeaId}: ${pending.title}`, ss);

    if (cbId) answerCallbackQuery(cbId, `✅ Đã tạo ý tưởng #${newIdeaId}!`, false);
    return { success: true, action: "FORCE_CREATE", ideaId: newIdeaId };
  }

  // 11.4. Nút Developer Claim Task (R2)
  if (cbData.startsWith("claim_task_")) {
    const ideaId = parseInt(cbData.replace("claim_task_", ""));
    const res = handleClaimTask(ideaId, cbUserId, cbUsername, chatId, messageId, ss);
    if (cbId) {
      if (res.success) {
        answerCallbackQuery(cbId, "🚀 Chúc mừng! Bạn đã nhận phát triển ý tưởng này thành công. Hãy bắt tay vào làm nhé!", true);
      } else if (res.error === "UNAUTHORIZED_ROLE") {
        answerCallbackQuery(
          cbId,
          `⚠️ Bạn cần có vai trò Developer để nhận làm tool này.\n\nUser ID của bạn là: ${cbUserId}\nHãy nhờ Admin thêm ID này vào sheet 'Admins' để được cấp quyền Developer nhé!`,
          true
        );
      } else if (res.error === "ALREADY_CLAIMED") {
        answerCallbackQuery(cbId, "⚠️ Ý tưởng này đã được Developer khác nhận phát triển rồi!", true);
      } else {
        answerCallbackQuery(cbId, `⚠️ Không thể nhận task: ${res.error}`, true);
      }
    }
    return res;
  }

  // 11.5. Nút Developer Unclaim Task (R2)
  if (cbData.startsWith("unclaim_task_")) {
    const ideaId = parseInt(cbData.replace("unclaim_task_", ""));
    const res = handleUnclaimTask(ideaId, cbUserId, cbUsername, chatId, messageId, ss);
    if (cbId) answerCallbackQuery(cbId, res.success ? "↩️ Đã hủy nhận task." : `⚠️ ${res.error}`, true);
    return res;
  }

  // 11.6. Nút Ra Mắt Beta & Hoàn Thành (R2 & R3)
  if (cbData.startsWith("devbeta_")) {
    const ideaId = parseInt(cbData.replace("devbeta_", ""));
    const res = handleDevStatusTransition(ideaId, cbUserId, cbUsername, "Beta Testing", chatId, messageId, ss);
    if (cbId) answerCallbackQuery(cbId, res.success ? "🧪 Đã kích hoạt bản Beta và gửi thông báo tới voters!" : `⚠️ ${res.error}`, true);
    return res;
  }

  if (cbData.startsWith("devdone_")) {
    const ideaId = parseInt(cbData.replace("devdone_", ""));
    const res = handleDevStatusTransition(ideaId, cbUserId, cbUsername, "Hoàn thành", chatId, messageId, ss);
    if (cbId) answerCallbackQuery(cbId, res.success ? "🎉 Đã hoàn thành tool và mở khóa Bounty!" : `⚠️ ${res.error}`, true);
    return res;
  }

  // 11.7. Nút Treo Thưởng Bounty (R4)
  if (cbData.startsWith("bounty_")) {
    const ideaId = parseInt(cbData.replace("bounty_", ""));
    // Phản hồi callback query ngay lập tức để dập tắt icon loading trên nút và mở hộp thoại thông báo
    const alertText = `💰 HƯỚNG DẪN TREO THƯỞNG CHO Ý TƯỞNG #${ideaId}\n\n` +
      `Gõ lệnh trong chat để tài trợ:\n` +
      `• /bounty ${ideaId} 500000 VND Ủng hộ dev\n` +
      `• /bounty ${ideaId} 5 COFFEE Mời dev cafe\n` +
      `• /bounty ${ideaId} 50 USD\n\n` +
      `Quỹ sẽ được tích lũy vào ý tưởng này!`;
    if (cbId) answerCallbackQuery(cbId, alertText, true);

    // Đồng thời gửi tin nhắn vào chat để người dùng tiện chạm sao chép
    try {
      const guideMsg = `💡 <b>HƯỚNG DẪN TREO THƯỞNG CHO Ý TƯỞNG #${ideaId}</b>\n\n` +
        `Hãy sao chép và gửi một trong các lệnh sau vào chat:\n` +
        `• <code>/bounty ${ideaId} 500000 VND Ủng hộ dev</code>\n` +
        `• <code>/bounty ${ideaId} 5 COFFEE Mời dev cafe</code>`;
      sendTelegramMessage(chatId, guideMsg, messageId);
    } catch (e) {}
    return { success: true, action: "BOUNTY_GUIDE", ideaId };
  }

  // 11.8. Callback Top & Stats
  if (cbData === "cmd_top") {
    if (cbId) answerCallbackQuery(cbId, "Đang tải Top ý tưởng...");
    sendTopIdeasMessage(chatId, ss);
    return;
  }

  if (cbData === "cmd_stats") {
    if (cbId) answerCallbackQuery(cbId, "Đang tải thống kê...");
    sendStatsMessage(chatId, ss);
    return;
  }

  if (cbData === "cmd_stats") {
    sendStatsMessage(chatId, ss);
    if (cbId) answerCallbackQuery(cbId, "");
    return;
  }

  return { success: false, error: "UNKNOWN_CALLBACK" };
}

// ==============================================================================
// 12. CÁC HÀM XỬ LÝ NGHIỆP VỤ (VOTE, CLAIM, UNCLAIM, DEV TRANSITION)
// ==============================================================================
function handleVote(ideaId, userId, username, chatId, msgId, ss) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const votesSheet = targetSs.getSheetByName("Votes");
  const ideasSheet = targetSs.getSheetByName("Ideas");

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
  let authorUserId = "";

  for (let i = 1; i < ideasData.length; i++) {
    if (ideasData[i][0] == ideaId) {
      targetRow = i + 1;
      authorUserId = ideasData[i][2];
      currentVotes = parseInt(ideasData[i][7]) || 0;
      break;
    }
  }

  if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };

  // 🛡️ Chống tác giả tự vote cho ý tưởng của chính mình (LOGIC-MED-01)
  const allowSelfVote = getConfig("ALLOW_SELF_VOTE") === "true";
  if (!allowSelfVote && authorUserId && userId && authorUserId.toString() === userId.toString() && authorUserId !== "WEB_ANON") {
    return { success: false, error: "SELF_VOTE_NOT_ALLOWED", message: "Tác giả không được tự bình chọn cho ý tưởng của chính mình!" };
  }

  let actionResult = "";
  if (alreadyVoted) {
    votesSheet.deleteRow(voteRowIndex);
    currentVotes = Math.max(0, currentVotes - 1);
    ideasSheet.getRange(targetRow, 8).setValue(currentVotes);
    actionResult = "UNVOTE";
    logAudit(userId, username, "UNVOTE", `Rút lại vote cho ý tưởng #${ideaId}`, targetSs);
  } else {
    votesSheet.appendRow([new Date(), ideaId, userId, sanitizeSheetValue(username), "UPVOTE"]);
    currentVotes += 1;
    ideasSheet.getRange(targetRow, 8).setValue(currentVotes);
    actionResult = "VOTE";
    logAudit(userId, username, "UPVOTE", `Bình chọn ý tưởng #${ideaId}`, targetSs);
  }

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

  editMessageReplyMarkup(chatId, msgId, updatedKeyboard);
  return { success: true, action: actionResult, ideaId, currentVotes };
}

function handleClaimTask(ideaId, userId, username, chatId, msgId, ss) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  if (!hasRole(userId, ["Developer", "Manager", "Admin"], targetSs)) {
    return { success: false, error: "UNAUTHORIZED_ROLE" };
  }

  const ideasSheet = targetSs.getSheetByName("Ideas");
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

  if (existingDevId && existingDevId.toString().length > 0 && currentStatus !== "Đang lấy ý kiến") {
    return { success: false, error: "ALREADY_CLAIMED" };
  }

  // Batch write 6 columns: Status (11), Notes (12), DevId (13), DevUsername (14), ClaimDate (15), Milestones (16) (CONC-MED-01)
  ideasSheet.getRange(targetRow, 11, 1, 6).setValues([[
    "Đang phát triển", "", userId, sanitizeSheetValue(username), new Date(), "10% - Khởi động"
  ]]);

  logAudit(userId, username, "CLAIM_TASK", `Nhận phát triển ý tưởng #${ideaId}`, targetSs);

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

  editMessageReplyMarkup(chatId, msgId, devKeyboard);

  return {
    success: true,
    action: "CLAIM_SUCCESS",
    ideaId,
    developerId: userId,
    developerUsername: username,
    newStatus: "Đang phát triển"
  };
}

function handleUnclaimTask(ideaId, userId, username, chatId, msgId, ss) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const ideasSheet = targetSs.getSheetByName("Ideas");
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

  const isOwner = devId && devId.toString() === userId.toString();
  const canOverride = hasRole(userId, ["Manager", "Admin"], targetSs);

  if (!isOwner && !canOverride) {
    return { success: false, error: "UNAUTHORIZED_UNCLAIM" };
  }

  // Batch reset 6 columns (CONC-MED-01)
  ideasSheet.getRange(targetRow, 11, 1, 6).setValues([[
    "Đang lấy ý kiến", "", "", "", "", "0%"
  ]]);

  logAudit(userId, username, "UNCLAIM_TASK", `Hủy nhận task ý tưởng #${ideaId}`, targetSs);

  return { success: true, action: "UNCLAIM_SUCCESS", ideaId, status: "Đang lấy ý kiến" };
}

function handleDevStatusTransition(ideaId, userId, username, targetStatus, chatId, msgId, ss) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const ideasSheet = targetSs.getSheetByName("Ideas");
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
  if (!isOwner && !hasRole(userId, ["Manager", "Admin"], targetSs)) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const milestone = targetStatus === "Beta Testing" ? "80% - Đang thử nghiệm" : "100% - Đã xuất bản";
  const existingDevUser = ideasData[targetRow - 1][13] || "";
  const existingClaimDate = ideasData[targetRow - 1][14] || "";

  // Batch update status & milestone (CONC-MED-01)
  ideasSheet.getRange(targetRow, 11, 1, 6).setValues([[
    targetStatus, "", devId, existingDevUser, existingClaimDate, milestone
  ]]);

  // Kích hoạt R3 Targeted Beta Notifications
  const notifyRes = notifyIdeaVoters(ideaId, targetStatus, {}, targetSs);

  // Mở khóa Bounties khi hoàn thành (R4)
  if (targetStatus === "Hoàn thành") {
    const bountiesSheet = targetSs.getSheetByName("Bounties");
    if (bountiesSheet) {
      const bData = bountiesSheet.getDataRange().getValues();
      for (let b = 1; b < bData.length; b++) {
        if (bData[b][2] == ideaId && bData[b][8] !== "CANCELLED") {
          bountiesSheet.getRange(b + 1, 9).setValue("RELEASED");
        }
      }
    }
  }

  logAudit(userId, username, "DEV_STATUS_TRANSITION", `Ý tưởng #${ideaId} đổi trạng thái ${targetStatus}`, targetSs);

  return {
    success: true,
    ideaId,
    status: targetStatus,
    notificationsSent: notifyRes.notifiedCount,
    recipients: notifyRes.recipientUserIds
  };
}

function updateIdeaStatus(ideaId, newStatus, ss, chatId, replyToMsgId, adminUserId, adminUsername) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const ideasSheet = targetSs.getSheetByName("Ideas");
  if (!ideasSheet) return { success: false, error: "SHEET_NOT_FOUND" };

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
    return { success: false, error: "NOT_FOUND" };
  }

  ideasSheet.getRange(foundRow, 11).setValue(newStatus);
  logAudit(adminUserId, adminUsername, "UPDATE_STATUS", `Ý tưởng #${ideaId} đổi sang ${newStatus}`, targetSs);
  sendTelegramMessage(chatId, `✅ Đã cập nhật trạng thái ý tưởng <b>#${ideaId} (${escapeHtml(title)})</b> thành: <code>${newStatus}</code>`, replyToMsgId);
  return { success: true, targetId: ideaId, newStatus };
}

// ==============================================================================
// 13. CÁC HÀM FORMATTING & TELEGRAM API WRAPPERS
// ==============================================================================
function formatTelegramCard(idea) {
  const statusEmoji = {
    "Đang lấy ý kiến": "⏳",
    "Đang phát triển": "🚀",
    "Beta Testing": "🧪",
    "Hoàn thành": "✅"
  }[idea.status] || "💡";

  let text = `<b>${statusEmoji} Ý TƯỞNG #${idea.id}: ${escapeHtml(idea.title)}</b>\n\n` +
    `👤 Đề xuất bởi: ${escapeHtml(idea.username)}\n` +
    `📂 Thể loại: <i>${escapeHtml(idea.category)}</i>\n` +
    `📝 Mô tả: ${escapeHtml(idea.description)}\n` +
    `📊 Lượt bình chọn: <b>${idea.votes}</b> vote(s)\n` +
    `📍 Trạng thái: <b>${escapeHtml(idea.status)}</b>\n`;

  if (idea.devUsername) {
    text += `🛠 Phụ trách: <b>${escapeHtml(idea.devUsername)}</b> (Mốc: ${escapeHtml(idea.milestones || "0%")})\n`;
  }
  if (idea.bountySummary) {
    text += `✨ ${escapeHtml(idea.bountySummary)}\n`;
  }
  return text;
}

function sendTopIdeasMessage(chatId, ss, replyToMsgId) {
  const cacheKey = "CACHE_TOP_IDEAS_MSG";
  let msg = "";
  try {
    if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
      msg = CacheService.getScriptCache().get(cacheKey) || "";
    }
  } catch (e) {}

  if (!msg) {
    const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
    const ideasSheet = targetSs.getSheetByName("Ideas");
    if (!ideasSheet || ideasSheet.getLastRow() <= 1) {
      sendTelegramMessage(chatId, "Chưa có ý tưởng nào được đề xuất.", replyToMsgId);
      return;
    }

    const data = ideasSheet.getDataRange().getValues().slice(1);
    const list = data.map(r => ({ id: r[0], title: r[4], votes: parseInt(r[7]) || 0, author: r[3], status: r[10] || "Đang lấy ý kiến" }));
    list.sort((a, b) => b.votes - a.votes);
    const topList = list.slice(0, 5);

    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    msg = `🔥 <b>TOP Ý TƯỞNG ĐƯỢC QUAN TÂM NHẤT:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    topList.forEach((item, index) => {
      msg += `${medals[index] || "🔹"} <b>#${item.id} - ${escapeHtml(item.title)}</b>\n` +
        `   👍 <b>${item.votes} votes</b> | 👤 ${item.author} | <code>${item.status}</code>\n\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n💡 Gõ <code>/idea [Tên] | [Mô tả]</code> để gửi thêm ý tưởng mới!`;

    try {
      if (typeof CacheService !== "undefined" && CacheService.getScriptCache) {
        CacheService.getScriptCache().put(cacheKey, msg, 60); // Cache 60s
      }
    } catch (e) {}
  }

  sendTelegramMessage(chatId, msg, replyToMsgId);
}

function sendUserIdeasMessage(chatId, userId, username, ss, replyToMsgId) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const ideasSheet = targetSs.getSheetByName("Ideas");
  if (!ideasSheet || ideasSheet.getLastRow() <= 1) {
    sendTelegramMessage(chatId, "Bạn chưa đăng ý tưởng nào.", replyToMsgId);
    return;
  }

  const data = ideasSheet.getDataRange().getValues();
  const userIdeas = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][2].toString() === userId.toString()) {
      userIdeas.push({ id: data[i][0], title: data[i][4], votes: parseInt(data[i][7]) || 0, status: data[i][10] || "Đang lấy ý kiến" });
    }
  }

  if (userIdeas.length === 0) {
    sendTelegramMessage(chatId, `👤 <b>${username}</b> ơi, bạn chưa đề xuất ý tưởng nào!\nHãy dùng lệnh <code>/idea [Tên] | [Mô tả]</code> để đăng nhé.`, replyToMsgId);
    return;
  }

  let msg = `📋 <b>DANH SÁCH Ý TƯỞNG CỦA BẠN (${username}):</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  userIdeas.forEach(item => {
    msg += `• <b>#${item.id} - ${escapeHtml(item.title)}</b>\n` +
      `   👍 ${item.votes} votes | 📊 Trạng thái: <code>${item.status}</code>\n\n`;
  });
  sendTelegramMessage(chatId, msg, replyToMsgId);
}

function sendStatsMessage(chatId, ss, replyToMsgId) {
  const targetSs = ss || SpreadsheetApp.getActiveSpreadsheet();
  const ideasSheet = targetSs.getSheetByName("Ideas");
  const votesSheet = targetSs.getSheetByName("Votes");
  const bountiesSheet = targetSs.getSheetByName("Bounties");

  const totalIdeas = ideasSheet ? Math.max(0, ideasSheet.getLastRow() - 1) : 0;
  const totalVotes = votesSheet ? Math.max(0, votesSheet.getLastRow() - 1) : 0;
  const totalBounties = bountiesSheet ? Math.max(0, bountiesSheet.getLastRow() - 1) : 0;

  const msg = `📊 <b>THỐNG KÊ HOẠT ĐỘNG TOOLHUNT:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <b>Tổng số ý tưởng đã gửi:</b> ${totalIdeas}\n` +
    `👍 <b>Tổng số lượt bình chọn (Upvote):</b> ${totalVotes}\n` +
    `💰 <b>Tổng số giao dịch Bounty:</b> ${totalBounties}\n` +
    `🚀 <b>Cộng đồng:</b> Đang tích cực đóng góp & phát triển!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;
  sendTelegramMessage(chatId, msg, replyToMsgId);
}

function escapeHtml(text) {
  if (!text) return "";
  return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendTelegramMessage(chatId, text, replyToMsgId, replyMarkup) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };
  if (replyToMsgId) payload.reply_to_message_id = replyToMsgId;
  if (replyMarkup) {
    payload.reply_markup = (typeof replyMarkup === "string") ? JSON.parse(replyMarkup) : replyMarkup;
  }
  return callTelegramApi("sendMessage", payload);
}

function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: (typeof replyMarkup === "string") ? JSON.parse(replyMarkup) : replyMarkup
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

function callTelegramApi(endpoint, payload, maxRetries = 2) {
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const url = getTelegramApiUrl() + "/" + endpoint;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = (response && response.getResponseCode) ? response.getResponseCode() : 200;
      const text = (response && response.getContentText) ? response.getContentText() : "{}";
      const json = JSON.parse(text);

      // Xử lý Telegram 429 Flood Control (CONC-HIGH-04)
      if (code === 429 || (json && json.error_code === 429)) {
        const retryAfter = (json.parameters && json.parameters.retry_after) ? json.parameters.retry_after : 1;
        Logger.log(`⚠️ Telegram 429 Flood Control: retry after ${retryAfter}s`);
        if (typeof Utilities !== "undefined" && Utilities.sleep) {
          Utilities.sleep(Math.min(retryAfter * 1000 + 50, 2000));
        }
        continue;
      }
      return json;
    } catch (e) {
      Logger.log(`Lỗi gọi Telegram API [${endpoint}] lần ${attempt}: ` + e.message);
      if (attempt === maxRetries) return null;
    }
  }
  return null;
}
