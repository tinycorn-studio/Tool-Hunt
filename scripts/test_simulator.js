/**
 * ==============================================================================
 * SIMULATOR & TEST SUITE: TELEGRAM IDEA BOT & GOOGLE SHEETS LOGIC
 * ==============================================================================
 * Chạy kiểm thử tự động toàn bộ logic xử lý tin nhắn, bình chọn, chống gian lận,
 * xếp hạng Top, thống kê và API mà không cần kết nối mạng hay Telegram thật.
 * ==============================================================================
 */

// Giả lập Mock Google Spreadsheet in-memory
class MockSpreadsheet {
  constructor() {
    this.sheets = {
      Ideas: [
        ["ID", "Thời Gian", "User ID", "Username", "Tên Ý Tưởng", "Mô Tả Chi Tiết", "Thể Loại", "Tổng Vote", "Message ID", "Chat ID", "Trạng Thái", "Ghi Chú"]
      ],
      Votes: [
        ["Thời Gian", "Idea ID", "User ID", "Username", "Hành Động"]
      ],
      Config: [
        ["Cấu Hình (Key)", "Giá Trị (Value)", "Mô Tả"],
        ["BOT_TOKEN", "123456:TEST_MOCK_TOKEN", "Token Test"],
        ["WEBAPP_URL", "https://mock-webapp.url", "Test Mini App"]
      ],
      Admins: [
        ["User ID Telegram", "Username / Tên", "Vai Trò", "Ngày Thêm"],
        [99999, "@super_admin", "Admin", new Date()]
      ]
    };
  }

  getSheetByName(name) {
    if (!this.sheets[name]) return null;
    const self = this;
    return {
      getDataRange: () => ({
        getValues: () => JSON.parse(JSON.stringify(self.sheets[name]))
      }),
      getLastRow: () => self.sheets[name].length,
      appendRow: (row) => {
        self.sheets[name].push(row);
      },
      deleteRow: (rowIndex) => {
        self.sheets[name].splice(rowIndex - 1, 1);
      },
      getRange: (row, col) => ({
        setValue: (val) => {
          self.sheets[name][row - 1][col - 1] = val;
        }
      })
    };
  }
}

// Giả lập Telegram Message & Callback Router
class BotEngine {
  constructor(ss) {
    this.ss = ss;
    this.sentMessages = [];
    this.editedKeyboards = [];
    this.callbackAlerts = [];
  }

