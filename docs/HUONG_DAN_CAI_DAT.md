# 📖 HƯỚNG DẪN CÀI ĐẶT TOÀN DIỆN TOOLHUNT ENTERPRISE (A - Z)

Hướng dẫn từng bước triển khai hệ thống **ToolHunt Enterprise v3.0.0** kết hợp **Telegram Bot**, **Google Apps Script Serverless Backend**, **Google Sheets 6 Bảng Enterprise** và **Web Dashboard / Telegram Mini App**.

Toàn bộ quá trình chỉ mất khoảng **5 - 10 phút** và **hoàn toàn miễn phí trọn đời**.

---

## 📋 CÁC BƯỚC THỰC HIỆN

### BƯỚC 1: Tạo Google Sheet & Thêm Code Google Apps Script

1. Truy cập [Google Sheets](https://sheets.new) để tạo 1 bảng tính mới.
2. Đặt tên bảng tính: **`ToolHunt Enterprise - Quản Lý Ý Tưởng & Quỹ Thưởng Tool`**.
3. Trên thanh menu, chọn: **Tiện ích mở rộng (Extensions)** ➔ **Apps Script**.
4. Xóa toàn bộ nội dung mặc định trong file `Code.gs` và thay bằng toàn bộ nội dung trong file:
   * 📂 [`google-apps-script/Code.js`](../google-apps-script/Code.js)
5. Nhấn biểu tượng dấu **`+`** cạnh mục "Tệp" (Files) ➔ Chọn **Tập lệnh (Script)** ➔ Đặt tên là `SetupHelper` ➔ Dán toàn bộ nội dung file:
   * 📂 [`google-apps-script/SetupHelper.js`](../google-apps-script/SetupHelper.js)
6. Nhấn nút **Lưu (Save - biểu tượng đĩa mềm hoặc Ctrl + S)**.

---

### BƯỚC 2: Khởi Tạo Cấu Trúc 6 Sheet Enterprise Tự Động

1. Quay trở lại tab Google Sheet của bạn và **F5 (Tải lại trang)**.
2. Sau 2-3 giây, trên thanh menu của Google Sheet sẽ xuất hiện menu mới: **`🤖 Quản Lý ToolHunt Enterprise`**.
3. Nhấp vào menu **`🤖 Quản Lý ToolHunt Enterprise`** ➔ Chọn **`⚡ 1. Khởi tạo cấu trúc 6 Sheet Enterprise`**.
4. Lần đầu chạy, Google sẽ yêu cầu cấp quyền truy cập:
   * Chọn tài khoản Google của bạn ➔ Nhấn **Nâng cao (Advanced)** ➔ Chọn **Đi tới ... (Không an toàn)** ➔ Nhấn **Cho phép (Allow)**.
5. Sau khi cấp quyền, script sẽ tự động tạo đủ 6 sheet chuẩn hóa:
   * 📊 **`Ideas`** (17 cột): Lưu trữ ý tưởng, lượt vote, developer phụ trách, mốc tiến độ (milestones) và tổng quỹ bounty.
   * 🗳 **`Votes`** (5 cột): Lưu lịch sử bình chọn từng user để chống gian lận và hỗ trợ rút vote (toggle unvote).
   * 💰 **`Bounties`** (10 cột): Sổ cái tài trợ quỹ thưởng (VNĐ, Coffee ☕, USD, Points).
   * ⚙️ **`Config`** (3 cột): Chứa 10 khóa cấu hình hệ thống, AI Provider và API Keys.
   * 👑 **`Admins`** (5 cột): Quản lý danh sách phân quyền 4 cấp (Member, Developer, Manager, Admin).
   * 📝 **`AuditLogs`** (5 cột): Nhật ký kiểm toán toàn bộ hành vi trong hệ thống.

---

### BƯỚC 3: Điền Cấu Hình & API Keys Vào Sheet `Config`

Chuyển sang sheet **`Config`** và điền các giá trị:
1. **`BOT_TOKEN` (Bắt buộc):** Token HTTP API từ `@BotFather` (Ví dụ: `7123456789:AAHq_ABC...`).
2. **`AI_PROVIDER`:** Điền `deepseek` hoặc `gemini`.
3. **`AI_SIMILARITY_THRESHOLD`:** Điền `75` (hoặc ngưỡng mong muốn 0 - 100).
4. **`DEEPSEEK_API_KEY`:** API Key từ [DeepSeek Platform](https://platform.deepseek.com).
5. **`GEMINI_API_KEY`:** API Key miễn phí từ [Google AI Studio](https://aistudio.google.com).
6. **`COMMUNITY_GROUP_ID`:** ID nhóm Telegram cộng đồng (Ví dụ: `-1001234567890`).

---

### BƯỚC 4: Thiết Lập Quản Trị Viên Đầu Tiên Trong Sheet `Admins`

1. Chuyển sang sheet **`Admins`**.
2. Thêm dòng mới:
   - Cột A: Điền User ID Telegram của bạn (Lấy từ `@userinfobot`).
   - Cột B: `@username` của bạn.
   - Cột C: `Admin`
   - Cột D: `Active`
   - Cột E: Ngày hiện tại (Ví dụ: `28/08/2026`).

---

### BƯỚC 5: Triển Khai Web App (Deploy)

1. Tại cửa sổ Google Apps Script, nhìn lên góc trên bên phải ➔ Nhấn nút **Triển khai (Deploy)** ➔ Chọn **Triển khai mới (New deployment)**.
2. Bấm vào biểu tượng bánh răng ⚙️ cạnh "Chọn loại" ➔ Chọn **Ứng dụng web (Web app)**.
3. Điền các thông tin:
   * **Mô tả (Description):** `ToolHunt Enterprise Backend v3.0`
   * **Thực thi dưới dạng (Execute as):** `Tôi (email của bạn)`
   * **Ai có quyền truy cập (Who has access):** **`Bất kỳ ai (Anyone)`** *(Bắt buộc chọn Anyone để Webhook Telegram và Web Dashboard kết nối được)*.
4. Nhấn **Triển khai (Deploy)**.
5. Copy đường dẫn **URL ứng dụng web (Web app URL)** (dạng `https://script.google.com/macros/s/AKfycb.../exec`).

---

### BƯỚC 6: Đăng Ký Webhook Kết Nối Telegram Với Google Sheet

Bạn có thể chọn **1 trong 3 cách sau** để đăng ký Webhook:

#### Cách 1: Đăng ký trực tiếp trong Google Sheet (Nhanh nhất)
1. Tại Google Sheet, bấm menu **`🤖 Quản Lý ToolHunt Enterprise`** ➔ Chọn **`🔗 2. Đăng ký Telegram Webhook tự động`**.
2. Dán link Web app URL vừa copy ở Bước 5 vào hộp thoại ➔ Nhấn **OK**.
3. Màn hình báo `"Thành công!"` là xong!

#### Cách 2: Sử dụng Script CLI (Node.js hoặc Python)
Mở terminal tại thư mục dự án và chạy:
```bash
npm run setup
# hoặc:
npm run setup:py
```
Nhập Token và Webhook URL theo hướng dẫn trên màn hình.

#### Cách 3: Mở trình duyệt web
Dán URL sau vào thanh địa chỉ trình duyệt và nhấn Enter:
```text
https://api.telegram.org/bot<TOKEN_CỦA_BẠN>/setWebhook?url=<URL_WEB_APP_APPS_SCRIPT>
```
Nếu nhận được JSON `{"ok":true,"result":true,"description":"Webhook was set"}` là thành công!

---

### BƯỚC 7: Triển Khai Web Dashboard / Telegram Mini App

1. Mở thư mục `web-dashboard/`.
2. Bạn có thể deploy thư mục này lên **GitHub Pages**, **Vercel**, **Netlify** hoặc Cloudflare Pages hoàn toàn miễn phí.
3. Khi mở Web Dashboard, nhấn biểu tượng ⚙️ (Cài đặt) ở góc trên bên phải ➔ Dán Web App URL của Google Apps Script vào để kết nối trực tiếp với cơ sở dữ liệu Google Sheet!
4. Cấu hình Telegram Mini App Menu Button theo hướng dẫn tại [`docs/TELEGRAM_BOTFATHER.md`](./TELEGRAM_BOTFATHER.md).
