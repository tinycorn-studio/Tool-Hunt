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

console.log('=== DIRECT TESTS OF Code.js WITH MOCKS ===');
vm.runInContext(`
  initSpreadsheet();
  console.log('Sheets initialized by Code.js/SetupHelper.js:', SpreadsheetApp.getSheets().map(s => s.getName()));

  // 1. Test vote
  const ideasSheet = SpreadsheetApp.getSheetByName('Ideas');
  ideasSheet.appendRow([1, new Date(), 101, '@author', 'Idea Test', 'Mo ta', 'Chung', 0, 1001, -1001, 'Đang lấy ý kiến', '', '', '', '', '0%', '']);
  const v1 = handleVote(1, 202, '@voter1', -1001, 1001);
  console.log('Direct handleVote 1:', v1);
  const v2 = handleVote(1, 202, '@voter1', -1001, 1001);
  console.log('Direct handleVote 2 (unvote):', v2);

  // 2. Test claim
  const claim = handleClaimTask(1, 77777, '@developer_pro', -1001, 1001);
  console.log('Direct handleClaimTask:', claim);

  // 3. Test bounty
  const bounty = handlePledgeBounty(1, 901, '@sponsor', 500000, 'VND', 'Sponsor test', -1001);
  console.log('Direct handlePledgeBounty:', bounty);

  // 4. Test notify
  SpreadsheetApp.getSheetByName('Votes').appendRow([new Date(), 1, 303, '@active_voter', 'UPVOTE']);
  const notify = notifyIdeaVoters(1, 'Beta Testing', {});
  console.log('Direct notifyIdeaVoters:', notify);

  // 5. Test doGet
  const getRes = doGet({ parameter: { action: 'getIdeas' } });
  console.log('Direct doGet getIdeas:', JSON.parse(getRes.getContent()).data.length, 'ideas');

  // 6. Test doPost
  const postRes = doPost({ postData: { contents: JSON.stringify({ apiAction: 'voteIdea', ideaId: 1, userId: 404, username: '@web_voter' }) } });
  console.log('Direct doPost voteIdea:', JSON.parse(postRes.getContent()));
`, sandbox);
