# Changelog

## [phase-3] — Contract v1.2 ("Đèn cạn dầu")

### Breaking Changes (`[THAY THẾ]` từ Phase 1–2)
- **Contract version:** `1.1` → `1.2`.
- **Luật thắng:** Bỏ thắng sớm khi thắp hết đèn (`game_over.reason = "all_lit"` không còn dùng). Người chơi phải sống sót tới bình minh với ít nhất `ceil(0.6 × tổng đèn)` đèn đang sáng (`3/5` Đêm 1, `4/6` Đêm 2, `5/7` Đêm 3) để thắng với `reason = "dawn_survived"`.
- **Thời lượng Đêm:** Đêm 1 / 2 / 3 đổi từ `300 / 330 / 360 s` thành **`240 / 270 / 300 s`**.
- **Nhiên liệu đèn (`fuel`):** Đèn sáng bắt đầu ở `fuel = 100`, hao `1.0/s`; hết dầu sẽ tắt (`lantern_out`), nhớ `ever_lit = true` và chỉ cần `5` đom đóm để thắp lại. Đèn sáng chưa đầy dầu nhận thêm đom đóm (`refuel`).
- **Vùng an toàn & Bóng Mực `drain`:** Đèn sáng có `fuel < 30` mất vùng an toàn; Bóng Mực `wander` có thể tiến tới `≤ 2m` và chuyển trạng thái mới `drain` (hút `5 fuel/s`, phát `fuel_drain` mỗi `60` tick).
- **Công thức điểm mới:**
  - Nạp/châm đom đóm (`per_mote`): `10` → **`5`**.
  - Thắp lại (`ever_lit`): **`+40`** (thắp lần đầu giữ `+100`).
  - Tỏa Sáng trúng Bóng Mực đang `drain`: **`+15`** (trạng thái khác giữ `+5`).
  - Bỏ thưởng thời gian còn lại (`per_second_left = 0`); thay bằng thưởng bình minh khi thắng: **`+50 + floor(fuel)`** mỗi đèn đang sáng và `+50` mỗi Ngọn Lửa còn lại.
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 × successful_lights)` mỗi Đêm.
- **Snapshot & Scenario v1.2:** Snapshot thêm `player.capacity` và `lanterns[].{fuel, ever_lit, relit_count}`; scenario thêm `lanterns[].{lit, fuel, ever_lit}`, `player.successful_lights`, `shades[].target_lantern_id`.

### Added
- Chế độ mù màu (**"Bảng màu dễ phân biệt"**) lưu trong `localStorage` (Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` + `⚠`, đèn tắt xẹp `20%` & có vết rách giấy, thanh dầu + nhấp nháy `1 Hz` khi `fuel < 30`).
- Ghi chú thiết kế [ADR-001](docs/notes/adr-001-lantern-fuel-and-dawn.md).

## [phase-2] — Contract v1.1 ("Ba hòn đảo")
- Chuẩn hóa số liệu, 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), Lướt (`dash`), Gió Lạc (`drifter`), Bùa Gió (`charm`), Tạm dừng (`pause`), Gió mạnh Đêm 3, Cài đặt, Âm thanh & HUD đầy đủ.

## [phase-1] — Contract v1.0 ("Đảo Đèn Lồng")
- Bản chơi được Đêm 1, headless CLI 60Hz, Bé Lạc, Chim Giấy Đèn Lồng, Bóng Mực Lớn/Nhỏ, đom đóm đa sắc.
