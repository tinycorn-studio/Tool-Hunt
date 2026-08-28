# Original User Request

## Initial Request — 2026-08-28T10:41:21Z

ToolHunt Enterprise: Mở rộng hệ thống quản lý và bình chọn ý tưởng công nghệ ToolHunt lên cấp độ chuyên nghiệp dành cho doanh nghiệp và cộng đồng công nghệ, tích hợp AI Duplicate Detection (hỗ trợ DeepSeek & Gemini), Developer Task Claiming, Targeted Beta Notifications và Quỹ thưởng Tool Bounty.

Working directory: d:/Profile/AutoFillSheet
Integrity mode: development

## Requirements

### R1. AI Duplicate Detection (Harnessing DeepSeek & Gemini)
- Tích hợp lớp kiểm tra ngữ nghĩa thông minh bằng AI (hỗ trợ linh hoạt DeepSeek API hoặc Google Gemini API miễn phí) khi thành viên gửi ý tưởng mới qua bot hoặc Mini App.
- Tự động đối chiếu ý tưởng mới với cơ sở dữ liệu các ý tưởng hiện có trong Google Sheets.
- Nếu phát hiện độ tương đồng cao (trên ngưỡng cấu hình), bot đưa ra cảnh báo và danh sách các ý tưởng liên quan kèm nút dồn vote nhanh hoặc xác nhận tiếp tục tạo mới.

### R2. Developer Task Claiming & Workflow Lifecycle
- Bổ sung nút hành động [ 🛠 Nhận làm tool ] (Claim Task) trên tin nhắn Telegram, Web Dashboard và Mini App.
- Cho phép lập trình viên nhận phụ trách phát triển ý tưởng:
  - Cập nhật trạng thái trực quan: 🚀 Đang phát triển bởi @username.
  - Lưu trữ thông tin phân công, ngày bắt đầu và tiến độ mốc (Milestones) vào Google Sheet.
  - Hỗ trợ đổi trạng thái sang 🧪 Beta Testing, ✅ Hoàn thành hoặc nhả task (Hủy nhận).

### R3. Targeted Beta Tester Notifications
- Tự động trích xuất danh sách tất cả người dùng (User IDs) đã từng Upvote cho một ý tưởng cụ thể từ sheet Votes.
- Khi ý tưởng chuyển sang trạng thái 🧪 Beta Testing hoặc ✅ Hoàn thành, bot kích hoạt gửi tin nhắn thông báo tự động (Targeted Direct Message / Mention) đến đúng nhóm người dùng đã quan tâm này kèm link trải nghiệm và form đánh giá.

### R4. Tool Bounty & Crowdfunding Mechanism
- Cung cấp tính năng đặt hàng / treo thưởng (Bounty: ngân sách, điểm thưởng, coffee ☕) cho các ý tưởng tool quan trọng.
- Hiển thị huy hiệu Bounty và tổng giá trị thưởng nổi bật trên bài đăng Telegram và Web Dashboard.
- Quản lý nhật ký đóng góp quỹ và phân bổ thưởng vào sheet Bounties.

### R5. Enterprise Architecture & Dual-Platform Sync
- Nâng cấp cấu trúc dữ liệu Google Sheets (Ideas, Votes, Bounties, Admins, Config) và REST API đáp ứng phân quyền doanh nghiệp (Member, Developer, Manager, Admin).
- Đồng bộ toàn bộ cập nhật lên giao diện Web Dashboard / Telegram Mini App, bộ kiểm thử Unit Tests và kho mã nguồn GitHub https://github.com/tinycorn-studio/Tool-Hunt.git.

## Acceptance Criteria

### Automated Verification & Simulation
- [ ] Bộ kiểm thử tự động test_simulator.js mở rộng kiểm tra thành công 100% các kịch bản:
  - AI semantic similarity detection (nhận diện chính xác ý tưởng trùng và không trùng).
  - Luồng Developer Claim task, cập nhật tiến độ và nhả task.
  - Luồng lọc danh sách voters và kích hoạt Targeted Notifications.
  - Luồng tạo mới, tích lũy Bounty và hiển thị tổng quỹ.
- [ ] Backend Google Apps Script (Code.js) xử lý đầy đủ các Callback actions, Webhook events và API endpoints mới mà không phát sinh lỗi runtime.
- [ ] Web Dashboard (index.html, app.js, styles.css) hiển thị đầy đủ thông tin Developer phụ trách, huy hiệu Bounty và nút Claim Task tương tác mượt mà.
- [ ] Toàn bộ mã nguồn mới, tài liệu hướng dẫn (README.md, docs/) được cập nhật và đẩy lên nhánh main của repository GitHub https://github.com/tinycorn-studio/Tool-Hunt.git.
