# Nhật ký dùng AI & Đánh giá Phase 1

## 1. Quy trình SDLC với AI trong Phase 1
1. **Phân tích yêu cầu & Giả định:** Đọc toàn bộ PRD-0, Test Contract v1.0 và tài liệu rubric/submission; lập bảng ánh xạ yêu cầu → tiêu chí nghiệm thu tại [phase-1-assumptions.md](phase-1-assumptions.md).
2. **Thiết kế kiến trúc trước khi viết code:** Tách hoàn toàn mô phỏng 60Hz thuần (`src/sim/`) khỏi đồ họa Three.js (`src/render/`) và âm thanh (`src/audio/`). Khóa bộ thông số duy nhất trong [`game.contract.json`](../../game.contract.json).
3. **Thống nhất phần sáng tạo không phá Contract:** Thiết kế cờ `options.creative` (`false` cho headless CLI, `true` cho trình duyệt) để toàn bộ Bé Lạc (+5 ánh sáng), Chim Giấy Đèn Lồng, Bóng Mực Lớn/Nhỏ và đom đóm đa sắc chỉ chạy trong giao diện người chơi.
4. **Kiểm chứng trước — xây dựng từng bước nhỏ:** Chia thành các commit rõ ràng (`chore` scaffold → `feat(sim)` engine & CLI → `test` unit/contract/proof → `feat(game)` 3D/audio/HUD → `docs` & tag).

---

## 2. Lỗi đã phát hiện & cách chỉnh Harness

| Thời điểm | Vấn đề / Lỗi phát hiện | Cách phát hiện | Cách khắc phục & Cập nhật quy trình |
|---|---|---|---|
| Unit test `Creative isolation` | `createWanderingGirl` đặt vị trí ban đầu tại `homePos` thay vì trên quỹ đạo tròn bán kính `3.2m`, làm Bé Lạc dịch chuyển đột ngột ngay ở tick 1 | Test `tests/unit/sim.test.ts` báo fail (`expected false to be true`) | Sửa `createWanderingGirl` tính sẵn tọa độ `pos` trên vòng tròn bán kính `3.2m` theo `angle` ban đầu |
| Thiết kế điều khiển camera `A`/`D` | Camera đặt phía sau Mây nhìn về `+Z` (`θ=0`), khi đó bên phải màn hình là `-X`, ngược dấu nếu gán trực tiếp `D -> +1` | Đối chiếu toán học giữa tích có hướng `(forward × up)` và công thức xoay trong Contract C | Khóa `D -> move_x = -1`, `A -> move_x = +1` trong `src/main.ts` để `WASD` khớp trực giác góc nhìn |
| Môi trường build/commit trên Windows | Sandbox chặn kết nối registry khi `npm install` và khóa tạo `.git/index.lock`; PowerShell 5.1 không hỗ trợ `&&` | Lỗi trực tiếp khi chạy lệnh trong terminal | Dùng `BypassSandbox` đúng bước cần thiết, dùng `; if ($LASTEXITCODE -ne 0)` trong PowerShell, và giữ toàn bộ code/CLI theo quy ước LF & `node:path` cho Linux |
| Sai số dấu phẩy động IEEE-754 trên biên `<= r` và bộ đếm `1/60s` | Cộng `0.1m/tick` 10 lần ra `0.9999999999999999` làm biên `1.6m` hụt `1e-16`; trừ `1/60` khỏi `1.5s` 90 lần dư `~2.2e-15` làm trễ 1 tick | Rà soát đối chiếu kịch bản biên ẩn trước khi gắn tag `phase-1` | Thêm `EPS = 1e-6` + `stepTimer()` trong `src/sim/engine.ts` và bổ sung test biên chính xác trong `tests/contract.test.ts` |

---

## 3. Harness AI đã sử dụng
- [`AGENTS.md`](../../AGENTS.md): Ngắn gọn (~25 dòng), đặt 6 quy tắc cứng (tách biên `src/sim/`, nguồn sự thật `game.contract.json`, cô lập sáng tạo `creative: false`, chuẩn cross-platform, bất biến Test Contract v1.0, cổng `npm run verify`).
- [`.agents/skills/verify-phase/SKILL.md`](../../.agents/skills/verify-phase/SKILL.md): Quy trình 4 bước tái lập kiểm chứng mỗi cuối phase.
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml): CI tự động chạy trên `ubuntu-latest` để đảm bảo build + test + proof script chạy thật trên Linux mỗi lần push/tag.