  // Handle Telegram message
  processMessage(msg) {
    const text = (msg.text || "").trim();
    const chatId = (msg.chat && msg.chat.id) ? msg.chat.id : (msg.chatId || -1001);
    const userId = msg.from ? msg.from.id : 0;
    const username = (msg.from && msg.from.username) ? "@" + msg.from.username : ((msg.from && msg.from.first_name) || "Thành viên");

    if (text.startsWith("/idea")) {
      const raw = text.substring(5).trim();
      if (!raw || !raw.includes("|")) {
        this.sentMessages.push({ chatId, text: "INVALID_SYNTAX" });
        return { success: false, error: "INVALID_SYNTAX" };
      }

      const [title, ...descParts] = raw.split("|");
      const cleanTitle = title.trim();
      const cleanDesc = descParts.join("|").trim();

      const ideasSheet = this.ss.getSheetByName("Ideas");
      const lastRow = ideasSheet.getLastRow();
      const ideaId = lastRow;

      ideasSheet.appendRow([
        ideaId, new Date(), userId, username, cleanTitle, cleanDesc, "Chung", 0, 1000 + ideaId, chatId, "Đang lấy ý kiến", ""
      ]);

      this.sentMessages.push({
        chatId,
        ideaId,
        title: cleanTitle,
        desc: cleanDesc,
        author: username
      });

      return { success: true, ideaId, title: cleanTitle };
    }

    if (text.startsWith("/top")) {
      const ideasSheet = this.ss.getSheetByName("Ideas");
      const data = ideasSheet.getDataRange().getValues().slice(1);
      const sorted = data.map(r => ({ id: r[0], title: r[4], votes: r[7] })).sort((a, b) => b.votes - a.votes);
      return { success: true, top: sorted.slice(0, 5) };
    }

    if (text.startsWith("/stats")) {
      const ideasSheet = this.ss.getSheetByName("Ideas");
      const votesSheet = this.ss.getSheetByName("Votes");
      const totalIdeas = ideasSheet.getLastRow() - 1;
      const totalVotes = votesSheet.getLastRow() - 1;
      return { success: true, totalIdeas, totalVotes };
    }

    if (text.startsWith("/status")) {
      // Check Admin
      const adminsSheet = this.ss.getSheetByName("Admins");
      const adminData = adminsSheet.getDataRange().getValues().slice(1);
      const isAdmin = adminData.some(a => a[0] == userId);
      if (!isAdmin) {
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
          return { success: true, targetId, newStatus };
        }
      }
      return { success: false, error: "NOT_FOUND" };
    }
  }

  // Handle Callback query (Upvote button)
  processCallback(cb) {
    const cbUserId = cb.from.id;
    const cbUsername = cb.from.username || "User";
    const cbData = cb.data;

    if (cbData.startsWith("vote_")) {
      const ideaId = parseInt(cbData.replace("vote_", ""));
      const votesSheet = this.ss.getSheetByName("Votes");
      const ideasSheet = this.ss.getSheetByName("Ideas");

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

      if (targetRow === -1) return { success: false, error: "IDEA_NOT_FOUND" };

      if (alreadyVoted) {
        // Toggle unvote
        votesSheet.deleteRow(voteRowIndex);
        currentVotes = Math.max(0, currentVotes - 1);
        ideasSheet.getRange(targetRow, 8).setValue(currentVotes);
        return { success: true, action: "UNVOTE", ideaId, currentVotes };
      } else {
        // Vote
        votesSheet.appendRow([new Date(), ideaId, cbUserId, cbUsername, "UPVOTE"]);
        currentVotes += 1;
        ideasSheet.getRange(targetRow, 8).setValue(currentVotes);
        return { success: true, action: "VOTE", ideaId, currentVotes };
      }
    }
  }
}

