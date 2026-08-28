# 👑 HƯỚNG DẪN QUẢN TRỊ & VẬN HÀNH TOOLHUNT ENTERPRISE

Tài liệu hướng dẫn chuyên sâu dành cho Quản trị viên (Admin) và Người điều phối (Manager) quản lý hệ thống phân quyền 4 cấp độ (RBAC), kiểm soát vòng đời phát triển của Developer, cấu hình AI Duplicate Detection, quản lý sổ cái quỹ thưởng Bounty và nhật ký kiểm toán.

---

## 1. Hệ Thống Phân Quyền Doanh Nghiệp 4 Cấp (4-Tier RBAC)

Hệ thống ToolHunt Enterprise áp dụng mô hình phân quyền chặt chẽ:

```
┌─────────────────────────────────────────────────────────────┐
│ 👑 Admin (Quản trị viên tối cao)                            │
│ └── Toàn quyền hệ thống, override mọi trạng thái, config   │
├─────────────────────────────────────────────────────────────┤
│ 👔 Manager (Người điều phối dự án)                          │
│ └── Điều phối ý tưởng, duyệt trạng thái, quản lý quỹ thưởng│
├─────────────────────────────────────────────────────────────┤
│ 🛠 Developer (Lập trình viên)                               │
│ └── Nhận task (claim), cập nhật tiến độ, ra mắt Beta / Done │
├─────────────────────────────────────────────────────────────┤
│ 👤 Member (Thành viên cộng đồng)                            │
│ └── Đăng ý tưởng, Upvote/Unvote, tài trợ Bounty, test Beta  │
└─────────────────────────────────────────────────────────────┘
```

### Chi tiết quyền hạn từng vai trò:

| Vai trò | Lệnh & Thao tác được phép | Quyền hạn đặc biệt |
| :--- | :--- | :--- |
| **Admin** | Toàn bộ lệnh bot (`/idea`, `/top`, `/claim`, `/unclaim`, `/status`, `/bounty`), truy cập toàn bộ menu Google Sheet | Thay đổi cấu hình `Config`, phân quyền `Admins`, ép đổi trạng thái bất kỳ ý tưởng nào (Override authority) |
| **Manager** | `/status`, `/claim`, `/unclaim` (bất kỳ task nào), duyệt giải ngân Bounty | Điều phối task giữa các Developer, xem nhật ký kiểm toán `AuditLogs` |
| **Developer** | `/claim` (task mở), `/unclaim` (task của chính mình), nút `[ 🧪 Lên Beta ]`, `[ ✅ Hoàn thành ]`, cập nhật mốc `Milestones` | Được ghi nhận tên và ID lên bài đăng và Dashboard |
| **Member** | `/idea` (kèm AI check), `/bounty` (tài trợ quỹ), Upvote/Unvote, nhận tin nhắn trải nghiệm Beta | Đề xuất ý tưởng mới và bình chọn |

---

## 2. Quản Lý Danh Sách & Phân Quyền Trong Sheet `Admins`

Để cấp quyền hoặc thay đổi vai trò của thành viên:
1. Mở Google Sheet ➔ Chọn sheet **`Admins`**.
2. Nhập thông tin theo cấu trúc 5 cột:
   * **Cột A (`User ID Telegram`):** Telegram User ID (Số nguyên, ví dụ: `123456789`). Lấy qua bot `@userinfobot`.
   * **Cột B (`Username / Tên`):** `@username` hoặc họ tên thành viên.
   * **Cột C (`Vai Trò`):** `Admin`, `Manager`, `Developer` hoặc `Member`.
   * **Cột D (`Trạng Thái`):** `Active` (hoạt động) hoặc `Inactive` (tạm khóa quyền).
   * **Cột E (`Ngày Thêm`):** Ngày cấp quyền (ví dụ: `28/08/2026`).

---

## 3. Quản Lý Vòng Đời Ý Tưởng & Developer FSM

Ý tưởng trải qua máy trạng thái hữu hạn (FSM) gồm 4 giai đoạn chính:

```
[⏳ Đang lấy ý kiến] ──(claim_task)──> [🚀 Đang phát triển]
[🚀 Đang phát triển] ──(devbeta)──────> [🧪 Beta Testing] (Kích hoạt R3 Thông báo Voters)
[🧪 Beta Testing] ───(devdone)──────> [✅ Hoàn thành] (Kích hoạt R3 & Mở khóa Bounty)
[🚀 Đang phát triển] ──(unclaim)──────> [⏳ Đang lấy ý kiến] (Nhả task)
```

### Cách thức điều chỉnh trạng thái:
1. **Lập trình viên phụ trách:**
   - Dùng nút bấm Inline trên Telegram hoặc Web Dashboard: `[ 🧪 Ra mắt Beta ]`, `[ ✅ Hoàn thành ]`, `[ ❌ Hủy nhận ]`.
2. **Admin / Manager:**
   - Dùng lệnh Telegram: `/status [ID] [Trạng thái mới]` (ví dụ: `/status 1 Beta Testing`).
   - Hoặc chỉnh sửa trực tiếp tại Cột 11 (`Trạng Thái`) trong sheet `Ideas`.

---

## 4. Cấu Hình & Tinh Chỉnh AI Duplicate Detection (R1)

Tại sheet **`Config`**, Admin có thể tinh chỉnh các thông số AI:

1. **`AI_PROVIDER`:**
   - `deepseek`: Sử dụng mô hình DeepSeek Chat (khuyên dùng vì độ chính xác ngữ nghĩa cao và chi phí cực rẻ).
   - `gemini`: Sử dụng Google Gemini 1.5 Flash (miễn phí qua Google AI Studio).
2. **`AI_SIMILARITY_THRESHOLD`:**
   - Mặc định: `75` (Ngưỡng % tương đồng kích hoạt cảnh báo trùng).
   - Đặt `65` - `70` nếu muốn hệ thống cảnh báo nhạy hơn (chặn trùng chặt chẽ).
   - Đặt `80` - `85` nếu muốn cho phép nhiều ý tưởng có nét tương đồng được đăng.
3. **`DEEPSEEK_API_KEY` & `GEMINI_API_KEY`:**
   - Điền API Key tương ứng. Hệ thống tự động kích hoạt chế độ Failover: nếu DeepSeek quá tải hoặc lỗi 500, hệ thống tự động chuyển sang Gemini Flash để không làm gián đoạn người dùng.

---

## 5. Quản Lý Quỹ Thưởng Tool (Bounty Ledger - R4)

Toàn bộ các khoản đóng góp được theo dõi minh bạch trong sheet **`Bounties`**:
- Cột A: Thời gian giao dịch.
- Cột B: Bounty ID tự tăng.
- Cột C: Idea ID được tài trợ.
- Cột D & E: User ID và Username người tài trợ.
- Cột F & G: Số lượng và đơn vị (`VND`, `COFFEE`, `USD`, `POINTS`).
- Cột H: Lời nhắn tài trợ.
- Cột I: Trạng thái:
  * `PLEDGED`: Đã cam kết tài trợ trên hệ thống.
  * `PAID`: Đã nhận tiền vào tài khoản quỹ cộng đồng.
  * `RELEASED`: Đã giải ngân/trao thưởng cho Developer khi ý tưởng chuyển sang `Hoàn thành`.
  * `CANCELLED`: Giao dịch bị hủy.

---

## 6. Nhật Ký Kiểm Toán (Audit Logs - R5)

Sheet **`AuditLogs`** tự động ghi nhận mọi hành vi quan trọng để phục vụ hậu kiểm:
* `CREATE_IDEA` / `FORCE_CREATE_IDEA`
* `UPVOTE` / `UNVOTE`
* `CLAIM_TASK` / `UNCLAIM_TASK`
* `DEV_STATUS_TRANSITION`
* `PLEDGE_BOUNTY`
* `UPDATE_STATUS`

Admin có thể tra cứu nhanh lịch sử thay đổi, thời gian, người thực hiện và chi tiết tác vụ khi cần đối soát.
