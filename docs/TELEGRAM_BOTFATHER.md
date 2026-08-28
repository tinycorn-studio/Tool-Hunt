# 🤖 HƯỚNG DẪN CẤU HÌNH TELEGRAM BOT VỚI @BOTFATHER

Tài liệu này hướng dẫn bạn cách tạo Bot, thiết lập lệnh gợi ý (`/idea`, `/top`, `/stats`), và gắn nút mở **Telegram Mini App** trực tiếp trên thanh menu của Bot.

---

## 1. Tạo Bot Mới & Lấy Token
1. Mở Telegram và tìm kiếm **`@BotFather`** (có tích xanh chính chủ).
2. Gõ lệnh: `/newbot`.
3. Nhập **Tên hiển thị** cho Bot (Ví dụ: `Cộng Đồng Tool & Ý Tưởng`).
4. Nhập **Username** cho Bot (Phải kết thúc bằng chữ `bot`, ví dụ: `AutoFillIdeaBot` hoặc `congdong_tool_bot`).
5. `@BotFather` sẽ gửi cho bạn **HTTP API Token** (Ví dụ: `7123456789:AAHq_ABCdef123456...`). Hãy lưu lại mã Token này!

---

## 2. Thiết Lập Danh Sách Lệnh Menu Gợi Ý (Bot Commands)
Để thành viên khi gõ dấu `/` sẽ hiện ra danh sách các lệnh mẫu:

1. Chat với `@BotFather`: gõ `/setcommands`.
2. Chọn Bot bạn vừa tạo.
3. Copy và dán toàn bộ đoạn sau vào chat:
```text
idea - Đăng ý tưởng tool mới (/idea [Tên] | [Mô tả])
top - Xem Top ý tưởng được quan tâm nhất
myideas - Xem danh sách ý tưởng bạn đã đăng
stats - Xem thống kê hoạt động cộng đồng
help - Hướng dẫn sử dụng chi tiết
```
4. `@BotFather` báo `Success! commands updated.` là hoàn thành.

---

## 3. Cấu Hình Quyền Hoạt Động Trong Nhóm (Group Privacy)
Mặc định Telegram Bot ở chế độ riêng tư (Privacy Mode) và không đọc được tin nhắn trong nhóm:

1. Chat với `@BotFather`: gõ `/setprivacy`.
2. Chọn Bot của bạn.
3. Chọn **`Disable`** (Tắt Privacy mode để bot đọc được lệnh `/idea` từ mọi thành viên trong group).

---

## 4. Gắn Nút Mở Mini App Vào Menu Bot (Tùy chọn)
Nếu bạn muốn có nút bấm **"🌐 Bảng Ý Tưởng"** ở góc dưới bên trái khung chat của Bot:

1. Chat với `@BotFather`: gõ `/setmenubutton`.
2. Chọn Bot của bạn.
3. Chọn **`Configure menu button`**.
4. Nhập URL của Web Dashboard (đã deploy lên GitHub Pages hoặc Vercel, ví dụ: `https://your-domain.github.io/web-dashboard/`).
5. Nhập tên nút hiển thị: `💡 Bảng Ý Tưởng`.
6. Xong! Người dùng bấm vào nút Menu sẽ mở Mini App ngay lập tức!
