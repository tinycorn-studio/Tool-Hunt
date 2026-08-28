const fs = require('fs');
const vm = require('vm');

const testSim = fs.readFileSync('scripts/test_simulator.js', 'utf8');
const code = fs.readFileSync('google-apps-script/Code.js', 'utf8');
const setup = fs.readFileSync('google-apps-script/SetupHelper.js', 'utf8');

const sandbox = {
  console: console,
  Logger: { log: console.log },
  CacheService: { getScriptCache: () => null },
  Map: Map,
  Set: Set,
  Date: Date,
  JSON: JSON,
  parseInt: parseInt,
  parseFloat: parseFloat,
  Math: Math,
  process: process,
  setTimeout: setTimeout
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(testSim, sandbox);

vm.runInContext(`
  class EnhancedMockSpreadsheetApp extends MockSpreadsheetApp {
    getSheetByName(name) {
      const sheet = super.getSheetByName(name);
      if (!sheet) return null;
      sheet.autoResizeColumn = () => {};
      return sheet;
    }
  }
  globalThis.SpreadsheetApp = new EnhancedMockSpreadsheetApp();
  globalThis.UrlFetchApp = new MockUrlFetchApp();
  globalThis.LockService = new MockLockService();
  globalThis.ContentService = {
    createTextOutput: (txt) => {
      let content = txt;
      let mime = "text/plain";
      const out = {
        setMimeType: (m) => { mime = m; return out; },
        getContent: () => content,
        getMimeType: () => mime
      };
      return out;
    },
    MimeType: { JSON: "application/json", TEXT: "text/plain" }
  };
`, sandbox);

vm.runInContext(setup, sandbox);
vm.runInContext(code, sandbox);

vm.runInContext(`
  console.log("================================================================================");
  console.log("🛡️ ADVERSARIAL STRESS TEST & ATTACK SURFACE VERIFICATION");
  console.log("================================================================================\\n");

  initSpreadsheet();

  let advPassed = 0;
  let advFailed = 0;
  function advAssert(desc, cond) {
    if (cond) {
      console.log("  ✅ [PASS] " + desc);
      advPassed++;
    } else {
      console.error("  ❌ [FAIL] " + desc);
      advFailed++;
    }
  }

  // Attack 1: Double Claim by Unauthorized Role (Member)
  const ideasSheet = SpreadsheetApp.getSheetByName("Ideas");
  ideasSheet.appendRow([10, new Date(), 100, "@author", "Idea 10", "Desc 10", "Chung", 0, 1010, -1001, "Đang lấy ý kiến", "", "", "", "", "0%", ""]);
  const resMemberClaim = handleClaimTask(10, 111, "@member", -1001, 1010);
  advAssert("1. Chặn thành viên không có quyền Developer nhận task (UNAUTHORIZED_ROLE)", resMemberClaim.error === "UNAUTHORIZED_ROLE");

  // Attack 2: Legitimate Dev claims, then second Dev tries to steal
  const resDev1Claim = handleClaimTask(10, 77777, "@dev_pro", -1001, 1010);
  advAssert("2. Dev 1 nhận task thành công", resDev1Claim.success && resDev1Claim.newStatus === "Đang phát triển");
  const resDev2Steal = handleClaimTask(10, 66666, "@dev_alice", -1001, 1010);
  advAssert("3. Chặn Dev 2 cướp task của Dev 1 khi đang phát triển (ALREADY_CLAIMED)", resDev2Steal.error === "ALREADY_CLAIMED");

  // Attack 3: Unauthorized Unclaim by Member
  const resMemberUnclaim = handleUnclaimTask(10, 111, "@member", -1001, 1010);
  advAssert("4. Chặn thành viên hủy task của Developer (UNAUTHORIZED_UNCLAIM)", resMemberUnclaim.error === "UNAUTHORIZED_UNCLAIM");

  // Attack 4: Legitimate Dev Unclaim resets state
  const resDevUnclaim = handleUnclaimTask(10, 77777, "@dev_pro", -1001, 1010);
  advAssert("5. Dev chính chủ nhả task thành công, trạng thái quay về 'Đang lấy ý kiến'", resDevUnclaim.success && resDevUnclaim.status === "Đang lấy ý kiến");

  // Attack 5: Repeated multi-user voting and unvoting integrity
  for (let i = 0; i < 5; i++) {
    handleVote(10, 501, "@voter_501", -1001, 1010); // vote
    handleVote(10, 501, "@voter_501", -1001, 1010); // unvote
  }
  const voteNet = handleVote(10, 501, "@voter_501", -1001, 1010); // vote once more
  advAssert("6. Chu kỳ 10 lần toggle vote/unvote duy trì tính toàn vẹn (Net vote = 1)", voteNet.currentVotes === 1);

  // Attack 6: Bounty Pledges with Zero/Negative amount
  const resZeroBounty = handlePledgeBounty(10, 999, "@bad_sponsor", 0, "VND", "Zero", -1001);
  const resNegBounty = handlePledgeBounty(10, 999, "@bad_sponsor", -50000, "VND", "Negative", -1001);
  advAssert("7. Chặn tài trợ số tiền <= 0 (INVALID_AMOUNT)", resZeroBounty.error === "INVALID_AMOUNT" && resNegBounty.error === "INVALID_AMOUNT");

  // Attack 7: Valid Bounty Multi-Currency Accumulation
  handlePledgeBounty(10, 901, "@sponsor_1", 1000000, "VND", "1M VND", -1001);
  handlePledgeBounty(10, 902, "@sponsor_2", 10, "COFFEE", "10 ly cafe", -1001);
  const totalB = calculateTotalBounty(10);
  advAssert("8. Tính toán chính xác tổng quỹ đa đơn vị (1.000.000 VNĐ + 10 ☕)", totalB.totalVnd === 1000000 && totalB.coffeeCount === 10 && totalB.sponsorCount === 2);

  // Attack 8: Targeted Beta Notification extracts only net active voters
  handleVote(10, 502, "@voter_502", -1001, 1010); // vote
  handleVote(10, 503, "@voter_503", -1001, 1010); // vote
  handleVote(10, 503, "@voter_503", -1001, 1010); // unvote -> not active
  const notifyBeta = notifyIdeaVoters(10, "Beta Testing", {});
  advAssert("9. Trích xuất chính xác 2 Active Voters (501, 502) và bỏ qua voter đã hủy (503)",
    notifyBeta.notifiedCount === 2 && notifyBeta.recipientUserIds.includes(501) && notifyBeta.recipientUserIds.includes(502) && !notifyBeta.recipientUserIds.includes(503)
  );

  // Attack 9: Completion status releases bounties
  handleClaimTask(10, 77777, "@dev_pro", -1001, 1010);
  const devDone = handleDevStatusTransition(10, 77777, "@dev_pro", "Hoàn thành", -1001, 1010);
  advAssert("10. Hoàn thành tool chuyển đổi trạng thái Bounties sang RELEASED", devDone.success && devDone.status === "Hoàn thành");
  const bData = SpreadsheetApp.getSheetByName("Bounties").getDataRange().getValues();
  const bountiesFor10 = bData.filter(r => r[2] == 10);
  advAssert("11. Toàn bộ record Bounty của Idea #10 đều là RELEASED", bountiesFor10.every(r => r[8] === "RELEASED"));

  // Attack 10: RBAC Admin Override on Status Change
  const adminChange = updateIdeaStatus(10, "Đang lấy ý kiến", SpreadsheetApp, -1001, 1010, 99999, "@super_admin");
  advAssert("12. Admin có toàn quyền override cập nhật trạng thái ý tưởng", adminChange.success && adminChange.newStatus === "Đang lấy ý kiến");

  // Attack 11: Non-existent Idea handled gracefully
  const resBadIdea = handleVote(9999, 111, "@user", -1001, 1000);
  advAssert("13. Xử lý an toàn khi thao tác trên Idea ID không tồn tại (IDEA_NOT_FOUND)", resBadIdea.error === "IDEA_NOT_FOUND");

  // Attack 12: API doPost with empty or invalid payload
  const resEmptyPost = doPost({});
  const resBadPost = doPost({ postData: { contents: "{ invalid json" } });
  advAssert("14. API doPost xử lý an toàn khi nhận payload rỗng hoặc JSON sai cú pháp", !resEmptyPost.ok && !resBadPost.ok);

  console.log("\\n--------------------------------------------------------------------------------");
  console.log(\`🎯 KẾT QUẢ STRESS TEST: \${advPassed} PASSED / \${advFailed} FAILED\`);
  console.log("================================================================================\\n");

  if (advFailed > 0) process.exitCode = 1;
`, sandbox);
