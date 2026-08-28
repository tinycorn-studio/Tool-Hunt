# 🤖 HƯỚNG DẪN CẤU HÌNH TELEGRAM BOT VỚI @BOTFATHER

Tài liệu này hướng dẫn bạn cách tạo Bot Telegram, thiết lập danh sách lệnh gợi ý đầy đủ cho ToolHunt Enterprise (`/idea`, `/bounty`, `/claim`, `/unclaim`, `/top`, `/stats`, `/status`), tắt chế độ riêng tư trong nhóm (Privacy Mode), và gắn nút mở **Telegram Mini App** trực tiếp trên thanh menu của Bot.

---

## 1. Tạo Bot Mới & Lấy Token

1. Mở Telegram và tìm kiếm **`@BotFather`** (có dấu tích xanh chính chủ của Telegram).
2. Gõ lệnh: `/newbot`.
3. Nhập **Tên hiển thị** cho Bot (Ví dụ: `ToolHunt Enterprise Bot`).
4. Nhập **Username** cho Bot (Phải kết thúc bằng chữ `bot`, ví dụ: `ToolHuntEnterpriseBot` hoặc `tool_hunt_bot`).
5. `@BotFather` sẽ gửi cho bạn **HTTP API Token** (Ví dụ: `7123456789:AAHq_ABCdef123456...`). Hãy lưu lại mã Token này để điền vào sheet `Config`.

---

## 2. Thiết Lập Danh Sách Lệnh Menu Gợi Ý (Bot Commands)

Để thành viên khi gõ dấu `/` trong khung chat hiện ra đầy đủ danh mục các lệnh của ToolHunt Enterprise:

1. Chat với `@BotFather`: gõ `/setcommands`.
2. Chọn Bot bạn vừa tạo.
3. Copy và dán toàn bộ đoạn cấu hình sau vào khung chat:
```text
idea - Đăng ý tưởng tool mới (/idea [Tên] | [Mô tả])
bounty - Tài trợ / treo thưởng (/bounty [ID] [Số lượng] [Đơn vị] [Lời nhắn])
claim - Lập trình viên nhận làm tool (/claim [ID])
unclaim - Hủy nhận làm tool (/unclaim [ID])
top - Xem Top ý tưởng được cộng đồng quan tâm nhất
myideas - Xem danh sách ý tưởng bạn đã đăng
stats - Xem thống kê hoạt động cộng đồng & quỹ thưởng
status - Quản trị viên cập nhật tiến độ (/status [ID] [Trạng thái])
help - Hướng dẫn sử dụng chi tiết
```
4. `@BotFather` báo `Success! commands updated.` là hoàn thành.

---

## 3. Cấu Hình Quyền Hoạt Động Trong Nhóm (Group Privacy)

Mặc định Telegram Bot ở chế độ riêng tư (Privacy Mode Enabled) và chỉ đọc được các tin nhắn có tag `@bot`. Để bot đọc được lệnh `/idea` và tương tác mượt mà trong nhóm cộng đồng:

1. Chat với `@BotFather`: gõ `/setprivacy`.
2. Chọn Bot của bạn.
3. Chọn **`Disable`** (Tắt Privacy mode để bot lắng nghe được các lệnh từ mọi thành viên trong group).

---

## 4. Gắn Nút Mở Telegram Mini App Vào Menu Bot

Để tạo nút bấm **"🌐 Bảng Ý Tưởng"** thường trực ở góc dưới bên trái khung chat của Bot:

1. Chat với `@BotFather`: gõ `/setmenubutton`.
2. Chọn Bot của bạn.
3. Chọn **`Configure menu button`**.
4. Nhập URL của Web Dashboard (đã deploy lên GitHub Pages hoặc Vercel, ví dụ: `https://your-domain.github.io/web-dashboard/`).
5. Nhập tên nút hiển thị: `💡 Bảng Ý Tưởng`.
6. Xong! Khi người dùng mở chat với Bot, chỉ cần nhấn nút Menu là Telegram Mini App sẽ mở ra với đầy đủ giao diện bình chọn, nhận task và treo thưởng!
