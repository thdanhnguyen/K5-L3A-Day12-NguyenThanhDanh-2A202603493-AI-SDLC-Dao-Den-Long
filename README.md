# Đảo Đèn Lồng — Bình Minh (`v1.0.0` · Contract `v1.3`)

**Link release:** https://github.com/thdanhnguyen/K5-L3-Day12-NguyenThanhDanh-2A202603493-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0

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

## Sáng tạo của tôi
Toàn bộ phần sáng tạo chỉ kích hoạt khi `options.creative === true` (chơi trên trình duyệt) và **tự động tắt hoàn toàn (`creative: false`)** trong Headless CLI, Benchmark và Soak test để không làm đổi bất kỳ số liệu hay đầu ra Test Contract nào:
1. **Nhân vật phụ Bé Lạc trong rừng (`src/sim/creative.ts`):** Đi lạc trên đảo với đèn lồng xanh ngọc; khi Mây tìm thấy sẽ tặng ngay **+5 đom đóm** (kèm âm thanh và thông báo HUD).
2. **Chim Giấy Đèn Lồng chỉ đường (phím `H`, `src/render/entities.ts`):** Gấp bằng giấy phát sáng bay vòng quanh nón lá của Mây; bấm `H` chim sẽ bay vút về phía chiếc đèn gần nhất cần thắp hoặc châm dầu, tỏa vòng sáng định vị.
3. **Biến thể Bóng Mực Lớn / Nhỏ & Đom đóm đa sắc (`src/sim/creative.ts`):**
   - **Đom đóm Hồng ngọc (Ruby):** Cường hóa Tỏa Sáng trong `8 s` (tăng bán kính đẩy lùi và thời gian choáng).
   - **Đom đóm Ngọc bích (Jade):** Tăng `25%` tốc độ chạy cho Mây trong `6 s`.
   - **Bóng Mực Lớn & Nhỏ:** Biến thể kích thước và tốc độ tạo nhịp điệu né tránh đa dạng.
4. **Không gian & Bình minh sống động (`src/render/scene.ts`):** Thảm cây cỏ, bụi hoa phát sáng, hoa đăng trôi trên mặt nước, thuyền gỗ dập dềnh và hiệu ứng **bầu trời chuyển sắc bình minh cam hồng** trong 30 giây cuối trước khi mặt trời lên.
- **Bằng chứng ngắn:** Unit test `Creative isolation (options.creative = false vs true)` trong [`tests/unit/sim.test.ts`](tests/unit/sim.test.ts) và 31/31 bài test trong `npm run verify` ([`docs/proof/phase-4/SUMMARY.md`](docs/proof/phase-4/SUMMARY.md)) chứng minh `creative: false` giữ nguyên 100% đầu ra chuẩn.

## Tài liệu liên quan
- [CHANGELOG.md](CHANGELOG.md) — Lịch sử thay đổi từ `v0.1.0` đến `v1.0.0`
- [CREDITS.md](CREDITS.md) — Tác giả, công cụ & thư viện
- [LICENSE](LICENSE) — Giấy phép MIT
- [docs/notes/retro.md](docs/notes/retro.md) — Tổng kết 4 Phase (Retrospective)
- [docs/proof/phase-4/SUMMARY.md](docs/proof/phase-4/SUMMARY.md) — Bằng chứng kiểm chứng Phase 4
