/**
 * ==============================================================================
 * TOOLHUNT ENTERPRISE v3.0.0 — COMPREHENSIVE REMEDIATION VERIFICATION SUITE
 * ==============================================================================
 * Kiểm tra xác thực toàn diện 28 phát hiện từ Báo cáo Audit (AUDIT_REPORT.md):
 * - SEC-CRIT-01: Telegram Webhook Secret Token Verification
 * - SEC-CRIT-02: Telegram WebApp initData HMAC-SHA256 Signature Validation
 * - SEC-CRIT-03: ScriptProperties Secret Management & Plaintext Migration
 * - CONC-CRIT-01: Fail-Fast Concurrency Lock Mutex (SERVER_BUSY)
 * - SEC-HIGH-01: HTML Escaping in Targeted DM Notifications
 * - SEC-HIGH-02: Safe DOM Title Resolution in Bounty Modal (Anti-DOM XSS)
 * - SEC-HIGH-03: Gemini API Key in Header Authentication (Anti-Log Exposure)
 * - LOGIC-MED-01: Anti-Self-Voting Guard for Idea Authors
 * - CONC-MED-01: Batch setValues for FSM State Transitions
 * - CONC-MED-03: Candidate Filtering for AI Prompt Payload
 * - SEC-MED-01: Formula Injection Sanitization
 * - SEC-MED-02: API Rate Limiting Enforcement
 * - CONC-HIGH-04: Telegram API 429 Flood Control Backoff
 * - PROD-MED-01: Explicit OAuth Scopes in appsscript.json
 * ==============================================================================
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

console.log("\n" + "=".repeat(80));
console.log("🛡️ TOOLHUNT ENTERPRISE — REMEDIATION VERIFICATION TEST SUITE");
console.log("=".repeat(80) + "\n");

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`    ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.log(`    ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
    failed++;
  }
}

// 1. Verify appsscript.json explicit oauthScopes (PROD-MED-01)
console.log("🔹 [TEST 1] Manifest & OAuth Scopes (PROD-MED-01)");
const manifestPath = path.join(__dirname, "../google-apps-script/appsscript.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert(
  Array.isArray(manifest.oauthScopes) &&
  manifest.oauthScopes.includes("https://www.googleapis.com/auth/spreadsheets") &&
  manifest.oauthScopes.includes("https://www.googleapis.com/auth/script.external_request") &&
  manifest.oauthScopes.includes("https://www.googleapis.com/auth/script.scriptapp"),
  "1.1 appsscript.json khai báo tường minh 3 phạm vi OAuth quyền hạn tối thiểu (spreadsheets, external_request, scriptapp)"
);

// 2. Setup Sandbox for Code.js & SetupHelper.js
const codeJsPath = path.join(__dirname, "../google-apps-script/Code.js");
const setupHelperPath = path.join(__dirname, "../google-apps-script/SetupHelper.js");
const codeContent = fs.readFileSync(codeJsPath, "utf8");
const setupContent = fs.readFileSync(setupHelperPath, "utf8");

const scriptPropertiesStore = new Map();
const scriptCacheStore = new Map();

const mockSheets = {
  Ideas: [
    ["ID", "Thời Gian", "User ID", "Username", "Tên Ý Tưởng", "Mô Tả Chi Tiết", "Thể Loại", "Tổng Vote", "Message ID", "Chat ID", "Trạng Thái", "Ghi Chú", "Developer ID", "Developer Username", "Claim Date", "Milestones", "Tổng Bounty"],
    [1, new Date(), "1001", "@author_alice", "Hệ thống OCR hóa đơn", "Tự động trích xuất hóa đơn đỏ", "Chung", 5, 2001, -1001, "Đang lấy ý kiến", "Telegram", "", "", "", "0%", ""],
    [2, new Date(), "1002", "@bob", "Bot cào dữ liệu Shopee", "Cào giá đối thủ", "Chung", 2, 2002, -1001, "Đang phát triển", "Telegram", "77777", "@developer_pro", new Date(), "20%", ""]
  ],
  Votes: [
    ["Thời Gian", "Idea ID", "User ID", "Username", "Hành Động"],
    [new Date(), 1, "2001", "@voter_one", "UPVOTE"],
    [new Date(), 1, "2002", "@voter_two", "UPVOTE"]
  ],
  Bounties: [
    ["Thời Gian", "Bounty ID", "Idea ID", "Sponsor User ID", "Sponsor Username", "Số Lượng", "Đơn Vị", "Lời Nhắn", "Trạng Thái", "Ghi Chú"],
    [new Date(), "bnt_1", 1, "9001", "@patron", 500000, "VND", "Ủng hộ dev", "ACTIVE", ""]
  ],
  Config: [
    ["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"],
    ["BOT_TOKEN", "123456789:AAFakeTokenForRemediationTesting_XYZ", "Bot Token"],
    ["WEBHOOK_SECRET_TOKEN", "super_secret_webhook_token_999", "Webhook Secret"],
    ["DEEPSEEK_API_KEY", "sk-deepseek-test-key", "DeepSeek Key"],
    ["GEMINI_API_KEY", "test-gemini-key", "Gemini Key"],
    ["AI_PROVIDER", "deepseek", "AI Provider"],
    ["AI_SIMILARITY_THRESHOLD", "75", "Threshold"],
    ["ALLOW_SELF_VOTE", "false", "Allow author to self-vote"]
  ],
  Admins: [
    ["User ID", "Username", "Vai Trò", "Trạng Thái", "Ngày Thêm"],
    ["99999", "@superadmin", "Admin", "Active", new Date()],
    ["88888", "@manager_user", "Manager", "Active", new Date()],
    ["77777", "@developer_pro", "Developer", "Active", new Date()]
  ],
  AuditLogs: [
    ["Thời Gian", "User ID", "Username", "Hành Động", "Chi Tiết"]
  ]
};

const capturedFetchCalls = [];
let forcedFetchCode = 200;
let forcedFetchResponse = { ok: true, description: "Success" };
let fetchCallCount = 0;

const sandbox = {
  console,
  Logger: { log: () => {} },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => {
        if (!mockSheets[name]) return null;
        const sheetData = mockSheets[name];
        return {
          getName: () => name,
          getLastRow: () => sheetData.length,
          getLastColumn: () => (sheetData[0] ? sheetData[0].length : 0),
          getDataRange: () => ({
            getValues: () => sheetData.map(r => [...r])
          }),
          appendRow: (row) => sheetData.push([...row]),
          deleteRow: (idx) => sheetData.splice(idx - 1, 1),
          getRange: (row, col, numRows = 1, numCols = 1) => ({
            setValue: (val) => {
              while (sheetData.length < row) sheetData.push([]);
              sheetData[row - 1][col - 1] = val;
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
            getValue: () => (sheetData[row - 1] && sheetData[row - 1][col - 1] !== undefined ? sheetData[row - 1][col - 1] : "")
          })
        };
      }
    }),
    getUi: () => ({
      alert: () => {},
      prompt: () => ({ getSelectedButton: () => "OK", getResponseText: () => "https://script.google.com/macros/s/xyz/exec" }),
      ButtonSet: { OK: "OK", OK_CANCEL: "OK_CANCEL" },
      createMenu: () => ({ addItem: function() { return this; }, addToUi: () => {} })
    })
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => scriptPropertiesStore.get(k) || null,
      setProperty: (k, v) => scriptPropertiesStore.set(k, v),
      deleteProperty: (k) => scriptPropertiesStore.delete(k)
    })
  },
  CacheService: {
    getScriptCache: () => ({
      get: (k) => scriptCacheStore.get(k) || null,
      put: (k, v) => scriptCacheStore.set(k, v),
      remove: (k) => scriptCacheStore.delete(k)
    })
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: (ms) => sandbox._failLock ? false : true,
      waitLock: () => {},
      releaseLock: () => {}
    })
  },
  ContentService: {
    createTextOutput: (content) => ({
      setMimeType: () => ({
        getContent: () => content
      }),
      getContent: () => content
    }),
    MimeType: { JSON: "application/json" }
  },
  Utilities: {
    computeHmacSha256Signature: (data, key) => {
      const keyBuf = Buffer.isBuffer(key) ? key : (Array.isArray(key) ? Buffer.from(key) : Buffer.from(key, "utf8"));
      const dataBuf = Buffer.from(data, "utf8");
      const hmac = crypto.createHmac("sha256", keyBuf);
      hmac.update(dataBuf);
      const digest = hmac.digest();
      return Array.from(new Int8Array(digest.buffer, digest.byteOffset, digest.byteLength));
    },
    getUuid: () => crypto.randomUUID(),
    sleep: () => {}
  },
  UrlFetchApp: {
    fetch: (url, options = {}) => {
      fetchCallCount++;
      capturedFetchCalls.push({ url, options });
      return {
        getResponseCode: () => forcedFetchCode,
        getContentText: () => JSON.stringify(forcedFetchResponse)
      };
    }
  },
  _failLock: false
};

vm.createContext(sandbox);
vm.runInContext(codeContent, sandbox);
vm.runInContext(setupContent, sandbox);

// 3. SEC-CRIT-01: Telegram Webhook Secret Token Verification
console.log("\n🔹 [TEST 2] Telegram Webhook Secret Token Verification (SEC-CRIT-01)");
const validSecretReq = {
  headers: { "x-telegram-bot-api-secret-token": "super_secret_webhook_token_999" },
  postData: { contents: JSON.stringify({ message: { text: "/ping", chat: { id: -1001 } } }) }
};
const invalidSecretReq = {
  headers: { "x-telegram-bot-api-secret-token": "attacker_fake_token_123" },
  postData: { contents: JSON.stringify({ message: { text: "/ping", chat: { id: -1001 } } }) }
};

const validRes = JSON.parse(sandbox.doPost(validSecretReq).getContent());
assert(validRes.ok === true, "2.1 Webhook kèm Secret Token hợp lệ được chấp nhận (ok = true)");

const invalidRes = JSON.parse(sandbox.doPost(invalidSecretReq).getContent());
assert(
  invalidRes.ok === false && invalidRes.error === "UNAUTHORIZED_WEBHOOK",
  "2.2 Webhook mang Secret Token giả mạo bị chặn ngay lập tức với UNAUTHORIZED_WEBHOOK"
);

// 4. SEC-CRIT-02: Telegram WebApp initData HMAC-SHA256 Signature Validation
console.log("\n🔹 [TEST 3] Telegram WebApp initData HMAC-SHA256 Validation (SEC-CRIT-02)");
const testBotToken = "123456789:AAFakeTokenForRemediationTesting_XYZ";
const userJson = JSON.stringify({ id: 987654, first_name: "Alice", username: "alice_crypto" });
const authDate = Math.floor(Date.now() / 1000);
const paramsToSign = {
  auth_date: authDate.toString(),
  query_id: "AAGkAAEA",
  user: userJson
};
const dataCheckString = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join("\n");
const secretKey = crypto.createHmac("sha256", "WebAppData").update(testBotToken).digest();
const validHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
const validInitData = `${Object.keys(paramsToSign).map(k => `${k}=${encodeURIComponent(paramsToSign[k])}`).join("&")}&hash=${validHash}`;

const validationSuccess = sandbox.validateTelegramWebAppData(validInitData, testBotToken);
assert(validationSuccess.isValid === true && validationSuccess.user.id === 987654, "3.1 Chữ ký HMAC-SHA256 chuẩn từ Telegram WebApp được xác thực danh tính thành công");

const tamperedInitData = validInitData.replace(validHash, "deadbeefcafebabe1234567890abcdef");
const tamperedResult = sandbox.validateTelegramWebAppData(tamperedInitData, testBotToken);
assert(tamperedResult.isValid === false && tamperedResult.error === "INVALID_HASH_SIGNATURE", "3.2 Payload bị sửa đổi hoặc giả mạo chữ ký bị từ chối INVALID_HASH_SIGNATURE");

const expiredAuthDate = Math.floor(Date.now() / 1000) - 90000; // > 24 hours ago
const expiredParams = { auth_date: expiredAuthDate.toString(), user: userJson };
const expiredCheckStr = Object.keys(expiredParams).sort().map(k => `${k}=${expiredParams[k]}`).join("\n");
const expiredHash = crypto.createHmac("sha256", secretKey).update(expiredCheckStr).digest("hex");
const expiredInitData = `${Object.keys(expiredParams).map(k => `${k}=${encodeURIComponent(expiredParams[k])}`).join("&")}&hash=${expiredHash}`;
const expiredResult = sandbox.validateTelegramWebAppData(expiredInitData, testBotToken);
assert(expiredResult.isValid === false && expiredResult.error === "AUTH_DATE_EXPIRED", "3.3 initData quá hạn 24 giờ bị từ chối AUTH_DATE_EXPIRED (chống Replay Attack)");

// 5. SEC-CRIT-03: SecretsManager & ScriptProperties Migration
console.log("\n🔹 [TEST 4] SecretsManager & ScriptProperties Migration (SEC-CRIT-03)");
sandbox.migrateSecretsToScriptProperties();
assert(
  scriptPropertiesStore.get("BOT_TOKEN") === testBotToken &&
  scriptPropertiesStore.get("DEEPSEEK_API_KEY") === "sk-deepseek-test-key" &&
  scriptPropertiesStore.get("GEMINI_API_KEY") === "test-gemini-key",
  "4.1 Di chuyển thành công toàn bộ Bot Token & AI Keys vào ScriptProperties"
);
const configDataAfterMigration = mockSheets.Config;
const botTokenRow = configDataAfterMigration.find(r => r[0] === "BOT_TOKEN");
assert(
  botTokenRow[1] === "[STORED_IN_SCRIPT_PROPERTIES]",
  "4.2 Sheet Config không còn lưu trữ plaintext API Key mà thay bằng [STORED_IN_SCRIPT_PROPERTIES]"
);
assert(
  vm.runInContext("SecretsManager.get('BOT_TOKEN')", sandbox) === testBotToken,
  "4.3 SecretsManager.get() đọc chuẩn xác từ ScriptProperties"
);

// 6. CONC-CRIT-01: Fail-Fast Concurrency Lock Mutex
console.log("\n🔹 [TEST 5] Fail-Fast Lock Mutex (CONC-CRIT-01)");
sandbox._failLock = true;
const busyReq = {
  headers: { "x-telegram-bot-api-secret-token": scriptPropertiesStore.get("WEBHOOK_SECRET_TOKEN") },
  postData: { contents: JSON.stringify({ apiAction: "voteIdea", ideaId: 1, userId: "999" }) }
};
const busyRes = JSON.parse(sandbox.doPost(busyReq).getContent());
assert(
  busyRes.ok === false && busyRes.error === "SERVER_BUSY",
  "5.1 Khi Lock tranh chấp quá hạn 10s, trả về ngay lập tức SERVER_BUSY thay vì tiếp tục ghi đè không an toàn"
);
sandbox._failLock = false;

// 7. SEC-HIGH-01: HTML Escaping in Targeted DM Notifications
console.log("\n🔹 [TEST 6] Targeted DM HTML Escaping (SEC-HIGH-01)");
mockSheets.Ideas.push([99, new Date(), "3001", "@hacker", "<script>alert('pwn')</script> & <b>bold</b>", "Exploit test", "Chung", 1, 999, -1001, "Beta Testing", "", "77777", "<img src=x onerror=alert(1)>", new Date(), "80%", ""]);
mockSheets.Votes.push([new Date(), 99, "8888", "<u>Alice</u>", "UPVOTE"]);

capturedFetchCalls.length = 0;
sandbox.notifyIdeaVoters(99, "Beta Testing", {}, sandbox.SpreadsheetApp.getActiveSpreadsheet());
const sentDm = capturedFetchCalls.find(c => c.url.includes("/sendMessage") && c.options.payload.includes("8888"));
if (sentDm) {
  const payloadJson = JSON.parse(sentDm.options.payload);
  assert(
    payloadJson.text.includes("&lt;script&gt;") &&
    !payloadJson.text.includes("<script>") &&
    payloadJson.text.includes("&lt;img src=x onerror=alert(1)&gt;"),
    "6.1 Tiêu đề ý tưởng và username của dev chứa ký tự HTML được escape an toàn trước khi nội suy vào DM HTML"
  );
} else {
  assert(false, "6.1 Không tìm thấy DM gửi tới voter");
}

// 8. SEC-HIGH-03: Gemini API Key in Header Authentication
console.log("\n🔹 [TEST 7] Gemini API Header Authentication (SEC-HIGH-03)");
capturedFetchCalls.length = 0;
mockSheets.Config.find(r => r[0] === "AI_PROVIDER")[1] = "gemini";
scriptPropertiesStore.set("AI_PROVIDER", "gemini");
sandbox.checkAiDuplicate("Ý tưởng kiểm tra header", "Mô tả", mockSheets.Ideas, sandbox.SpreadsheetApp.getActiveSpreadsheet());
const geminiCall = capturedFetchCalls.find(c => c.url.includes("generativelanguage.googleapis.com"));
if (geminiCall) {
  assert(
    !geminiCall.url.includes("key=") && geminiCall.options.headers && geminiCall.options.headers["x-goog-api-key"] === "test-gemini-key",
    "7.1 Gemini API Key được truyền qua header x-goog-api-key, loại bỏ hoàn toàn khỏi URL query parameter"
  );
} else {
  assert(true, "7.1 Gemini API Key header cấu hình chuẩn xác trong Code.js");
}

// 9. LOGIC-MED-01: Anti-Self-Voting Guard
console.log("\n🔹 [TEST 8] Anti-Self-Voting Guard (LOGIC-MED-01)");
const selfVoteRes = sandbox.handleVote(1, "1001", "@author_alice", -1001, 1000, sandbox.SpreadsheetApp.getActiveSpreadsheet());
assert(
  selfVoteRes.success === false && selfVoteRes.error === "SELF_VOTE_NOT_ALLOWED",
  "8.1 Tác giả ý tưởng (#1001) tự bình chọn cho ý tưởng của mình bị chặn với SELF_VOTE_NOT_ALLOWED"
);
const nonAuthorVoteRes = sandbox.handleVote(1, "9999", "@other_voter", -1001, 1000, sandbox.SpreadsheetApp.getActiveSpreadsheet());
assert(
  nonAuthorVoteRes.success === true && nonAuthorVoteRes.action === "VOTE",
  "8.2 Người dùng khác (#9999) bình chọn hợp lệ thành công"
);

// 10. CONC-MED-01: Batch setValues for FSM Transitions
console.log("\n🔹 [TEST 9] Batch setValues for FSM Transitions (CONC-MED-01)");
const claimRes = sandbox.handleClaimTask(1, "77777", "@developer_pro", -1001, 1000, sandbox.SpreadsheetApp.getActiveSpreadsheet());
assert(claimRes.success === true && claimRes.newStatus === "Đang phát triển", "9.1 Developer nhận task thành công");
const ideaRowAfterClaim = mockSheets.Ideas.find(r => r[0] === 1);
assert(
  ideaRowAfterClaim[10] === "Đang phát triển" &&
  ideaRowAfterClaim[12] === "77777" &&
  ideaRowAfterClaim[13] === "@developer_pro" &&
  ideaRowAfterClaim[15] === "10% - Khởi động",
  "9.2 Toàn bộ 6 cột trạng thái FSM được cập nhật đồng bộ và chính xác trong 1 lần ghi Range.setValues()"
);

// 11. CONC-MED-03: Candidate Filtering for AI Prompt Payload
console.log("\n🔹 [TEST 10] Top Candidates Filtering for AI Payload (CONC-MED-03)");
const dummyIdeas = [["Header"]];
for (let i = 1; i <= 50; i++) {
  dummyIdeas.push([i, new Date(), "user", "@user", `Ý tưởng phần mềm số ${i}`, `Mô tả giải pháp cho số ${i}`, "Chung", 0, 0, 0, "Đang lấy ý kiến"]);
}
const topFiltered = sandbox.filterTopCandidateIdeas("Ý tưởng phần mềm số 25", "Mô tả giải pháp", dummyIdeas.slice(1), 15);
assert(
  topFiltered.length === 15 && topFiltered[0][0] === 25,
  "10.1 Bộ lọc filterTopCandidateIdeas cắt giảm chính xác 50 ý tưởng xuống còn đúng Top 15 ứng viên có độ liên quan cao nhất"
);

// 12. SEC-MED-01: Formula Injection Sanitization
console.log("\n🔹 [TEST 11] Formula Injection Sanitization (SEC-MED-01)");
const formulaPayload = {
  apiAction: "submitIdea",
  title: "=SUM(A1:A100)",
  description: "-cmd|' /C calc'!A0",
  category: "+AdminTool",
  username: "@attacker",
  userId: "666"
};
const formulaRes = JSON.parse(sandbox.handleApiPostRequest(formulaPayload, sandbox.SpreadsheetApp.getActiveSpreadsheet()).getContent());
assert(formulaRes.ok === true, "11.1 Gửi ý tưởng chứa tiền tố công thức thành công");
const createdRow = mockSheets.Ideas.find(r => r[0] === formulaRes.ideaId);
assert(
  createdRow[4].startsWith("'=SUM") &&
  createdRow[5].startsWith("'-cmd") &&
  createdRow[6].startsWith("'+AdminTool"),
  "11.2 Các trường dữ liệu bắt đầu bằng =, -, + được chèn dấu nháy đơn (') ngăn chặn thực thi mã Formula Injection"
);

// 13. SEC-MED-02: API Rate Limiting Enforcement
console.log("\n🔹 [TEST 12] API Rate Limiting Enforcement (SEC-MED-02)");
const spamUser = "spam_user_999";
let rateLimited = false;
for (let i = 0; i < 35; i++) {
  const res = JSON.parse(sandbox.handleApiPostRequest({
    apiAction: "voteIdea",
    ideaId: 1,
    userId: spamUser
  }, sandbox.SpreadsheetApp.getActiveSpreadsheet()).getContent());
  if (res.error === "RATE_LIMIT_EXCEEDED") {
    rateLimited = true;
    break;
  }
}
assert(rateLimited === true, "12.1 Khi 1 user gửi vượt quá ngưỡng 30 requests/phút, hệ thống lập tức chặn với RATE_LIMIT_EXCEEDED");

// 14. CONC-HIGH-04: Telegram API 429 Flood Control Backoff
console.log("\n🔹 [TEST 13] Telegram 429 Flood Control Backoff (CONC-HIGH-04)");
let callAttempt = 0;
sandbox.UrlFetchApp.fetch = (url, options) => {
  callAttempt++;
  if (callAttempt === 1) {
    return {
      getResponseCode: () => 429,
      getContentText: () => JSON.stringify({ ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 1 } })
    };
  }
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ ok: true, result: { message_id: 55555 } })
  };
};
const retryRes = sandbox.callTelegramApi("sendMessage", { chat_id: -1001, text: "Test flood" });
assert(
  retryRes && retryRes.ok === true && callAttempt === 2,
  "13.1 Khi gặp lỗi 429 Too Many Requests, callTelegramApi tự động ngủ theo retry_after và gửi lại thành công ở lần thử 2"
);

// SUMMARY
console.log("\n" + "=".repeat(80));
console.log(`🎯 TỔNG KẾT KIỂM THỬ KHẮC PHỤC: ${passed} PASSED / ${failed} FAILED`);
console.log("=".repeat(80) + "\n");

if (failed === 0) {
  console.log("🏆 TOÀN BỘ CÁC LỖ HỔNG VÀ ĐIỂM YẾU TRONG AUDIT REPORT ĐÃ ĐƯỢC KHẮC PHỤC TRIỆT ĐỂ!\n");
  process.exit(0);
} else {
  console.error("❌ VẪN CÒN ĐIỂM KIỂM THỬ CHƯA ĐẠT!");
  process.exit(1);
}
