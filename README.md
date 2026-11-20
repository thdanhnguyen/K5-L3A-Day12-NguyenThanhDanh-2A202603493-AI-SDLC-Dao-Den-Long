# Đảo Đèn Lồng — Bình Minh (`v1.0.0` · Contract `v1.3`)

Game phiêu lưu 3D trên nền WebGL (Three.js + TypeScript) kể về **Mây**, người giữ đèn nhỏ tuổi cùng **Chim Giấy Đèn Lồng** vượt qua 3 Đêm (**Đảo Bến**, **Đảo Cau**, **Đảo Chuông**) để giữ các Đèn Lồng Lớn rực sáng trước bình minh.

## Yêu cầu hệ thống
- **Runtime:** Node.js `>= 20` (khuyến nghị `v22` / `v24`)
- **Trình duyệt:** Chrome, Microsoft Edge hoặc Chromium hỗ trợ WebGL2 (dùng để chơi và chạy chế độ benchmark `1280×720`)
- **Hệ điều hành:** Windows 10/11, macOS hoặc Linux

## Cài đặt & Chạy nhanh (3 lệnh)
```bash
npm ci
npm run build
node dist/cli/run.js
```
Sau đó mở `http://127.0.0.1:4173/` trên trình duyệt để chơi (hỗ trợ lưu Bảng xếp hạng trực tiếp xuống ổ đĩa tại `~/.dao-den-long/leaderboard.json`).

## Điều khiển mặc định (có thể đổi trong Cài đặt)
- `WASD` / `Phím mũi tên`: Di chuyển
- `Space`: Nhảy
- `Shift`: Lướt (`14 m/s` trong `0.2 s`, hồi `1.5 s`)
- `E`: Nạp đom đóm vào đèn / Châm dầu đèn đang sáng
- `Q` / `F`: Tỏa Sáng đẩy lùi Bóng Mực và lấy lại đom đóm từ Gió Lạc
- `H`: Gọi Chim Giấy Đèn Lồng bay chỉ đường tới đèn cần thắp/châm dầu
- `Esc` / `P`: Tạm dừng · `M`: Tắt/bật âm thanh · Kéo chuột / `J`/`L`: Xoay camera

## Lệnh kiểm thử, Benchmark, Soak & Leaderboard
- **Chạy toàn bộ unit & contract tests (31 tests):**
  ```bash
  npm test
  ```
- **Kiểm chứng đầy đủ Phase 4 (build + test + determinism 3 Đêm + soak 10 Đêm + export):**
  ```bash
  npm run verify
  ```
- **Chế độ Benchmark (`1280×720`, 200 Bóng Mực `wander` + 100 đom đóm, seed `42`):**
  ```bash
  node dist/cli/bench.js --seed 42 --duration 30 --out bench.json
  ```
  > **Lưu ý VSync & Bộ nhớ:** Benchmark tự khởi chạy Chromium/Edge/Chrome với `--window-size=1280,720 --disable-gpu-vsync --disable-frame-rate-limit` (có thể đặt biến môi trường `CHROME_BIN` để chỉ định trình duyệt). Trên một số trình duyệt/driver hệ điều hành, DWM/compositor vẫn có thể giới hạn khung hình ở tần số màn hình, và `peak_mem_mb` có thể là `null` nếu `performance.memory` không được trình duyệt bật.
- **Kiểm tra ổn định 10 Đêm liên tiếp (Soak test):**
  ```bash
  node dist/cli/soak.js --seed 7 --nights 10 --out soak.json
  ```
- **Xuất Bảng xếp hạng top 10:**
  ```bash
  node dist/cli/run.js --export-leaderboard out.json
  ```
- **Chạy Headless Simulation CLI:**
  ```bash
  node dist/headless/cli.js --seed 42 --night 1 --ticks 14400 --out run.jsonl
  ```

## Tài liệu liên quan
- [CHANGELOG.md](CHANGELOG.md) — Lịch sử thay đổi từ `v0.1.0` đến `v1.0.0`
- [CREDITS.md](CREDITS.md) — Tác giả, công cụ & thư viện
- [LICENSE](LICENSE) — Giấy phép MIT
- [docs/notes/retro.md](docs/notes/retro.md) — Tổng kết 4 Phase (Retrospective)
- [docs/proof/phase-4/SUMMARY.md](docs/proof/phase-4/SUMMARY.md) — Bằng chứng kiểm chứng Phase 4
