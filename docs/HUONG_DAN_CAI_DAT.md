# 📖 HƯỚNG DẪN CÀI ĐẶT TOÀN DIỆN (A - Z)

Hướng dẫn từng bước triển khai hệ thống **Telegram Community Idea Bot & Google Sheets**. Toàn bộ quá trình chỉ mất khoảng **5 - 10 phút** và **hoàn toàn miễn phí trọn đời**.

---

## 📋 CÁC BƯỚC THỰC HIỆN

### BƯỚC 1: Tạo Google Sheet & Thêm Code Google Apps Script

1. Truy cập [Google Sheets](https://sheets.new) để tạo 1 bảng tính mới.
2. Đặt tên bảng tính: **`Quản Lý Ý Tưởng Tool Cộng Đồng`**.
3. Trên thanh menu, chọn: **Tiện ích mở rộng (Extensions)** ➔ **Apps Script**.
4. Xóa toàn bộ nội dung mặc định trong file `Code.gs` và thay bằng toàn bộ nội dung trong file:
   * 📂 [`google-apps-script/Code.js`](../google-apps-script/Code.js)
5. Nhấn biểu tượng dấu **`+`** cạnh mục "Tệp" (Files) ➔ Chọn **Tập lệnh (Script)** ➔ Đặt tên là `SetupHelper` ➔ Dán toàn bộ nội dung file:
   * 📂 [`google-apps-script/SetupHelper.js`](../google-apps-script/SetupHelper.js)
6. Nhấn nút **Lưu (Save - biểu tượng đĩa mềm hoặc Ctrl + S)**.

---

### BƯỚC 2: Khởi Tạo Cấu Trúc Bảng Tính Tự Động

1. Quay trở lại tab Google Sheet của bạn và **F5 (Tải lại trang)**.
2. Sau 2-3 giây, trên thanh menu của Google Sheet sẽ xuất hiện menu mới: **`🤖 Quản Lý Bot Telegram`**.
3. Nhấp vào menu **`🤖 Quản Lý Bot Telegram`** ➔ Chọn **`⚡ 1. Khởi tạo cấu trúc các Sheet`**.
4. Lần đầu chạy, Google sẽ yêu cầu cấp quyền:
   * Chọn tài khoản Google của bạn ➔ Nhấn **Nâng cao (Advanced)** ➔ Chọn **Đi tới ... (Không an toàn)** ➔ Nhấn **Cho phép (Allow)**.
5. Sau khi cấp quyền, script sẽ tự động tạo 4 sheet:
   * 📊 **`Ideas`**: Lưu trữ toàn bộ ý tưởng và số lượt vote.
   * 🗳 **`Votes`**: Lưu lịch sử từng lượt vote để chống gian lận.
   * ⚙️ **`Config`**: Nơi lưu BOT_TOKEN và các cài đặt.
   * 👑 **`Admins`**: Danh sách Admin quản trị.
6. Chuyển sang sheet **`Config`**: Điền **Bot Token** của bạn vào ô **B2** (`BOT_TOKEN`).

---

### BƯỚC 3: Triển Khai Web App (Deploy)

1. Tại cửa sổ Google Apps Script, nhìn lên góc trên bên phải ➔ Nhấn nút **Triển khai (Deploy)** ➔ Chọn **Triển khai mới (New deployment)**.
2. Bấm vào biểu tượng bánh răng ⚙️ cạnh "Chọn loại" ➔ Chọn **Ứng dụng web (Web app)**.
3. Điền các thông tin:
   * **Mô tả (Description):** `Telegram Idea Bot v2`
   * **Thực thi dưới dạng (Execute as):** `Tôi (email của bạn)`
   * **Ai có quyền truy cập (Who has access):** **`Bất kỳ ai (Anyone)`** *(Bắt buộc chọn Anyone để Telegram gửi webhook được)*.
4. Nhấn **Triển khai (Deploy)**.
5. Copy đường dẫn **URL ứng dụng web (Web app URL)** (dạng `https://script.google.com/macros/s/AKfycb.../exec`).

---

### BƯỚC 4: Đăng Ký Webhook Kết Nối Telegram Với Google Sheet

Bạn có thể chọn **1 trong 3 cách sau** để đăng ký Webhook:

#### Cách 1: Đăng ký trực tiếp trong Google Sheet (Nhanh nhất)
1. Tại Google Sheet, bấm menu **`🤖 Quản Lý Bot Telegram`** ➔ Chọn **`🔗 2. Đăng ký Webhook tự động`**.
2. Dán link Web app URL vừa copy ở Bước 3 vào hộp thoại ➔ Nhấn **OK**.
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

### BƯỚC 5: Thêm Bot Vào Nhóm Telegram & Bắt Đầu Sử Dụng

1. Mở nhóm Telegram cộng đồng của bạn.
2. Thêm Bot vào nhóm và cấp quyền **Quản trị viên (Admin)**.
3. Test thử bằng cách gửi tin nhắn:
   ```text
   /idea Tool Tự Động Quét Email | Tự lọc hóa đơn trong Gmail đẩy về Sheet
   ```
4. Bot sẽ đăng ngay bài bình chọn với nút **`👍 Upvote (0)`** và **`ℹ️ Chi tiết`**!
