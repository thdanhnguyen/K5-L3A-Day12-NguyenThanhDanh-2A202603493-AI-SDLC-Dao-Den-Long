# Retrospective — Đảo Đèn Lồng (Phase 1 → Phase 4)

## 1. Tổng quan hành trình 4 Phase
Dự án **Đảo Đèn Lồng** đi qua 4 cột mốc trong một chu trình AI-SDLC đầy đủ:
1. **Phase 1 (`phase-1`, Contract v1.0):** Dựng khung 3D Three.js với nhân vật Mây, 5 Đèn Lồng Lớn trên Đảo Bến, thu thập đom đóm, Bóng Mực đuổi bắt, Tỏa Sáng và bộ CLI headless xác định dùng `Mulberry32`.
2. **Phase 2 (`phase-2`, Contract v1.1):** Chuẩn hóa toàn bộ hằng số vật lý/gameplay vào `game.contract.json`, mở rộng 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), bổ sung Lướt (Dash), Gió Lạc, Bệ phóng gió, Bùa gió, Gió mạnh và các yếu tố sáng tạo (Bé Lạc, Chim Giấy Đèn Lồng, biến thể Bóng Mực/đom đóm) được cô lập hoàn toàn khỏi headless.
3. **Phase 3 (`phase-3`, Contract v1.2):** Thực hiện Change Request "Đèn cạn dầu": thay luật thắng bằng "giữ `>= ceil(0.6 * N)` đèn sáng tới bình minh", thêm nhiên liệu (`100`, hao `1/s`, rút dầu `5/s` khi `< 30`), châm dầu và sức chứa tăng dần (`10 → 20`), ghi lại quyết định kiến trúc trong ADR.
4. **Phase 4 (`phase-4`, Contract v1.3, `v1.0.0`):** Hoàn thiện sản phẩm phát hành với chế độ Benchmark `1280×720`, kiểm thử Soak 10 Đêm liên tiếp, Bảng xếp hạng địa phương top 10 + CLI `--export-leaderboard`, bộ tính năng trợ năng (đổi phím, phụ đề trực quan + mũi tên mép màn hình, giảm chuyển động, chữ lớn `×1.25`), tài liệu và quy trình đóng gói phát hành.

## 2. Những quyết định kỹ thuật mang lại giá trị lớn nhất
- **Tách ranh giới mô phỏng thuần (`src/sim/`) ngay từ Phase 1:** Việc cấm tuyệt đối `three`, DOM globals và `Math.random()` trong `src/sim/` giúp toàn bộ logic 60Hz chạy được cả trong trình duyệt lẫn Node.js headless/soak mà không cần giả lập DOM. Nhờ vậy 10 Đêm soak test chạy xong trong chưa đầy 1 giây với độ lặp lại 100% (SHA-256 trùng khớp).
- **Single Source of Truth (`game.contract.json`):** Mọi tuning constant đều đọc từ một file JSON duy nhất. Khi Phase 3 đổi luật hoặc Phase 4 thêm `bench_cmd`/`soak_cmd`, không có giá trị bị rải rác hay lệch giữa bản chơi thật và bản test.
- **Cô lập sáng tạo qua cờ `options.creative`:** Cho phép tự do làm game phong phú hơn (Bé Lạc, Chim Giấy, cây cỏ, đom đóm buff) trong khi vẫn đảm bảo đầu ra headless, cảnh benchmark và soak test bám sát chuẩn đánh giá tự động.
- **Độ chính xác số nguyên cho nhiên liệu (`fuelUnits = fuel * 60`):** Tránh sai số dấu phẩy động `1/60` tích lũy qua 21,600 tick ở Đêm 3, đảm bảo kiểm thử contract luôn khớp chính xác từng tick.

## 3. Khó khăn gặp phải và cách khắc phục
- **Sai số số thực và đồng bộ giữa bản web & headless ở Phase 2–3:** Được giải quyết bằng fixed-timestep accumulator `1/60s` ở `src/main.ts` và tính nhiên liệu theo đơn vị nguyên `1/60`.
- **Đo bộ nhớ khởi đầu trong Soak Test (`soak.js`):** Nếu đo RSS trước khi V8 JIT biên dịch vòng lặp `step()` của Đêm 1, mức RSS khởi điểm bị thấp giả tạo khiến mức tăng sau Đêm 1 trông vượt ngưỡng `1.2×`. Đo `mem_start_mb` ngay sau khi hoàn tất và giải phóng Đêm 1 phản ánh đúng rò rỉ bộ nhớ thực tế qua 10 Đêm liên tiếp.
- **Đóng gói đa nền tảng không phụ thuộc thư viện nặng cho Benchmark:** Thay vì kéo thêm `playwright` hàng trăm MB vào `dependencies`, `bench.ts` dùng `node:http` + trình duyệt Chromium/Edge/Chrome có sẵn trên máy với cờ `--disable-gpu-vsync --disable-frame-rate-limit` và endpoint `/api/bench-result`, giữ gói phát hành gọn nhẹ và chạy được trên Windows/macOS/Linux.

## 4. Bài học cho các dự án AI-SDLC tiếp theo
- **Contract-first + Regression Suite là xương sống khi có Change Request:** Khi Phase 3 thay đổi luật cốt lõi, bộ 28+ test tự động giúp phát hiện ngay điểm xung đột giữa luật cũ và luật mới trong vài giây.
- **Kiểm tra sớm trên môi trường mục tiêu:** Việc chạy thật `tsc`, `vite build`, `esbuild`, `soak` và `bench` sau mỗi bước giúp phát hiện lỗi ESM `__dirname` hay import có side-effect trước khi đóng gói phát hành.
