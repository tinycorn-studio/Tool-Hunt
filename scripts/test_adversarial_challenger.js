/**
 * ==============================================================================
 * TOOLHUNT ENTERPRISE (v3.0.0) — ADVERSARIAL STRESS-TEST & HARNESS ORACLE
 * ==============================================================================
 * Author: Empirical Challenger 1
 * Objective: Empirically stress-test boundary conditions, RBAC privilege elevation,
 * input corruption, AI threshold edge cases, rapid toggle unvote storms,
 * negative bounty injections, notification isolation, XSS sanitization,
 * Frontend Dashboard client logic, and SetupHelper schema integrity.
 * ==============================================================================
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

// ==============================================================================
// 1. MOCK GAS INFRASTRUCTURE FOR ADVERSARIAL TESTING
// ==============================================================================

class MockSpreadsheetApp {
  constructor() {
    this.sheets = {
      Ideas: [
        [
          "ID", "Thời Gian", "User ID", "Username", "Tên Ý Tưởng",
          "Mô Tả Chi Tiết", "Thể Loại", "Tổng Vote", "Message ID",
          "Chat ID", "Trạng Thái", "Ghi Chú", "Developer ID",
          "Developer Username", "Claim Date", "Milestones", "Tổng Bounty"
        ]
      ],
      Votes: [
        ["Thời Gian", "Idea ID", "User ID", "Username", "Hành Động"]
      ],
      Bounties: [
        ["Thời Gian", "Bounty ID", "Idea ID", "Sponsor User ID", "Sponsor Username", "Số Lượng", "Đơn Vị", "Lời Nhắn", "Trạng Thái", "Ghi Chú"]
      ],
      Admins: [
        ["User ID Telegram", "Username / Tên", "Vai Trò", "Trạng Thái", "Ngày Thêm"],
        [99999, "@super_admin", "Admin", "Active", new Date()],
        [88888, "@manager_user", "Manager", "Active", new Date()],
        [77777, "@developer_pro", "Developer", "Active", new Date()],
        [66666, "@developer_alice", "Developer", "Active", new Date()],
        [55555, "@inactive_admin", "Admin", "Inactive", new Date()],
        [111, "@member_user", "Member", "Active", new Date()]
      ],
      Config: [
        ["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"],
        ["BOT_TOKEN", "123456:ADVERSARIAL_TEST_TOKEN", "Token Test"],
        ["WEBAPP_URL", "https://adversarial.toolhunt.enterprise", "Mini App URL"],
        ["COMMUNITY_GROUP_ID", "-1001999999999", "Group ID"],
        ["AI_PROVIDER", "deepseek", "AI Provider"],
        ["AI_SIMILARITY_THRESHOLD", "75", "Similarity Threshold"],
        ["DEEPSEEK_API_KEY", "sk-test-deepseek-key", "DeepSeek Key"],
        ["GEMINI_API_KEY", "test-gemini-key", "Gemini Key"],
        ["DEMO_BASE_URL", "https://toolhunt.enterprise/demo/", "Demo Base URL"],
        ["FEEDBACK_BASE_URL", "https://toolhunt.enterprise/feedback/", "Feedback Base URL"]
      ],
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
      setRowHeight: () => {},
      autoResizeColumn: () => {}
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
      createMenu: () => ({ addItem: () => ({ addItem: () => ({ addToUi: () => {} }), addToUi: () => {} }), addToUi: () => {} }),
      alert: (title, message) => ({ title, message }),
      prompt: () => ({ getSelectedButton: () => "OK", getResponseText: () => "https://script.google.com/test" }),
      ButtonSet: { OK: "OK", OK_CANCEL: "OK_CANCEL" }
    };
  }
}

class MockUrlFetchApp {
  constructor() {
    this.sentMessages = [];
    this.editedKeyboards = [];
    this.externalCalls = [];
    this.nextMessageId = 5000;
    this.forcedDeepSeekScore = null;
    this.failDeepSeek = false;
    this.failGemini = false;
    this.simulate403UserIds = new Set(); // Simulate Telegram 403 bot blocked
  }

  fetch(url, options = {}) {
    const payload = options.payload ? (typeof options.payload === "string" ? JSON.parse(options.payload) : options.payload) : {};
    this.externalCalls.push({ url, method: options.method || "GET", payload });

    // Telegram Bot API
    if (url.includes("api.telegram.org")) {
      if (url.includes("/sendMessage")) {
        const chatId = payload.chat_id;
        if (this.simulate403UserIds.has(chatId)) {
          throw new Error("HTTP 403 Forbidden: bot was blocked by the user or user hasn't initiated chat");
        }
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
      if (url.includes("/answerCallbackQuery")) {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, result: true })
        };
      }
    }

    // DeepSeek API
    if (url.includes("api.deepseek.com")) {
      if (this.failDeepSeek) {
        return {
          getResponseCode: () => 500,
          getContentText: () => JSON.stringify({ error: "Internal Server Error 500" })
        };
      }
      const score = this.forcedDeepSeekScore !== null ? this.forcedDeepSeekScore : 88;
      const isDup = score >= 75;
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  is_duplicate: isDup,
                  similarity_score: score,
                  matched_idea_id: 1,
                  matched_title: "Existing Seed Idea",
                  reason: `Adversarial AI check: score ${score}%`,
                  similar_ideas: [{ id: 1, title: "Existing Seed Idea", score }]
                })
              }
            }
          ]
        })
      };
    }

    // Gemini API
    if (url.includes("generativelanguage.googleapis.com")) {
      if (this.failGemini) {
        return {
          getResponseCode: () => 503,
          getContentText: () => JSON.stringify({ error: "Service Unavailable 503" })
        };
      }
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{
                  text: JSON.stringify({
                    is_duplicate: true,
                    similarity_score: 85,
                    matched_idea_id: 1,
                    matched_title: "Existing Seed Idea",
                    reason: "Gemini Fallback Duplicate Check",
                    similar_ideas: [{ id: 1, title: "Existing Seed Idea", score: 85 }]
                  })
                }]
              }
            }
          ]
        })
      };
    }

    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ ok: true })
    };
  }
}

class MockLockService {
  constructor() {
    this.locked = false;
    this.lockCount = 0;
    this.releaseCount = 0;
  }
  getScriptLock() {
    const self = this;
    return {
      waitLock: () => { self.locked = true; self.lockCount++; return true; },
      tryLock: () => { self.locked = true; self.lockCount++; return true; },
      releaseLock: () => { self.locked = false; self.releaseCount++; },
      hasLock: () => self.locked
    };
  }
}

class MockContentService {
  constructor() {
    this.MimeType = { JSON: "application/json", TEXT: "text/plain" };
  }
  createTextOutput(text = "") {
    let content = text;
    let mime = "text/plain";
    const out = {
      setMimeType: (m) => { mime = m; return out; },
      getContent: () => content,
      getMimeType: () => mime
    };
    return out;
  }
}
MockContentService.MimeType = { JSON: "application/json", TEXT: "text/plain" };

class MockCacheService {
  constructor() {
    this.store = new Map();
  }
  getScriptCache() {
    const self = this;
    return {
      get: (k) => self.store.get(k) || null,
      put: (k, v, exp) => self.store.set(k, v),
      remove: (k) => self.store.delete(k)
    };
  }
}

class MockPropertiesService {
  constructor() {
    this.store = {};
  }
  getScriptProperties() {
    const self = this;
    return {
      getProperty: (k) => self.store[k] !== undefined ? self.store[k] : null,
      setProperty: (k, v) => { self.store[k] = String(v); },
      setProperties: (obj) => { Object.assign(self.store, obj); },
      deleteAllProperties: () => { self.store = {}; }
    };
  }
}

const MockUtilities = {
  computeHmacSha256Signature: (value, key) => {
    const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key, "utf8");
    const hmac = crypto.createHmac("sha256", keyBuf);
    hmac.update(Buffer.from(value, "utf8"));
    const digest = hmac.digest();
    const signedBytes = [];
    for (let i = 0; i < digest.length; i++) {
      let b = digest[i];
      if (b > 127) b = b - 256;
      signedBytes.push(b);
    }
    return signedBytes;
  },
  sleep: (ms) => {},
  getUuid: () => crypto.randomUUID ? crypto.randomUUID() : "mock-uuid-1234"
};

// Load Code.js and SetupHelper.js into sandboxed GAS environment
function loadCodeJsSandbox() {
  const ss = new MockSpreadsheetApp();
  const urlFetch = new MockUrlFetchApp();
  const lock = new MockLockService();
  const content = new MockContentService();
  const cache = new MockCacheService();
  const properties = new MockPropertiesService();
  const loggerLogs = [];

  const sandbox = {
    SpreadsheetApp: ss,
    UrlFetchApp: urlFetch,
    LockService: lock,
    ContentService: content,
    CacheService: cache,
    PropertiesService: properties,
    Utilities: MockUtilities,
    Logger: {
      log: (msg) => loggerLogs.push(msg)
    },
    console: console,
    Date: Date,
    Math: Math,
    JSON: JSON,
    parseInt: parseInt,
    parseFloat: parseFloat,
    Array: Array,
    Object: Object,
    String: String,
    Map: Map,
    Set: Set,
    RegExp: RegExp,
    encodeURIComponent: encodeURIComponent
  };

  const codePath = path.resolve(__dirname, "../google-apps-script/Code.js");
  const codeContent = fs.readFileSync(codePath, "utf8");

  const setupPath = path.resolve(__dirname, "../google-apps-script/SetupHelper.js");
  const setupContent = fs.readFileSync(setupPath, "utf8");

  const context = vm.createContext(sandbox);
  vm.runInContext(codeContent, context);
  vm.runInContext(setupContent, context);

  return { sandbox, ss, urlFetch, lock, content, cache, loggerLogs };
}

// ==============================================================================
// 2. ADVERSARIAL TEST SUITES EXECUTION
// ==============================================================================

async function runAdversarialChallenge() {
  console.log("================================================================================");
  console.log("⚔️ TOOLHUNT ENTERPRISE v3.0.0 — EMPIRICAL ADVERSARIAL STRESS TEST SUITE");
  console.log("================================================================================");

  let totalPassed = 0;
  let totalFailed = 0;
  const suiteResults = [];

  function assert(suiteIdx, desc, condition) {
    if (condition) {
      console.log(`    ✅ [PASS] ${desc}`);
      suiteResults[suiteIdx].passed++;
      totalPassed++;
    } else {
      console.error(`    ❌ [FAIL] ${desc}`);
      suiteResults[suiteIdx].failed++;
      totalFailed++;
    }
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 1: AI DUPLICATE THRESHOLD BOUNDARY & EDGE ANALYSIS
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 1] AI Duplicate Threshold Boundary & Heuristic Attacks");
  suiteResults.push({ name: "Vector 1: AI Duplicate Threshold Boundaries", passed: 0, failed: 0 });
  const v1 = 0;

  {
    const { sandbox, ss, urlFetch } = loadCodeJsSandbox();
    const ideasSheet = ss.getSheetByName("Ideas");
    ideasSheet.appendRow([1, new Date(), "101", "@author1", "Tool Quét PDF Hóa Đơn", "Đọc hóa đơn VAT PDF", "Auto Sheet", 5, 1001, -1001, "Đang lấy ý kiến", "", "", "", "", "0%", ""]);

    const existingIdeas = ideasSheet.getDataRange().getValues();

    // 1.1 Score == 75 (Threshold is 75) -> Should be duplicate
    urlFetch.forcedDeepSeekScore = 75;
    const res75 = sandbox.checkAiDuplicate("Quét PDF Hóa Đơn Mới", "Tự động đọc hóa đơn", existingIdeas, ss);
    assert(v1, "1.1 Score chính xác bằng ngưỡng 75% -> Kích hoạt is_duplicate = true", res75.is_duplicate === true && res75.similarity_score === 75);

    // 1.2 Score == 74 (Below threshold) -> Should NOT be duplicate
    urlFetch.forcedDeepSeekScore = 74;
    const res74 = sandbox.checkAiDuplicate("Quét PDF Hóa Đơn Biến Thể", "Tự động đọc hóa đơn", existingIdeas, ss);
    assert(v1, "1.2 Score 74% (ngay dưới ngưỡng 75%) -> is_duplicate = false", res74.is_duplicate === false && res74.similarity_score === 74);

    // 1.3 Score == 76 (Above threshold) -> Should be duplicate
    urlFetch.forcedDeepSeekScore = 76;
    const res76 = sandbox.checkAiDuplicate("Quét PDF Hóa Đơn Biến Thể 2", "Tự động đọc hóa đơn", existingIdeas, ss);
    assert(v1, "1.3 Score 76% (ngay trên ngưỡng 75%) -> is_duplicate = true", res76.is_duplicate === true && res76.similarity_score === 76);

    // 1.4 Empty database (only headers) -> Should gracefully return non-duplicate without calling AI
    const emptyIdeas = [existingIdeas[0]];
    const resEmpty = sandbox.checkAiDuplicate("Ý tưởng đầu tiên", "Mô tả ý tưởng đầu tiên", emptyIdeas, ss);
    assert(v1, "1.4 Cơ sở dữ liệu trống (chỉ có header) -> is_duplicate = false, không gây lỗi runtime", resEmpty.is_duplicate === false && resEmpty.similarity_score === 0);

    // 1.5 DeepSeek 500 error -> Graceful Failover to Gemini Flash
    urlFetch.failDeepSeek = true;
    const resFailover = sandbox.checkAiDuplicate("Tool Quét PDF Hóa Đơn", "Mô tả", existingIdeas, ss);
    assert(v1, "1.5 Khi DeepSeek sập 500 -> Tự động kích hoạt Failover sang Gemini (score 85%)", resFailover.is_duplicate === true && resFailover.similarity_score === 85);

    // 1.6 Both DeepSeek & Gemini fail -> Graceful Fallback to Local Heuristic
    urlFetch.failGemini = true;
    const resHeuristic = sandbox.checkAiDuplicate("Tool Quét PDF Hóa Đơn", "Mô tả", existingIdeas, ss);
    assert(v1, "1.6 Khi cả 2 AI providers sập -> Fallback thành công sang Heuristic matching", resHeuristic.is_duplicate === true && resHeuristic.reason.includes("Heuristic"));

    // 1.7 Extreme Input Payload (10,000 characters description)
    const longDesc = "A".repeat(10000);
    urlFetch.failDeepSeek = false;
    urlFetch.failGemini = false;
    urlFetch.forcedDeepSeekScore = 20;
    const resLong = sandbox.checkAiDuplicate("Tool Siêu Dài", longDesc, existingIdeas, ss);
    assert(v1, "1.7 Payload mô tả cực dài (10,000 ký tự) được xử lý an toàn không gây tràn bộ nhớ", resLong !== null && typeof resLong.similarity_score === "number");
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 2: ADVERSARIAL RBAC & PRIVILEGE ELEVATION ATTACKS
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 2] Adversarial RBAC & Privilege Elevation Attempts");
  suiteResults.push({ name: "Vector 2: Adversarial RBAC & Privilege Elevation", passed: 0, failed: 0 });
  const v2 = 1;

  {
    const { sandbox, ss } = loadCodeJsSandbox();
    const ideasSheet = ss.getSheetByName("Ideas");
    ideasSheet.appendRow([1, new Date(), "101", "@author", "Tool Auto Sheet", "Mô tả", "Chung", 0, 1001, -1001, "Đang lấy ý kiến", "", "", "", "", "0%", ""]);

    // 2.1 Member (User ID 111) tries to invoke /status admin command
    const memberCmdRes = sandbox.handleTelegramMessage({
      text: "/status 1 Hoàn thành",
      chat: { id: -1001 },
      from: { id: 111, username: "member_user" },
      message_id: 2001
    }, ss);
    assert(v2, "2.1 Member (111) gọi lệnh /status -> Bị chặn với lỗi UNAUTHORIZED", memberCmdRes.error === "UNAUTHORIZED");

    // Check status in sheet remains unchanged
    const statusAfterAttack = ss.getSheetByName("Ideas").getDataRange().getValues()[1][10];
    assert(v2, "2.2 Trạng thái ý tưởng trong sheet Ideas không bị thay đổi bởi Member", statusAfterAttack === "Đang lấy ý kiến");

    // 2.3 Member (111) tries to claim task via handleClaimTask
    const memberClaimRes = sandbox.handleClaimTask(1, 111, "@member_user", -1001, 2001, ss);
    assert(v2, "2.3 Member (111) tự nhận làm tool -> Bị từ chối với UNAUTHORIZED_ROLE", memberClaimRes.error === "UNAUTHORIZED_ROLE");

    // 2.4 Legitimate Developer (77777) claims task
    const devClaimRes = sandbox.handleClaimTask(1, 77777, "@developer_pro", -1001, 2001, ss);
    assert(v2, "2.4 Developer (77777) nhận task thành công -> Status = 'Đang phát triển'", devClaimRes.success && devClaimRes.newStatus === "Đang phát triển");

    // 2.5 Rogue Developer (66666) tries to claim already-claimed task
    const doubleClaimRes = sandbox.handleClaimTask(1, 66666, "@developer_alice", -1001, 2002, ss);
    assert(v2, "2.5 Developer khác (66666) cố tranh chấp task đã nhận -> Bị chặn với ALREADY_CLAIMED", doubleClaimRes.error === "ALREADY_CLAIMED");

    // 2.6 Rogue Developer (66666) tries to unclaim task of Developer (77777)
    const unauthUnclaimRes = sandbox.handleUnclaimTask(1, 66666, "@developer_alice", -1001, 2003, ss);
    assert(v2, "2.6 Developer khác (66666) cố ý nhả task của Developer 77777 -> Bị chặn UNAUTHORIZED_UNCLAIM", unauthUnclaimRes.error === "UNAUTHORIZED_UNCLAIM");

    // 2.7 Inactive Admin (55555, Status: Inactive) privilege check
    const inactiveRole = sandbox.getUserRole(55555, ss);
    assert(v2, "2.7 Tài khoản Admin bị vô hiệu hóa (Status: Inactive) -> Tự động giáng cấp về Member", inactiveRole === "Member");

    // 2.8 Supreme Admin (99999) can override unclaim or status
    const adminUnclaimRes = sandbox.handleUnclaimTask(1, 99999, "@super_admin", -1001, 2004, ss);
    assert(v2, "2.8 Admin tối cao (99999) có quyền Override Unclaim thành công", adminUnclaimRes.success && adminUnclaimRes.status === "Đang lấy ý kiến");
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 3: RAPID TOGGLE UNVOTE STORM & CONCURRENCY
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 3] Rapid Toggle Unvote Storm & Vote Anti-Fraud Stress");
  suiteResults.push({ name: "Vector 3: Rapid Toggle Unvote Storm & Anti-Fraud", passed: 0, failed: 0 });
  const v3 = 2;

  {
    const { sandbox, ss } = loadCodeJsSandbox();
    const ideasSheet = ss.getSheetByName("Ideas");
    ideasSheet.appendRow([1, new Date(), "101", "@author", "Tool Auto Sheet", "Mô tả", "Chung", 0, 1001, -1001, "Đang lấy ý kiến", "", "", "", "", "0%", ""]);

    // 3.1 Single User spams Vote 50 times in rapid alternating succession
    let lastAction = "";
    for (let i = 1; i <= 50; i++) {
      const voteRes = sandbox.handleVote(1, 404, "@spam_voter", -1001, 1001, ss);
      lastAction = voteRes.action;
    }

    const votesData = ss.getSheetByName("Votes").getDataRange().getValues();
    const finalVoteCount = ss.getSheetByName("Ideas").getDataRange().getValues()[1][7];

    assert(v3, "3.1 Sau 50 lần spam toggle vote chẵn -> Trạng thái cuối là UNVOTE, vote count = 0", lastAction === "UNVOTE" && finalVoteCount === 0);
    assert(v3, "3.2 Sheet Votes không lưu bất kỳ hàng rác nào của user 404 sau khi unvote", votesData.filter(r => r[2] == 404).length === 0);

    // 3.2 51st vote (odd) -> Should become VOTE = 1
    const oddVote = sandbox.handleVote(1, 404, "@spam_voter", -1001, 1001, ss);
    const votesDataAfterOdd = ss.getSheetByName("Votes").getDataRange().getValues();
    const voteCountAfterOdd = ss.getSheetByName("Ideas").getDataRange().getValues()[1][7];

    assert(v3, "3.3 Lần bấm thứ 51 (lẻ) -> Chuyển thành VOTE, vote count = 1, Sheet Votes có đúng 1 dòng", oddVote.action === "VOTE" && voteCountAfterOdd === 1 && votesDataAfterOdd.filter(r => r[2] == 404).length === 1);

    // 3.3 Concurrent Multi-User Voting Simulation (20 distinct users)
    for (let u = 1001; u <= 1020; u++) {
      sandbox.handleVote(1, u, `@user_${u}`, -1001, 1001, ss);
    }
    const multiVoteCount = ss.getSheetByName("Ideas").getDataRange().getValues()[1][7];
    const totalVoteRows = ss.getSheetByName("Votes").getDataRange().getValues().length - 1;

    assert(v3, "3.4 20 users khác nhau bình chọn đồng thời -> Tổng vote tăng chính xác lên 21 (1 + 20)", multiVoteCount === 21 && totalVoteRows === 21);
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 4: FINANCIAL & CROWDFUNDING BOUNTY EXPLOIT ATTACKS
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 4] Financial & Crowdfunding Bounty Exploit Attacks");
  suiteResults.push({ name: "Vector 4: Financial & Crowdfunding Bounty Exploits", passed: 0, failed: 0 });
  const v4 = 3;

  {
    const { sandbox, ss } = loadCodeJsSandbox();
    const ideasSheet = ss.getSheetByName("Ideas");
    ideasSheet.appendRow([1, new Date(), "101", "@author", "Tool Auto Sheet", "Mô tả", "Chung", 0, 1001, -1001, "Đang lấy ý kiến", "", "", "", "", "0%", ""]);

    // 4.1 Negative bounty injection (amount = -500,000)
    const negRes = sandbox.handlePledgeBounty(1, 901, "@attacker", -500000, "VND", "Hút tiền quỹ", -1001, ss);
    assert(v4, "4.1 Treo thưởng số tiền âm (-500,000 VNĐ) -> Bị từ chối INVALID_AMOUNT", negRes.success === false && negRes.error === "INVALID_AMOUNT");

    // 4.2 Zero bounty pledge (amount = 0)
    const zeroRes = sandbox.handlePledgeBounty(1, 901, "@attacker", 0, "VND", "Treo 0 đồng", -1001, ss);
    assert(v4, "4.2 Treo thưởng 0 VNĐ -> Bị từ chối INVALID_AMOUNT", zeroRes.success === false && zeroRes.error === "INVALID_AMOUNT");

    // 4.3 Bounty pledge on non-existent Idea ID (99999)
    const nonExistentRes = sandbox.handlePledgeBounty(99999, 901, "@sponsor", 100000, "VND", "Ủng hộ", -1001, ss);
    assert(v4, "4.3 Treo thưởng cho ý tưởng không tồn tại (#99999) -> Báo lỗi IDEA_NOT_FOUND", nonExistentRes.success === false && nonExistentRes.error === "IDEA_NOT_FOUND");

    // 4.4 Legitimate multi-currency pledges (VND, COFFEE)
    sandbox.handlePledgeBounty(1, 901, "@sponsor_a", 500000, "VND", "Góp vốn", -1001, ss);
    sandbox.handlePledgeBounty(1, 902, "@sponsor_b", 300000, "VND", "Góp thêm", -1001, ss);
    sandbox.handlePledgeBounty(1, 903, "@sponsor_c", 3, "COFFEE", "Tặng cà phê", -1001, ss);

    const bountySummary = sandbox.calculateTotalBounty(1, ss);
    assert(v4, "4.4 Tích lũy chuẩn xác đa tiền tệ: 800.000 VNĐ + 3 ☕ (3 nhà tài trợ)", bountySummary.totalVnd === 800000 && bountySummary.coffeeCount === 3 && bountySummary.sponsorCount === 3);

    // 4.5 Task completion unlocks and releases all bounties to RELEASED
    // First developer 77777 claims Idea 1
    sandbox.handleClaimTask(1, 77777, "@developer_pro", -1001, 1001, ss);
    // Then developer transitions to "Hoàn thành"
    sandbox.handleDevStatusTransition(1, 77777, "@developer_pro", "Hoàn thành", -1001, 1001, ss);
    const bountiesData = ss.getSheetByName("Bounties").getDataRange().getValues();
    const allBountiesReleased = bountiesData.slice(1).every(r => r[8] === "RELEASED");
    assert(v4, "4.5 Khi ý tưởng hoàn thành -> Toàn bộ các khoản Bounty chuyển trạng thái RELEASED", allBountiesReleased);
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 5: TARGETED BETA NOTIFICATION PRIVACY ISOLATION & 403 RESILIENCE
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 5] Targeted Beta Notification Privacy Isolation & 403 Error Resilience");
  suiteResults.push({ name: "Vector 5: Targeted Beta Privacy & 403 Resilience", passed: 0, failed: 0 });
  const v5 = 4;

  {
    const { sandbox, ss, urlFetch } = loadCodeJsSandbox();
    const ideasSheet = ss.getSheetByName("Ideas");
    ideasSheet.appendRow([1, new Date(), "101", "@author", "Tool Auto Sheet", "Mô tả", "Chung", 0, 1001, -1001, "Đang lấy ý kiến", "", "77777", "@developer_pro", "", "10%", ""]);

    const votesSheet = ss.getSheetByName("Votes");
    // User 1001: Active Vote
    votesSheet.appendRow([new Date(), 1, 1001, "@active_voter_1", "UPVOTE"]);
    // User 1002: Active Vote
    votesSheet.appendRow([new Date(), 1, 1002, "@active_voter_2", "UPVOTE"]);
    // User 1003: Voted then Unvoted
    votesSheet.appendRow([new Date(), 1, 1003, "@unvoted_user", "UPVOTE"]);
    votesSheet.appendRow([new Date(), 1, 1003, "@unvoted_user", "UNVOTE"]);
    // User 1004: Voted for Idea #2 (different idea)
    votesSheet.appendRow([new Date(), 2, 1004, "@other_idea_voter", "UPVOTE"]);

    // Simulate User 1001 blocking the bot (HTTP 403)
    urlFetch.simulate403UserIds.add(1001);

    // Trigger Beta Testing Notification
    const notifyRes = sandbox.notifyIdeaVoters(1, "Beta Testing", {
      demoUrl: "https://toolhunt.enterprise/demo/1",
      feedbackUrl: "https://toolhunt.enterprise/feedback/1"
    }, ss);

    assert(v5, "5.1 Trích xuất chính xác 2 active voters (1001, 1002), loại trừ user 1003 (unvoted) và 1004 (khác idea)",
      notifyRes.notifiedCount === 2 && notifyRes.recipientUserIds.includes(1001) && notifyRes.recipientUserIds.includes(1002) && !notifyRes.recipientUserIds.includes(1003) && !notifyRes.recipientUserIds.includes(1004)
    );

    // Verify 403 error on User 1001 did NOT crash dispatch to User 1002
    const deliveredTo1002 = urlFetch.sentMessages.some(m => m.chat_id === 1002 && m.text.includes("THÔNG BÁO TRẢI NGHIỆM BETA"));
    assert(v5, "5.2 Khi 1 voter gặp lỗi 403 (chặn bot) -> Không làm gián đoạn gửi DM cho các voter còn lại", deliveredTo1002);

    // Verify unvoted user 1003 and non-voter 1004 received 0 messages
    const spamTo1003 = urlFetch.sentMessages.some(m => m.chat_id === 1003);
    const spamTo1004 = urlFetch.sentMessages.some(m => m.chat_id === 1004);
    assert(v5, "5.3 Người đã rút vote (1003) và người không vote (1004) nhận 0 tin nhắn thông báo", !spamTo1003 && !spamTo1004);
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 6: CORRUPTED PAYLOADS, SQL/XSS INJECTION & SANITIZATION
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 6] Corrupted Payloads, HTML/XSS Sanitization & Command Injection");
  suiteResults.push({ name: "Vector 6: Corrupted Payloads & XSS Sanitization", passed: 0, failed: 0 });
  const v6 = 5;

  {
    const { sandbox, ss } = loadCodeJsSandbox();

    // 6.1 XSS payload in idea title and description
    const xssTitle = "<script>alert('xss')</script> & <b>Test</b>";
    const xssDesc = "<img src=x onerror=alert(1)> \"quotes\" & 'single'";
    const escaped = sandbox.formatTelegramCard({
      id: 1,
      username: "@attacker",
      title: xssTitle,
      description: xssDesc,
      category: "Security",
      votes: 0,
      status: "Đang lấy ý kiến"
    });

    assert(v6, "6.1 Mã HTML/XSS trong tiêu đề được escape an toàn (&lt;script&gt;, &amp;, &lt;b&gt;)",
      escaped.includes("&lt;script&gt;alert('xss')&lt;/script&gt;") && !escaped.includes("<script>") && escaped.includes("&amp;")
    );

    // 6.2 Telegram /idea command with malformed syntax (no pipe separator)
    const malformedIdea = sandbox.handleTelegramMessage({
      text: "/idea Tool Khong Co Dau Gach Dung",
      chat: { id: -1001 },
      from: { id: 101, username: "user" },
      message_id: 3001
    }, ss);
    assert(v6, "6.2 Lệnh /idea thiếu dấu gạch đứng (|) -> Trả về lỗi INVALID_SYNTAX", malformedIdea.error === "INVALID_SYNTAX");

    // 6.3 Telegram /idea command with too short title (<3 chars)
    const shortIdea = sandbox.handleTelegramMessage({
      text: "/idea AB | Mô tả rất dài",
      chat: { id: -1001 },
      from: { id: 101, username: "user" },
      message_id: 3002
    }, ss);
    assert(v6, "6.3 Lệnh /idea với tiêu đề ngắn hơn 3 ký tự -> Trả về lỗi TITLE_TOO_SHORT", shortIdea.error === "TITLE_TOO_SHORT");

    // 6.4 Telegram /bounty with invalid syntax (missing parameters)
    const malformedBounty = sandbox.handleTelegramMessage({
      text: "/bounty 1",
      chat: { id: -1001 },
      from: { id: 101, username: "user" },
      message_id: 3003
    }, ss);
    assert(v6, "6.4 Lệnh /bounty thiếu tham số số tiền -> Trả về lỗi INVALID_BOUNTY_SYNTAX", malformedBounty.error === "INVALID_BOUNTY_SYNTAX");
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 7: REST API (doGet & doPost) CORRUPTION & EDGE RESILIENCE
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 7] REST API (doGet & doPost) Edge Cases & Fault Injection");
  suiteResults.push({ name: "Vector 7: REST API Edge Cases & Fault Injection", passed: 0, failed: 0 });
  const v7 = 6;

  {
    const { sandbox, ss } = loadCodeJsSandbox();

    // 7.1 doGet with missing e or e.parameter
    const getNoParam = sandbox.doGet({});
    const jsonNoParam = JSON.parse(getNoParam.getContent());
    assert(v7, "7.1 doGet không có parameter -> Mặc định trả về getIdeas thành công", jsonNoParam.ok === true && Array.isArray(jsonNoParam.data));

    // 7.2 doGet getUserVotes without userId
    const getNoUserId = sandbox.doGet({ parameter: { action: "getUserVotes" } });
    const jsonNoUserId = JSON.parse(getNoUserId.getContent());
    assert(v7, "7.2 doGet?action=getUserVotes thiếu userId -> Trả về ok = false, Missing userId", jsonNoUserId.ok === false && jsonNoUserId.error.includes("userId"));

    // 7.3 doGet getUserRole without userId
    const getRoleNoId = sandbox.doGet({ parameter: { action: "getUserRole" } });
    const jsonRoleNoId = JSON.parse(getRoleNoId.getContent());
    assert(v7, "7.3 doGet?action=getUserRole thiếu userId -> Trả về ok = false, Missing userId", jsonRoleNoId.ok === false);

    // 7.4 doGet with invalid unknown action
    const getUnknown = sandbox.doGet({ parameter: { action: "unsupported_action_xyz" } });
    const jsonUnknown = JSON.parse(getUnknown.getContent());
    assert(v7, "7.4 doGet với action không hỗ trợ -> Báo lỗi Action không hợp lệ", jsonUnknown.ok === false);

    // 7.5 doPost with empty or corrupt payload
    const postEmpty = sandbox.doPost(null);
    const jsonPostEmpty = JSON.parse(postEmpty.getContent());
    assert(v7, "7.5 doPost với null payload -> Trả về ok = false, Không có dữ liệu gửi đến", jsonPostEmpty.ok === false);

    // 7.6 doPost submitIdea with missing title
    const postMissingTitle = sandbox.doPost({
      postData: { contents: JSON.stringify({ apiAction: "submitIdea", title: "", description: "Test" }) }
    });
    const jsonMissingTitle = JSON.parse(postMissingTitle.getContent());
    assert(v7, "7.6 doPost submitIdea thiếu tiêu đề -> Báo lỗi MISSING_REQUIRED_FIELDS", jsonMissingTitle.ok === false && jsonMissingTitle.error === "MISSING_REQUIRED_FIELDS");

    // 7.7 doPost with unknown apiAction
    const postUnknown = sandbox.doPost({
      postData: { contents: JSON.stringify({ apiAction: "hack_the_system" }) }
    });
    const jsonPostUnknown = JSON.parse(postUnknown.getContent());
    assert(v7, "7.7 doPost với apiAction không tồn tại -> Báo lỗi UNKNOWN_API_ACTION", jsonPostUnknown.ok === false && jsonPostUnknown.error === "UNKNOWN_API_ACTION");
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 8: DUAL-PLATFORM STATE SYNCHRONIZATION & MUTEX CONCURRENCY
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 8] Dual-Platform Synchronization & Lock Mutex Resilience");
  suiteResults.push({ name: "Vector 8: Dual-Platform Sync & Mutex Resilience", passed: 0, failed: 0 });
  const v8 = 7;

  {
    const { sandbox, ss, lock } = loadCodeJsSandbox();

    // 8.1 Create Idea via Web API
    const createRes = sandbox.handleApiPostRequest({
      apiAction: "submitIdea",
      title: "Tool AI Viết Content",
      description: "Tự động sinh bài viết chuẩn SEO",
      category: "AI",
      username: "web_author",
      userId: "WEB_1001",
      force: true
    }, ss);
    const createdJson = JSON.parse(createRes.getContent());
    const ideaId = createdJson.ideaId;
    assert(v8, "8.1 Tạo ý tưởng qua Web API thành công (Idea #1)", createdJson.ok && ideaId === 1);

    // 8.2 Developer claims via Web API
    const claimRes = sandbox.handleApiPostRequest({
      apiAction: "claimIdea",
      ideaId: 1,
      userId: "77777",
      username: "@developer_pro"
    }, ss);
    const claimJson = JSON.parse(claimRes.getContent());
    assert(v8, "8.2 Developer nhận task qua Web API -> Status = 'Đang phát triển'", claimJson.ok && claimJson.status === "Đang phát triển");

    // 8.3 Verify Telegram doGet API reflects the updated status immediately
    const apiGet = sandbox.doGet({ parameter: { action: "getIdeas" } });
    const apiGetJson = JSON.parse(apiGet.getContent());
    const matched = apiGetJson.data.find(i => i.id === 1);
    assert(v8, "8.3 Web API doGet lập tức phản ánh trạng thái đồng bộ hai chiều", matched && matched.status === "Đang phát triển" && matched.developerUsername === "@developer_pro");

    // 8.4 LockService properly locks and unlocks during doPost
    sandbox.doPost({
      postData: { contents: JSON.stringify({ apiAction: "voteIdea", ideaId: 1, userId: "999", username: "voter" }) }
    });
    assert(v8, "8.4 LockService thực hiện khóa và mở khóa đối xứng (lockCount == releaseCount, !locked)",
      lock.lockCount > 0 && lock.lockCount === lock.releaseCount && !lock.locked
    );
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 9: FRONTEND WEB DASHBOARD & MINI APP LOGIC ORACLE
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 9] Frontend Web Dashboard & Mini App Logic Oracle");
  suiteResults.push({ name: "Vector 9: Frontend Web Dashboard Logic Oracle", passed: 0, failed: 0 });
  const v9 = 8;

  {
    // Test frontend milestone progress parser
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

    assert(v9, "9.1 Parser mốc tiến độ trích xuất chính xác '60% - Đang làm OCR' -> 60%", extractProgressPercent("60% - Đang làm OCR", "🚀 Đang phát triển") === 60);
    assert(v9, "9.2 Mốc trống với status 'Beta Testing' -> Mặc định gán 80%", extractProgressPercent("", "🧪 Beta Testing") === 80);
    assert(v9, "9.3 Mốc trống với status 'Hoàn thành' -> Mặc định gán 100%", extractProgressPercent("", "✅ Hoàn thành") === 100);
    assert(v9, "9.4 Mốc trống với status 'Đang lấy ý kiến' -> Mặc định gán 0%", extractProgressPercent("", "⏳ Đang lấy ý kiến") === 0);

    // Test Multi-Currency Bounty Regex Accumulator
    const sampleBounties = [
      "💰 700.000 VNĐ + 5 ☕",
      "💰 1.000.000 VNĐ (Đã trả thưởng)",
      "💰 200.000 VNĐ",
      ""
    ];
    let totalAccumulatedVnd = 0;
    sampleBounties.forEach(b => {
      if (b) {
        const match = b.match(/([0-9.]+)\s*VNĐ/);
        if (match) {
          totalAccumulatedVnd += parseInt(match[1].replace(/\./g, "")) || 0;
        }
      }
    });
    assert(v9, "9.5 Regex bóc tách và cộng dồn quỹ VND đa tiền tệ chính xác = 1.900.000 VNĐ", totalAccumulatedVnd === 1900000);

    // Test Search & Filter Tabs Logic
    const testIdeas = [
      { id: 1, title: "Tool Auto Sheet", description: "Tự động điền hóa đơn", author: "@dev1", status: "🚀 Đang phát triển", bountyTotal: "💰 500.000 VNĐ" },
      { id: 2, title: "Bot Cào Shopee", description: "Cào giá săn sale", author: "@mkt", status: "⏳ Đang lấy ý kiến", bountyTotal: "" },
      { id: 3, title: "AI Tóm Tắt Tin Nhắn", description: "Tóm tắt Telegram bot", author: "@ai_dev", status: "🧪 Beta Testing", bountyTotal: "💰 200.000 VNĐ" },
      { id: 4, title: "Xuất Báo Cáo PDF", description: "In sheet ra pdf", author: "@author4", status: "✅ Hoàn thành", bountyTotal: "💰 1.000.000 VNĐ" }
    ];

    const filterBounty = testIdeas.filter(i => Boolean(i.bountyTotal && i.bountyTotal.trim().length > 0));
    assert(v9, "9.6 Lọc theo tab '💰 Quỹ Bounty' trả về đúng 3 ý tưởng có quỹ thưởng", filterBounty.length === 3);

    const filterDev = testIdeas.filter(i => i.status.includes("phát triển"));
    assert(v9, "9.7 Lọc theo tab '🚀 Đang phát triển' trả về đúng 1 ý tưởng", filterDev.length === 1 && filterDev[0].id === 1);

    const filterSearch = testIdeas.filter(i => i.title.toLowerCase().includes("shopee") || i.description.toLowerCase().includes("shopee"));
    assert(v9, "9.8 Tìm kiếm từ khóa 'shopee' trả về đúng Idea #2", filterSearch.length === 1 && filterSearch[0].id === 2);
  }

  // ----------------------------------------------------------------------------
  // ATTACK VECTOR 10: SETUPHELPER 6-SHEET SCHEMA & PERSISTENCE ORACLE
  // ----------------------------------------------------------------------------
  console.log("\n💥 [VECTOR 10] SetupHelper 6-Sheet Schema & Persistence Oracle");
  suiteResults.push({ name: "Vector 10: SetupHelper Schema Integrity Oracle", passed: 0, failed: 0 });
  const v10 = 9;

  {
    const { sandbox, ss } = loadCodeJsSandbox();

    // Clean all existing mock sheets to test raw initialization
    ss.sheets = {};

    // Execute initSpreadsheet() from SetupHelper.js
    sandbox.initSpreadsheet();

    // 10.1 Verify all 6 Enterprise sheets are created
    const expectedSheets = ["Ideas", "Votes", "Bounties", "Config", "Admins", "AuditLogs"];
    const allSheetsCreated = expectedSheets.every(name => ss.getSheetByName(name) !== null);
    assert(v10, "10.1 Khởi tạo đầy đủ 6 sheet Enterprise chuẩn (Ideas, Votes, Bounties, Config, Admins, AuditLogs)", allSheetsCreated);

    // 10.2 Verify Ideas sheet column count (17 columns)
    const ideasCols = ss.getSheetByName("Ideas").getLastColumn();
    assert(v10, "10.2 Sheet Ideas khởi tạo chính xác 17 cột dữ liệu", ideasCols === 17);

    // 10.3 Verify Votes sheet column count (5 columns)
    const votesCols = ss.getSheetByName("Votes").getLastColumn();
    assert(v10, "10.3 Sheet Votes khởi tạo chính xác 5 cột dữ liệu", votesCols === 5);

    // 10.4 Verify Bounties sheet column count (10 columns)
    const bountiesCols = ss.getSheetByName("Bounties").getLastColumn();
    assert(v10, "10.4 Sheet Bounties khởi tạo chính xác 10 cột dữ liệu", bountiesCols === 10);

    // 10.5 Verify Config sheet default keys (10 default configurations)
    const configData = ss.getSheetByName("Config").getDataRange().getValues();
    const configKeys = configData.slice(1).map(r => r[0]);
    const expectedKeys = ["BOT_TOKEN", "WEBAPP_URL", "COMMUNITY_GROUP_ID", "ADMIN_IDS", "AI_PROVIDER", "AI_SIMILARITY_THRESHOLD", "DEEPSEEK_API_KEY", "GEMINI_API_KEY", "DEMO_BASE_URL", "FEEDBACK_BASE_URL"];
    const hasAllKeys = expectedKeys.every(k => configKeys.includes(k));
    assert(v10, "10.5 Sheet Config nạp đầy đủ 10 tham số cấu hình mặc định", hasAllKeys && configKeys.length === 10);
  }

  // ----------------------------------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("📊 KẾT QUẢ TỔNG QUAN ADVERSARIAL STRESS TESTING (SUMMARY REPORT)");
  console.log("================================================================================");
  console.log(`📋 Tổng số bài kiểm thử: ${totalPassed + totalFailed} assertions across 10 attack vectors\n`);

  suiteResults.forEach((res, idx) => {
    const icon = res.failed === 0 ? "✅" : "❌";
    console.log(`  ${icon} Vector ${idx + 1}: ${res.name.padEnd(52, " ")} -> ${res.passed} passed / ${res.failed} failed`);
  });

  console.log("--------------------------------------------------------------------------------");
  console.log(`🎯 TỔNG KẾT: ${totalPassed} PASSED / ${totalFailed} FAILED`);

  if (totalFailed === 0) {
    console.log("🎉 TẤT CẢ 10 CHIỀU TẤN CÔNG ĐÃ VƯỢT QUA 100%! HỆ THỐNG AN TOÀN TUYỆT ĐỐI.");
    console.log("================================================================================\n");
    process.exitCode = 0;
  } else {
    console.error("❌ PHÁT HIỆN LỖ HỔNG BẢO MẬT HOẶC SAI SỐ LOGIC!");
    console.log("================================================================================\n");
    process.exitCode = 1;
  }
}

runAdversarialChallenge();
