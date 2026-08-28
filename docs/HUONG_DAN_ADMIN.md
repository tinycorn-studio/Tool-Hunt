# 👑 HƯỚNG DẪN QUẢN TRỊ & VẬN HÀNH HỆ THỐNG

Tài liệu dành cho Quản trị viên (Admin / Moderator) để quản lý luồng ý tưởng, thay đổi trạng thái phát triển và trích xuất báo cáo.

---

## 1. Phân Quyền Quản Trị Viên (Admin)

Để cấp quyền Admin cho một thành viên:
1. Mở file Google Sheet ➔ Chọn sheet **`Admins`**.
2. Thêm một dòng mới:
   * **Cột A (User ID Telegram):** Điền Telegram User ID của người đó (Ví dụ: `123456789`). Có thể lấy ID qua bot `@userinfobot`.
   * **Cột B (Username / Tên):** `@username`
   * **Cột C (Vai Trò):** `Admin` hoặc `Moderator`
   * **Cột D (Ngày Thêm):** Ngày hiện tại

---

## 2. Quản Lý Vòng Đời Ý Tưởng (Status Lifecycle)

Mỗi ý tưởng sẽ trải qua các giai đoạn:

```
[⏳ Đang lấy ý kiến] ➔ [🔍 Đang duyệt] ➔ [🚀 Đang phát triển] ➔ [✅ Đã hoàn thành]
                                      └── [❌ Từ chối / Tạm hoãn]
```

### Cách 1: Đổi trạng thái trực tiếp bằng lệnh Telegram (Chỉ Admin)
Trong nhóm hoặc trong chat riêng với bot, Admin gõ lệnh:
```text
/status [ID_Ý_TƯỞNG] [TRẠNG_THÁI_MỚI]
```
*Ví dụ:*
* `/status 1 Đang phát triển`
* `/status 3 Đã hoàn thành`
* `/status 5 Tạm hoãn (Chưa khả thi)`

### Cách 2: Đổi trạng thái trực tiếp trên Google Sheet
1. Mở sheet **`Ideas`**.
2. Tìm đến dòng của ý tưởng cần đổi.
3. Sửa giá trị tại **Cột K (`Trạng Thái`)**.
4. Dữ liệu trên Web Dashboard và Mini App sẽ tự động đồng bộ theo giá trị mới!

---

## 3. Các Lệnh Quản Trị Hữu Ích

| Lệnh | Chức năng | Ai được dùng |
| :--- | :--- | :--- |
| `/idea [Tên] \| [Mô tả]` | Đề xuất ý tưởng tool mới | Tất cả thành viên |
| `/top` | Xem Top 5 ý tưởng có số vote cao nhất | Tất cả thành viên |
| `/myideas` | Xem danh sách ý tưởng cá nhân đã gửi | Tất cả thành viên |
| `/stats` | Xem báo cáo tổng số ý tưởng & lượt vote | Tất cả thành viên |
| `/status [ID] [Status]` | Cập nhật trạng thái phát triển | **Chỉ Admin** |
| `/help` | Xem bảng hướng dẫn các lệnh | Tất cả thành viên |

---

## 4. Xử Lý Khi Có Trùng Lặp Hoặc Gian Lận Vote

* **Cơ chế chống gian lận tự động:** Hệ thống kiểm tra từng lượt click vào sheet `Votes`. Nếu cùng 1 `User ID` bấm vào cùng 1 `Idea ID`, hệ thống sẽ tự động chuyển thành **Rút lại vote (Unvote)** hoặc từ chối cộng thêm điểm.
* **Xóa ý tưởng vi phạm:** Nếu có ý tưởng spam hoặc không phù hợp, Admin chỉ cần xóa dòng tương ứng trong sheet `Ideas`.
