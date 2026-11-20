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
