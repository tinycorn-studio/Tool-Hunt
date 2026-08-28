/**
 * ==============================================================================
 * CHALLENGER 2 ADVERSARIAL STRESS TEST SUITE — TOOLHUNT ENTERPRISE
 * ==============================================================================
 * Empirical adversarial stress testing for:
 * 1. R2 Developer Task Claiming Lifecycle & FSM
 * 2. R3 Targeted Beta Notifications & Voter Extraction Filtering
 * 3. R4 Tool Bounty & Multi-Currency Crowdfunding Calculations
 * ==============================================================================
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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
        [55555, "@developer_bob", "Developer", "Active", new Date()],
        [111, "@member_user", "Member", "Active", new Date()],
        [222, "@member_two", "Member", "Active", new Date()]
      ],
      Config: [
        ["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"],
        ["BOT_TOKEN", "123456:TEST_ENTERPRISE_MOCK_TOKEN", "Token Test"],
        ["WEBAPP_URL", "https://mock-enterprise-webapp.url", "Test Mini App URL"],
        ["COMMUNITY_GROUP_ID", "-1001999999999", "ID nhóm cộng đồng"],
        ["AI_PROVIDER", "deepseek", "AI Provider (deepseek / gemini)"],
        ["AI_SIMILARITY_THRESHOLD", "75", "Ngưỡng % tương đồng cảnh báo trùng"],
        ["DEEPSEEK_API_KEY", "sk-mock-deepseek-key", "DeepSeek API Key"],
        ["GEMINI_API_KEY", "mock-gemini-key", "Gemini API Key"],
        ["DEMO_BASE_URL", "https://toolhunt.enterprise/demo/", "Demo URL prefix"],
        ["FEEDBACK_BASE_URL", "https://toolhunt.enterprise/feedback/", "Feedback URL prefix"]
      ],
      AuditLogs: [
        ["Thời Gian", "User ID", "Username", "Hành Động", "Chi Tiết"]
      ]
    };
  }

  getActiveSpreadsheet() { return this; }

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
      appendRow: (row) => { sheetData.push([...row]); },
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
    if (!this.sheets[name]) this.sheets[name] = [];
    return this.getSheetByName(name);
  }

  deleteSheet(sheetObj) {
    if (sheetObj && sheetObj.getName) delete this.sheets[sheetObj.getName()];
  }

  getSheets() {
    return Object.keys(this.sheets).map(name => this.getSheetByName(name));
  }
}

class MockUrlFetchApp {
  constructor() {
    this.sentMessages = [];
    this.editedKeyboards = [];
    this.externalCalls = [];
    this.nextMessageId = 5000;
    this.errorResponses = {}; // chat_id -> { status: 403, error: "Bot was blocked" }
  }

  setErrorForChat(chatId, status, description) {
    this.errorResponses[chatId] = { status, description };
  }

  fetch(url, options = {}) {
    const payload = options.payload ? (typeof options.payload === "string" ? JSON.parse(options.payload) : options.payload) : {};
    this.externalCalls.push({ url, method: options.method || "GET", payload });

    if (url.includes("api.telegram.org")) {
      if (url.includes("/sendMessage")) {
        const targetChat = payload.chat_id;
        if (this.errorResponses[targetChat]) {
          const err = this.errorResponses[targetChat];
          return {
            getResponseCode: () => err.status,
            getContentText: () => JSON.stringify({ ok: false, error_code: err.status, description: err.description })
          };
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

// Load EnterpriseBotEngine from test_simulator.js using vm
const testSimPath = path.join(__dirname, "test_simulator.js");
const testSimContent = fs.readFileSync(testSimPath, "utf8");
const classMatches = testSimContent.match(/class EnterpriseBotEngine[\s\S]*?\n\/\/\s*=+\s*\n\/\/\s*3\.\s*MODULAR TEST SUITES/);
const classCode = classMatches[0].replace(/\/\/\s*=+\s*\n\/\/\s*3\.\s*MODULAR TEST SUITES/, "");

const sandbox = { module: {}, exports: {}, console };
vm.createContext(sandbox);
vm.runInContext(classCode + "\nthis.EnterpriseBotEngine = EnterpriseBotEngine;", sandbox);
const EnterpriseBotEngine = sandbox.EnterpriseBotEngine;

// ==============================================================================
// ADVERSARIAL CHALLENGE EXECUTION
// ==============================================================================

async function runAdversarialChallenges() {
  console.log("================================================================================");
  console.log("⚡ CHALLENGER 2: ADVERSARIAL STRESS TEST HARNESS");
  console.log("================================================================================\n");

  const ss = new MockSpreadsheetApp();
  const urlFetch = new MockUrlFetchApp();
  const lockService = new MockLockService();
  const bot = new EnterpriseBotEngine(ss, urlFetch, lockService);

  let passedCount = 0;
  let failedCount = 0;
  const testResults = [];

  function record(category, testName, condition, details = "") {
    if (condition) {
      console.log(`  ✅ [PASS] [${category}] ${testName}`);
      passedCount++;
      testResults.push({ category, name: testName, status: "PASS", details });
    } else {
      console.error(`  ❌ [FAIL] [${category}] ${testName} -> ${details}`);
      failedCount++;
      testResults.push({ category, name: testName, status: "FAIL", details });
    }
  }

  // Pre-seed 3 ideas in sheet
  const ideasSheet = ss.getSheetByName("Ideas");
  // Idea 1: Open
  ideasSheet.appendRow([1, new Date(), 101, "@author1", "Tool A", "Desc A", "Auto", 5, 1001, -1001, "Đang lấy ý kiến", "Telegram", "", "", "", "0%", ""]);
  // Idea 2: Claimed
  ideasSheet.appendRow([2, new Date(), 102, "@author2", "Tool B", "Desc B", "Auto", 10, 1002, -1001, "Đang phát triển", "Telegram", 77777, "@developer_pro", new Date(), "10% - Khởi động", ""]);
  // Idea 3: In Beta
  ideasSheet.appendRow([3, new Date(), 103, "@author3", "Tool C", "Desc C", "Auto", 15, 1003, -1001, "Beta Testing", "Telegram", 66666, "@developer_alice", new Date(), "80% - Đang thử nghiệm", ""]);

  // ============================================================================
  // SECTION 1: R2 DEVELOPER CLAIMING & FSM ADVERSARIAL CHALLENGES
  // ============================================================================
  console.log("\n--- SECTION 1: R2 DEVELOPER TASK CLAIMING & FSM EDGE CASES ---");

  // 1.1 Double-claim race condition: Dev 1 claims open task, Dev 2 immediately tries to claim
  const claim1 = bot.handleClaimTask(1, 77777, "@developer_pro", -1001, 1001);
  const claim2 = bot.handleClaimTask(1, 55555, "@developer_bob", -1001, 1001);
  record("R2_FSM", "1.1 Double claim race condition: Dev 1 succeeds, Dev 2 is blocked (ALREADY_CLAIMED)",
    claim1.success === true && claim1.newStatus === "Đang phát triển" && claim2.success === false && claim2.error === "ALREADY_CLAIMED"
  );

  // 1.2 Claiming idea already in Beta or Completed
  const claimBeta = bot.handleClaimTask(3, 55555, "@developer_bob", -1001, 1003);
  record("R2_FSM", "1.2 Claiming an idea currently in Beta Testing is rejected",
    claimBeta.success === false && claimBeta.error === "ALREADY_CLAIMED"
  );

  // 1.3 Unauthorized claim by regular Member (User 111)
  const claimMember = bot.handleClaimTask(1, 111, "@member_user", -1001, 1001);
  record("R2_FSM", "1.3 Regular Member claiming task is blocked with UNAUTHORIZED_ROLE",
    claimMember.success === false && claimMember.error === "UNAUTHORIZED_ROLE"
  );

  // 1.4 Unauthorized unclaim by non-assigned developer
  const unclaimWrongDev = bot.handleUnclaimTask(2, 55555, "@developer_bob", -1001, 1002);
  record("R2_FSM", "1.4 Developer B attempting to unclaim Developer A's task is blocked (UNAUTHORIZED_UNCLAIM)",
    unclaimWrongDev.success === false && unclaimWrongDev.error === "UNAUTHORIZED_UNCLAIM"
  );

  // 1.5 Unauthorized unclaim by regular Member
  const unclaimMember = bot.handleUnclaimTask(2, 111, "@member_user", -1001, 1002);
  record("R2_FSM", "1.5 Regular Member attempting to unclaim is blocked (UNAUTHORIZED_UNCLAIM)",
    unclaimMember.success === false && unclaimMember.error === "UNAUTHORIZED_UNCLAIM"
  );

  // 1.6 Authorized unclaim by Manager override
  const unclaimManager = bot.handleUnclaimTask(2, 88888, "@manager_user", -1001, 1002);
  const row2AfterManagerUnclaim = ss.getSheetByName("Ideas").getDataRange().getValues()[2];
  record("R2_FSM", "1.6 Manager can unclaim developer's task & reset fields (status: 'Đang lấy ý kiến', devId: '')",
    unclaimManager.success === true && row2AfterManagerUnclaim[10] === "Đang lấy ý kiến" && row2AfterManagerUnclaim[12] === "" && row2AfterManagerUnclaim[15] === "0%"
  );

  // 1.7 Idea can be re-claimed after unclaim
  const reclaim = bot.handleClaimTask(2, 55555, "@developer_bob", -1001, 1002);
  record("R2_FSM", "1.7 Idea is immediately claimable by another developer after unclaim",
    reclaim.success === true && reclaim.developerUsername === "@developer_bob"
  );

  // 1.8 Developer unclaiming own task
  const unclaimSelf = bot.handleUnclaimTask(2, 55555, "@developer_bob", -1001, 1002);
  const row2AfterSelfUnclaim = ss.getSheetByName("Ideas").getDataRange().getValues()[2];
  record("R2_FSM", "1.8 Developer successfully unclaims their own task and resets milestone",
    unclaimSelf.success === true && row2AfterSelfUnclaim[10] === "Đang lấy ý kiến" && row2AfterSelfUnclaim[12] === ""
  );

  // 1.9 Non-existent idea ID handling
  const claimNonExistent = bot.handleClaimTask(99999, 77777, "@developer_pro", -1001, 1001);
  record("R2_FSM", "1.9 Claiming non-existent Idea #99999 returns IDEA_NOT_FOUND without crashing",
    claimNonExistent.success === false && claimNonExistent.error === "IDEA_NOT_FOUND"
  );

  // 1.10 Unauthorized status transition: Dev Bob tries to transition Alice's task (#3) to Hoàn thành
  const unauthTransition = bot.handleDevStatusTransition(3, 55555, "@developer_bob", "Hoàn thành", -1001, 1003);
  record("R2_FSM", "1.10 Developer B cannot trigger status transitions on Developer Alice's task (UNAUTHORIZED)",
    unauthTransition.success === false && unauthTransition.error === "UNAUTHORIZED"
  );

  // ============================================================================
  // SECTION 2: R3 TARGETED BETA NOTIFICATIONS & VOTER EXTRACTION
  // ============================================================================
  console.log("\n--- SECTION 2: R3 TARGETED NOTIFICATIONS & VOTER FILTERING ---");

  // Create Idea #10 for complex voter extraction testing
  ideasSheet.appendRow([10, new Date(), 100, "@author", "Complex Voter Idea", "Desc", "Auto", 3, 1010, -1001, "Đang phát triển", "Telegram", 77777, "@developer_pro", new Date(), "10%", ""]);

  const votesSheet = ss.getSheetByName("Votes");

  // Voter 1: UPVOTE -> UNVOTE -> UPVOTE (Active)
  bot.handleVote(10, 1001, "voter_1", -1001, 1010);
  bot.handleVote(10, 1001, "voter_1", -1001, 1010);
  bot.handleVote(10, 1001, "voter_1", -1001, 1010);

  // Voter 2: UPVOTE -> UNVOTE (Inactive)
  bot.handleVote(10, 1002, "voter_2", -1001, 1010);
  bot.handleVote(10, 1002, "voter_2", -1001, 1010);

  // Voter 3: UPVOTE (Active)
  bot.handleVote(10, 1003, "voter_3", -1001, 1010);

  // Voter 4: UPVOTE -> UNVOTE -> UPVOTE -> UNVOTE (Inactive)
  bot.handleVote(10, 1004, "voter_4", -1001, 1010);
  bot.handleVote(10, 1004, "voter_4", -1001, 1010);
  bot.handleVote(10, 1004, "voter_4", -1001, 1010);
  bot.handleVote(10, 1004, "voter_4", -1001, 1010);

  // Voter 5: UPVOTE (Active)
  bot.handleVote(10, 1005, "voter_5", -1001, 1010);

  // Voter 6: Voted on Idea #1 only (Not on Idea #10)
  bot.handleVote(1, 1006, "voter_other_idea", -1001, 1001);

  // 2.1 Verify voter extraction under interleaving vote/unvote cycles
  const notifyResult = bot.notifyIdeaVoters(10, "Beta Testing", { demoUrl: "https://demo/10", feedbackUrl: "https://fb/10" });
  record("R3_NOTIFY", "2.1 Voter extraction correctly isolates exactly Active Voters [1001, 1003, 1005] and excludes [1002, 1004, 1006]",
    notifyResult.notifiedCount === 3 &&
    notifyResult.recipientUserIds.includes(1001) &&
    notifyResult.recipientUserIds.includes(1003) &&
    notifyResult.recipientUserIds.includes(1005) &&
    !notifyResult.recipientUserIds.includes(1002) &&
    !notifyResult.recipientUserIds.includes(1004) &&
    !notifyResult.recipientUserIds.includes(1006)
  );

  // 2.2 Error handling when Telegram returns HTTP 403 (User blocked bot)
  urlFetch.setErrorForChat(1001, 403, "Forbidden: bot was blocked by the user");
  // Trigger notification again to check resilient loop
  let noCrash = false;
  try {
    const notifyResError = bot.notifyIdeaVoters(10, "Beta Testing");
    noCrash = notifyResError.notifiedCount === 3;
  } catch (e) {
    noCrash = false;
  }
  record("R3_NOTIFY", "2.2 Telegram API 403 (bot blocked) does not abort dispatch loop for subsequent voters",
    noCrash
  );
  urlFetch.errorResponses = {}; // Clear mock error

  // 2.3 Completed notification dispatches correct format
  const notifyDoneRes = bot.notifyIdeaVoters(10, "Hoàn thành", { demoUrl: "https://demo/10" });
  const lastDoneMsgs = urlFetch.sentMessages.filter(m => m.text && m.text.includes("CÔNG BỐ TOOL HOÀN THÀNH"));
  record("R3_NOTIFY", "2.3 Completion notification delivers correct HTML announcement with demo link",
    notifyDoneRes.notifiedCount === 3 && lastDoneMsgs.length >= 3 && lastDoneMsgs[0].text.includes("https://demo/10")
  );

  // 2.4 Non-existent idea notification returns 0 recipients
  const notifyEmpty = bot.notifyIdeaVoters(99999, "Beta Testing");
  record("R3_NOTIFY", "2.4 Notifying non-existent idea returns 0 notified count cleanly",
    notifyEmpty.notifiedCount === 0 && notifyEmpty.recipientUserIds.length === 0
  );

  // ============================================================================
  // SECTION 3: R4 TOOL BOUNTY & MULTI-CURRENCY CALCULATIONS
  // ============================================================================
  console.log("\n--- SECTION 3: R4 TOOL BOUNTY & MULTI-CURRENCY POOL ---");

  // Create Idea #20 for Bounty testing
  ideasSheet.appendRow([20, new Date(), 100, "@author", "Bounty Idea", "Desc", "Auto", 10, 1020, -1001, "Đang phát triển", "Telegram", 77777, "@developer_pro", new Date(), "10%", ""]);

  // 3.1 Zero amount pledge
  const zeroPledge = bot.handlePledgeBounty(20, 901, "@sponsor", 0, "VND", "Zero", -1001);
  record("R4_BOUNTY", "3.1 Zero amount pledge (amount: 0) is rejected with INVALID_AMOUNT",
    zeroPledge.success === false && zeroPledge.error === "INVALID_AMOUNT"
  );

  // 3.2 Negative amount pledge
  const negPledge = bot.handlePledgeBounty(20, 901, "@sponsor", -50000, "VND", "Negative", -1001);
  record("R4_BOUNTY", "3.2 Negative amount pledge (amount: -50000) is rejected with INVALID_AMOUNT",
    negPledge.success === false && negPledge.error === "INVALID_AMOUNT"
  );

  // 3.3 Multi-currency accumulation: VND + COFFEE
  const b1 = bot.handlePledgeBounty(20, 901, "@sponsor_1", 1000000, "VND", "Sponsor 1", -1001);
  const b2 = bot.handlePledgeBounty(20, 902, "@sponsor_2", 500000, "VND", "Sponsor 2", -1001);
  const b3 = bot.handlePledgeBounty(20, 903, "@sponsor_3", 3.5, "COFFEE", "3.5 Coffees", -1001);
  const b4 = bot.handlePledgeBounty(20, 904, "@sponsor_4", 6.5, "COFFEE", "6.5 Coffees", -1001);

  const poolCalc = bot.calculateTotalBounty(20);
  record("R4_BOUNTY", "3.3 Multi-currency pool correctly sums VND (1.500.000) and COFFEE (10 ☕) across 4 sponsors",
    poolCalc.totalVnd === 1500000 &&
    poolCalc.coffeeCount === 10 &&
    poolCalc.sponsorCount === 4 &&
    poolCalc.badgeText.includes("1.500.000 VNĐ") &&
    poolCalc.badgeText.includes("10 ☕")
  );

  // 3.4 Exclude CANCELLED bounties from calculation
  const bountiesSheet = ss.getSheetByName("Bounties");
  const bData = bountiesSheet.getDataRange().getValues();
  // Mark the 2nd bounty (500,000 VND) as CANCELLED
  for (let b = 1; b < bData.length; b++) {
    if (bData[b][2] == 20 && bData[b][3] == 902) {
      bountiesSheet.getRange(b + 1, 9).setValue("CANCELLED");
      break;
    }
  }
  const poolAfterCancel = bot.calculateTotalBounty(20);
  record("R4_BOUNTY", "3.4 Cancelled bounties are excluded from total sum (1.500.000 -> 1.000.000 VNĐ, 3 sponsors)",
    poolAfterCancel.totalVnd === 1000000 &&
    poolAfterCancel.coffeeCount === 10 &&
    poolAfterCancel.sponsorCount === 3
  );

  // 3.5 Multi-idea isolation (Idea #20 vs Idea #1)
  const poolIdea1 = bot.calculateTotalBounty(1);
  record("R4_BOUNTY", "3.5 Bounty pledges on Idea #20 do not bleed into Idea #1",
    poolIdea1.totalVnd === 0 && poolIdea1.coffeeCount === 0
  );

  // 3.6 Bounty payout status transition on idea completion (Cancelled vs Active)
  // Let's test if CANCELLED bounties get mistakenly updated to RELEASED
  bot.handleDevStatusTransition(20, 77777, "@developer_pro", "Hoàn thành", -1001, 1020);
  const bDataAfterDone = ss.getSheetByName("Bounties").getDataRange().getValues();
  const idea20Bounties = bDataAfterDone.slice(1).filter(r => r[2] == 20);
  const activeAreReleased = idea20Bounties.filter(r => r[3] != 902).every(r => r[8] === "RELEASED");
  const cancelledBountyStatus = idea20Bounties.find(r => r[3] == 902)[8];
  const cancelledPreserved = cancelledBountyStatus === "CANCELLED";

  record("R4_BOUNTY", "3.6 Active bounties transition to RELEASED upon task completion",
    activeAreReleased
  );

  record("R4_BOUNTY", "3.6b [ADVERSARIAL FLAW DETECTION] CANCELLED bounties must not be overwritten to RELEASED on completion",
    cancelledPreserved,
    `Actual status of cancelled bounty after completion: '${cancelledBountyStatus}' (expected 'CANCELLED')`
  );

  // 3.7 Pledging on non-existent idea returns IDEA_NOT_FOUND
  const nonExistentPledge = bot.handlePledgeBounty(88888, 901, "@sponsor", 100000, "VND", "Test", -1001);
  record("R4_BOUNTY", "3.7 Pledging bounty on non-existent idea returns IDEA_NOT_FOUND",
    nonExistentPledge.success === false && nonExistentPledge.error === "IDEA_NOT_FOUND"
  );

  // 3.8 Multi-currency testing: USD & POINTS pledges
  // Create Idea #30 for USD & POINTS
  ideasSheet.appendRow([30, new Date(), 100, "@author", "USD Idea", "Desc", "Auto", 10, 1030, -1001, "Đang phát triển", "Telegram", 77777, "@developer_pro", new Date(), "10%", ""]);
  const usdPledge = bot.handlePledgeBounty(30, 905, "@sponsor_usd", 100, "USD", "100 Dollars", -1001);
  const pointsPledge = bot.handlePledgeBounty(30, 906, "@sponsor_pts", 500, "POINTS", "500 Points", -1001);
  const pool30 = bot.calculateTotalBounty(30);

  record("R4_BOUNTY", "3.8 [ADVERSARIAL FLAW DETECTION] Pledging USD and POINTS should produce non-empty badge text reflecting sponsor pledges",
    pool30.badgeText.length > 0,
    `Actual badgeText: '${pool30.badgeText}' (empty string because only VND and COFFEE are aggregated)`
  );

  // ============================================================================
  // SECTION 4: FSM ILLEGAL STATUS & RE-CLAIMING EDGE CASES
  // ============================================================================
  console.log("\n--- SECTION 4: FSM ILLEGAL TRANSITIONS & EDGE CASES ---");

  // Create Idea #40 in 'Hoàn thành' state with dev 77777
  ideasSheet.appendRow([40, new Date(), 100, "@author", "Completed Idea", "Desc", "Auto", 10, 1040, -1001, "Hoàn thành", "Telegram", 77777, "@developer_pro", new Date(), "100%", ""]);

  // 4.1 Claiming a completed task directly
  const claimDirectCompleted = bot.handleClaimTask(40, 55555, "@developer_bob", -1001, 1040);
  record("R2_FSM", "4.1 Directly claiming an idea that is already in 'Hoàn thành' state is blocked (ALREADY_CLAIMED)",
    claimDirectCompleted.success === false && claimDirectCompleted.error === "ALREADY_CLAIMED"
  );

  // 4.2 [ADVERSARIAL FLAW DETECTION] Unclaiming a completed task
  const unclaimCompleted = bot.handleUnclaimTask(40, 77777, "@developer_pro", -1001, 1040);
  record("R2_FSM", "4.2 [ADVERSARIAL FLAW DETECTION] Unclaiming a completed task ('Hoàn thành') should be rejected to prevent resetting finished tools",
    unclaimCompleted.success === false,
    `Actual result: unclaim succeeded and reset completed Idea #40 back to 'Đang lấy ý kiến'`
  );

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  console.log(`📊 ADVERSARIAL TEST RESULTS: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount === 0) {
    console.log("🎉 ALL ADVERSARIAL STRESS CHALLENGES PASSED EMPIRICALLY WITH ZERO DEFECTS!");
    process.exitCode = 0;
  } else {
    console.error("❌ ADVERSARIAL CHALLENGE DETECTED FAILURES!");
    process.exitCode = 1;
  }

  return { passedCount, failedCount, testResults };
}

runAdversarialChallenges();