---

## 4. Quản lý Token & Chi phí ước tính
- **Ước tính tiêu thụ Phase 1:** ~60.000–85.000 tokens tổng hợp (lập kế hoạch, sinh code mô phỏng + 3D + test suite + kiểm chứng).
- **Cách tiết kiệm token:**
  - Chốt rõ cấu trúc và hợp đồng JSON ngay từ đầu để tránh viết đi viết lại.
  - Giữ `AGENTS.md` cô đọng (~25 dòng) thay vì nhồi tài liệu dài vào mọi lượt hội thoại.
  - Chỉ đọc file cần thiết và dùng sửa file cục bộ (`edit_file`) khi vá lỗi ở `creative.ts` và `verify-phase1.mjs`.
  - Giao việc kiểm tra giao diện trình duyệt cho subagent dùng model nhẹ (`flash`).

---

## 5. Đánh giá nhanh cuối Phase 1 (Evaluation)
- **Đạt:**
  - Bộ 9 unit test + 10 contract test (`npm test`, gồm cả kiểm tra biên dấu phẩy động IEEE-754 và nhảy/xoay camera `90°`) xanh 100%, xác minh chạy thật `node dist/headless/cli.js` với exit code `0` và `2`.
  - Tính tất định đã kiểm chứng bằng SHA-256 giống hệt nhau giữa 2 lần chạy (`docs/proof/phase-1/SUMMARY.md`).
  - Game 3D build thành công (`dist/index.html`, `dist/headless/cli.js`), giữ nguyên tách biệt `creative: false` cho headless.
- **Lưu ý & Vòng cải tiến sau chơi thử:**
  - Khi subagent trình duyệt mở `http://localhost:4173`, người dùng tiếp quản tab trình duyệt (`BROWSER_USER_TAKEOVER`) để tự chơi thử và góp ý 3 điểm: (1) nâng góc nhìn thứ 3 chếch từ trên xuống (~50°), (2) làm cảnh đêm sáng rõ và ấm hơn, (3) trau chuốt đồ họa đẹp hơn.
  - Nhờ kiến trúc tách biệt `src/sim/` khỏi `src/render/`, toàn bộ nâng cấp góc nhìn (`camera.ts`), ánh sáng/bóng đổ/hoa đăng (`scene.ts`), texture thủ công (`textures.ts`) và tạo hình nhân vật/hào quang (`entities.ts`) được cập nhật gọn gàng mà **không đụng một dòng nào vào logic mô phỏng hay Test Contract v1.0** (hash SHA-256 headless vẫn giữ nguyên tuyệt đối).

---

## 6. Nhật ký & Đánh giá Phase 2 (TICKET-02 · Contract v1.1)
- **Thay đổi yêu cầu đã xử lý:** Đồng bộ toàn bộ số liệu chuẩn v1.1 (`dash`, `carry_capacity = 10`, `lantern_cost = 10`, `pulse_cost = 3`, điểm nạp đom đóm, `fall_enabled = true`, 5 trạng thái Bóng Mực), xây dựng 3 bản đồ chuẩn (`src/sim/maps.ts`), cơ chế 12 bước cố định (`src/sim/engine.ts`), Gió Lạc, Bùa Gió, Tạm dừng, chuỗi 3 Đêm + Màn hình Bình Minh, cài đặt `localStorage`, bảng màu chuẩn và âm thanh đầy đủ.
- **Lỗi phát hiện & khắc phục:**
  - Bộ đếm thời gian dùng số nguyên tick (`invulnTicks`, `dashCdTicks`, `pulseCdTicks`, `charmTicks`, `ttlTicks`) loại bỏ hoàn toàn sai số dấu phẩy động.
  - Smoke test Đêm 3 phát hiện `game.contract.json` chưa được ghi đè ở lượt chỉnh sửa bị gián đoạn (`time_left_s: null`) -> ghi lại và kiểm chứng ngay trên CLI.
  - 3 assertion đầu tiên ở `tests/contract.test.ts` (Bóng Mực ở `7m` tự chuyển từ `wander` sang `chase` trong cùng tick do `<= 12m`; người chơi giữ `move` lúc hồi sinh; `pulse` trừ `3` trước khi nhặt lại `3` đom đóm rơi) được đối chiếu từng tick để xác nhận logic chính xác 100%.