// ==============================================================================
// RUNNING TEST SUITE
// ==============================================================================
function runTests() {
  console.log("======================================================");
  console.log("🧪 CHẠY KIỂM THỬ TỰ ĐỘNG (UNIT TESTS & LOGIC SIMULATOR)");
  console.log("======================================================\n");

  const ss = new MockSpreadsheet();
  const bot = new BotEngine(ss);
  let passed = 0;
  let failed = 0;

  function assert(testName, condition) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Cú pháp /idea không hợp lệ
  console.log("🔹 1. Kiểm tra xác thực cú pháp /idea:");
  const resInvalid = bot.processMessage({
    chatId: -1001,
    text: "/idea SaiCuPhapKhongCoDauGachDung",
    from: { id: 111, username: "user_a" }
  });
  assert("Báo lỗi khi thiếu dấu gạch đứng (|)", resInvalid.error === "INVALID_SYNTAX");

  // TEST 2: Đăng ý tưởng thành công
  console.log("\n🔹 2. Kiểm tra tạo ý tưởng mới:");
  const resIdea1 = bot.processMessage({
    chatId: -1001,
    text: "/idea Tool Auto Hóa Đơn | Tự động quét PDF và lưu vào Sheet",
    from: { id: 111, username: "user_a" }
  });
  assert("Tạo thành công Idea #1", resIdea1.success && resIdea1.ideaId === 1);

  const resIdea2 = bot.processMessage({
    chatId: -1001,
    text: "/idea Bot Cào Giá Shopee | Cào giá theo giờ và báo Telegram",
    from: { id: 222, username: "user_b" }
  });
  assert("Tạo thành công Idea #2", resIdea2.success && resIdea2.ideaId === 2);

  // TEST 3: Bình chọn (Upvote) lần đầu
  console.log("\n🔹 3. Kiểm tra tính năng Upvote:");
  const vote1 = bot.processCallback({
    from: { id: 333, username: "voter_1" },
    data: "vote_1"
  });
  assert("Voter 1 vote Idea #1 thành công -> Vote = 1", vote1.action === "VOTE" && vote1.currentVotes === 1);

  const vote2 = bot.processCallback({
    from: { id: 444, username: "voter_2" },
    data: "vote_1"
  });
  assert("Voter 2 vote Idea #1 thành công -> Vote = 2", vote2.action === "VOTE" && vote2.currentVotes === 2);

  // TEST 4: Chống spam & Toggle Unvote khi bấm lần 2
  console.log("\n🔹 4. Kiểm tra chống gian lận & Rút lại vote (Toggle Unvote):");
  const voteDuplicate = bot.processCallback({
    from: { id: 333, username: "voter_1" }, // Voter 1 bấm lại
    data: "vote_1"
  });
  assert("Voter 1 bấm lại -> Chuyển thành UNVOTE -> Vote giảm về 1", voteDuplicate.action === "UNVOTE" && voteDuplicate.currentVotes === 1);

  // Voter 1 vote lại lần 3
  const voteReVote = bot.processCallback({
    from: { id: 333, username: "voter_1" },
    data: "vote_1"
  });
  assert("Voter 1 vote lại -> Vote tăng lại lên 2", voteReVote.action === "VOTE" && voteReVote.currentVotes === 2);

  // Thêm vote cho Idea #2
  bot.processCallback({ from: { id: 555, username: "voter_3" }, data: "vote_2" });
  bot.processCallback({ from: { id: 666, username: "voter_4" }, data: "vote_2" });
  bot.processCallback({ from: { id: 777, username: "voter_5" }, data: "vote_2" }); // Idea 2 có 3 votes

  // TEST 5: Lệnh /top (Xếp hạng)
  console.log("\n🔹 5. Kiểm tra bảng xếp hạng /top:");
  const topRes = bot.processMessage({ chatId: -1001, text: "/top", from: { id: 111 } });
  assert("Idea #2 dẫn đầu với 3 votes", topRes.top[0].id === 2 && topRes.top[0].votes === 3);
  assert("Idea #1 đứng thứ hai với 2 votes", topRes.top[1].id === 1 && topRes.top[1].votes === 2);

  // TEST 6: Lệnh /stats (Thống kê)
  console.log("\n🔹 6. Kiểm tra thống kê /stats:");
  const statsRes = bot.processMessage({ chatId: -1001, text: "/stats", from: { id: 111 } });
  assert("Tổng số ideas = 2", statsRes.totalIdeas === 2);
  assert("Tổng số votes trong hệ thống = 5", statsRes.totalVotes === 5);

  // TEST 7: Lệnh Admin /status
  console.log("\n🔹 7. Kiểm tra phân quyền Admin /status:");
  const nonAdminRes = bot.processMessage({
    chatId: -1001,
    text: "/status 1 Hoàn thành",
    from: { id: 111 } // Không phải admin
  });
  assert("Chặn người dùng thường đổi trạng thái", nonAdminRes.error === "UNAUTHORIZED");

  const adminRes = bot.processMessage({
    chatId: -1001,
    text: "/status 1 Đang phát triển",
    from: { id: 99999 } // Admin ID
  });
  assert("Admin cập nhật trạng thái thành công", adminRes.success && adminRes.newStatus === "Đang phát triển");

  console.log("\n------------------------------------------------------");
  console.log(`📊 KẾT QUẢ: ${passed} PASSED / ${failed} FAILED`);
  if (failed === 0) {
    console.log("🎉 TẤT CẢ CÁC KIỂM THỬ ĐÃ VƯỢT QUA 100%!");
  } else {
    console.error("❌ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH KIỂM THỬ.");
  }
  console.log("------------------------------------------------------\n");
}

runTests();
