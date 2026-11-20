# Changelog — Đảo Đèn Lồng

Tất cả các thay đổi đáng chú ý của dự án được ghi lại theo chuẩn Keep a Changelog và Semantic Versioning.

## [1.0.0] - 2026-11-20 (Phase 4 · Contract v1.3 · `phase-4`)

### Added
- **Chế độ Benchmark (`bench_cmd`):** `node dist/cli/bench.js --seed 42 --duration 30 --out bench.json` mở cửa sổ `1280×720` không toàn màn hình, tắt vsync nếu trình duyệt cho phép, tải Đêm 1 với 200 Bóng Mực (`wander`) + 100 đom đóm, `L1–L3` sáng ở `fuel = 100`, camera quay vòng tròn bán kính `30 m` ở `Y = 15 m` mỗi `15 s`, khởi động `3 s` rồi đo đúng `--duration` giây và xuất `bench.json`.
- **Kiểm tra ổn định dài hạn (`soak_cmd`):** `node dist/cli/soak.js --seed 7 --nights 10 --out soak.json` chạy 10 Đêm liên tiếp (`1→2→3`) trong một tiến trình với input ngẫu nhiên xác định (`Mulberry32`), ghi `mem_start_mb`, `mem_end_mb`, `crashes`, `results`, `duration_s`.
- **Bảng xếp hạng địa phương (Local Leaderboard):** Lưu top 10 trên ổ đĩa (`~/.dao-den-long/leaderboard.json`) kèm form nhập tên `[A-Za-z0-9_]{3,12}` sau Bình Minh (thắng Đêm 3) hoặc khi thua; xem từ Menu chính và xuất JSON qua `node dist/cli/run.js --export-leaderboard <out.json>`.
- **Trợ năng (Accessibility):**
  - Đổi phím điều khiển (9 hành động) có cảnh báo phím trùng và nút khôi phục mặc định.
  - Phụ đề trực quan cho sự kiện Bóng Mực xuất hiện (kèm mũi tên mép màn hình), cảnh báo Gió mạnh, đếm ngược `10 s` cuối và đèn sắp cạn dầu (`< 30`).
  - Tùy chọn Giảm chuyển động (tắt rung camera và hiệu ứng nhấp nháy).
  - Cỡ chữ giao diện mặc định `>= 18px` ở `1280×720` và tùy chọn Chữ lớn (`×1.25`).
- **Tài liệu & Phát hành:** Hoàn thiện `README.md`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE` (MIT), `docs/notes/retro.md` và `docs/proof/phase-4/SUMMARY.md`.

## [0.3.0] - 2026-11-20 (Phase 3 · Contract v1.2 · `phase-3`)

### Changed
- **Luật Đèn cạn dầu (`[THAY THẾ]`):** Đèn sáng có `fuel = 100`, hao `1.0/s` (`1/60` mỗi tick), hết dầu thì tắt (`lantern_out`, `ever_lit = true`), thắp lại tốn `5` đom đóm; tương tác đèn đang sáng sẽ châm dầu (`+10` mỗi đom đóm, bỏ qua đèn đầy).
- **Điều kiện thắng mới:** Giữ `>= ceil(0.6 * số đèn)` sáng khi hết giờ (bình minh) để thắng Đêm; thêm cơ chế Bóng Mực rút dầu (`drain`, `5/s`) khi đèn có `fuel < 30`.
- **Sức chứa linh hoạt:** Bắt đầu `10`, tăng `+2` mỗi lần thắp/thắp lại đèn, tối đa `20`.

## [0.2.0] - 2026-11-20 (Phase 2 · Contract v1.1 · `phase-2`)

### Added
- **3 Đêm & 3 hòn đảo:** Đêm 1 (Đảo Bến, 5 đèn, 240s), Đêm 2 (Đảo Cau, 6 đèn, 300s, địa hình dốc + Gió Lạc), Đêm 3 (Đảo Chuông, 7 đèn, 360s, Gió mạnh + Bệ phóng gió + Bùa gió).
- **Cơ chế Lướt (Dash):** `14 m/s` trong `0.2 s`, hồi chiêu `1.5 s`, giữ nguyên độ cao khi lướt trên không.
- **Sáng tạo mở rộng (tắt ở chế độ headless/bench/soak):** Bé Lạc trong rừng, Chim Giấy Đèn Lồng chỉ đường (`H`), Bóng Mực Lớn/Nhỏ, đom đóm màu buff.

## [0.1.0] - 2026-11-20 (Phase 1 · Contract v1.0 · `phase-1`)

### Added
- Nguyên mẫu 3D đầu tiên với nhân vật **Mây**, 5 Đèn Lồng Lớn trên Đảo Bến, thu thập đom đóm, né và tỏa sáng xua Bóng Mực, HUD, âm thanh WebAudio tổng hợp và CLI headless xác định (`Mulberry32`).