- **Hiệu năng & Token Phase 2:**
  - Headless 21.600 tick Đêm 3 hoàn thành trong **~0.48s** (`479 ms`, ngưỡng yêu cầu `≤ 30s`).
  - Đo thực tế bản 3D trên trình duyệt của người dùng (`http://localhost:4173/`): **54 FPS** (đạt ngưỡng `≥ 30 FPS`).
  - Ước tính token Phase 2: ~75.000–95.000 tokens (giữ gọn bằng cách tái sử dụng toàn bộ kiến trúc `src/sim/` và chỉ mở rộng thêm `maps.ts` + cập nhật có chọn lọc).

---

## 7. Nhật ký & Đánh giá Phase 3 (TICKET-03 · Contract v1.2)
- **Xử lý Change Request (`[THAY THẾ]`):** Viết [adr-001-lantern-fuel-and-dawn.md](adr-001-lantern-fuel-and-dawn.md) và [CHANGELOG.md](../../CHANGELOG.md) trước khi sửa code; giữ nguyên 14/15 test Phase 1–2 không bị thay thế và chỉ cập nhật đúng test `02` (không còn thắng sớm `all_lit`) kèm lý do rõ ràng.
- **Độ chính xác nhiên liệu & test:** Lưu dầu bằng số nguyên `1/60` (`fuelUnits` max `6000`) nên phép hao `1/s`, hút `5/s` và `ceil((100 - fuel)/10)` không có sai số dấu phẩy động. Test `16` chứng minh đèn đầy `100` sau 5 tick tự nhiên giảm còn `99.917` và cần đúng `1` đom đóm để châm lại.
- **Hiệu năng & Token Phase 3:** Headless 18.000 tick Đêm 3 hoàn thành trong `~0.35s`; ước tính token Phase 3: ~40.000–55.000 tokens.

## Phase 4 (Contract v1.3 · `phase-4` · `v1.0.0`)
- **Mục tiêu:** Benchmark `1280×720`, Soak test 10 Đêm, Bảng xếp hạng địa phương + `--export-leaderboard`, Trợ năng (đổi phím, phụ đề trực quan + mũi tên Bóng Mực, Giảm chuyển động, cỡ chữ `>= 18px` + Chữ lớn `×1.25`), tài liệu phát hành và đóng gói.
- **Quyết định kỹ thuật:**
  - Thêm `benchMode?: boolean` vào `SimOptions` trong `src/sim/engine.ts` để tách biệt cảnh benchmark (200 Bóng Mực `wander`, 100 đom đóm, `L1–L3` sáng, tắt creative/decay/damage/pickup/spawn/win-loss) mà không phá vỡ ranh giới thuần của `src/sim/`.
  - Dùng `node:http` + trình duyệt Chromium/Edge/Chrome có sẵn trong `src/cli/bench.ts` và `src/cli/run.ts` để giữ gói cài đặt gọn nhẹ, đa nền tảng.
- **Kết quả đo thực tế:**
  - `soak.json`: `nights: 10`, `crashes: 0`, `mem_start_mb: 52.38`, `mem_end_mb: 61.05` (`<= 1.2×`), `duration_s: 0.36`.
  - `bench.json`: `contract_version: "1.3"`, `avg_fps: 17.6`, `p1_low_fps: 9.6`, `frame_ms_p95: 69.2`, `frames: 582`, `load_ms: 3201`, `peak_mem_mb: 39.1`.
- **Hiệu năng & Token Phase 4:**
  - Ước tính tiêu thụ Phase 4: ~65.000–85.000 tokens (xây dựng `bench`/`soak`/`run` CLIs, UI Bảng xếp hạng + Trợ năng, kiểm thử, tài liệu phát hành & hiệu ứng bình minh).
