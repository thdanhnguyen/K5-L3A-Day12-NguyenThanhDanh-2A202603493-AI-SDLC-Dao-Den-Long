# Phase 1 — Yêu cầu, Tiêu chí nghiệm thu & Giả định (PRD-0)

## 1. Bảng ánh xạ yêu cầu -> Tiêu chí nghiệm thu & Cách kiểm chứng

| ID | Yêu cầu PRD-0 | Tiêu chí nghiệm thu (Acceptance Criteria) | Cách kiểm chứng |
|---|---|---|---|
| R1 | Đêm 1 – Đảo Bến có 5 Đèn Lồng Lớn | Màn Đêm 1 có đúng `L1..L5`, thắp đủ 5 đèn → thắng (`won`, `all_lit`) | `tests/scenarios/02-deposit-win`, chơi thật 3D |
| R2 | Di chuyển, nhảy, camera 3D | `WASD`/phím mũi tên di chuyển theo hướng camera (`transformMoveToWorld`), Space nhảy (`Y >= 0`), chuột/phím xoay camera 3D | Unit test `transformMoveToWorld`, chơi thử 3D |
| R3 | Đom đóm rải rác, nhặt được | Tự nhặt đom đóm trong `pickup_radius` (`1.6m`) khi `carried < carry_capacity` (`8`), phát `mote_picked`, cộng `per_mote` (`10`) | `tests/scenarios/01-pickup-capacity` |
| R4 | Nạp ánh sáng thắp đèn | Nhấn `E`/`interact` trong `interact_radius` (`2.5m`) nạp tối đa `min(carried, need)` vào đèn chưa sáng gần nhất, phát `deposit` và `lantern_lit` khi đủ `lantern_cost` (`3`) | `tests/scenarios/02-deposit-win` |
| R5 | Bóng Mực đuổi & gây mất máu | Bóng Mực đuổi theo Mây, không vào `safe_radius` (`6.0m`) của đèn **đã sáng**. Chạm trong `shade_hit_radius` (`1.1m`) → `-1` flame, rơi `floor(carried * 0.5)` đom đóm, bất tử `invuln_s` (`1.5s`). Về 0 flame → thua (`no_flames`) | `tests/scenarios/04-safe-radius`, `05-hit-drop-loss` |
| R6 | Tỏa sáng xua Bóng Mực | Nhấn `Q`/`F`/`pulse` tốn `1` ánh sáng, hết cooldown `2.0s` → đẩy Bóng Mực trong `7.0m` ra xa `4.0m`, `state = "stunned"` trong `3.0s`, cộng `25` điểm/con | `tests/scenarios/03-pulse-stun-cooldown` |
| R7 | Thắng, thua, hết giờ, điểm, HUD & chơi lại | Hết `180s` chưa thắp đủ → thua (`dawn`). HUD hiện đầy đủ máu, ánh sáng, đèn, thời gian, điểm; màn thắng/thua có nút "Chơi lại" | `tests/scenarios/06-dawn-loss`, trình duyệt 3D |
| R8 | Test Contract v1.0 & Tính tất định | CLI headless chạy 60Hz không cửa sổ, tick 0 snapshot, bước `k` sinh tick `k+1`, làm tròn 3 chữ số, sai định dạng thoát mã `2`, cùng seed+input ra output giống hệt | `tests/contract.test.ts`, `scripts/verify-phase1.mjs` |
| R9 | Sáng tạo không phá lõi | Bé Lạc (+5 ánh sáng), Chim Giấy Đèn Lồng, Bóng Mực Lớn/Nhỏ, Đom đóm đa sắc chỉ chạy khi `creative: true` (giao diện 3D); `creative: false` ở headless | `tests/unit/sim.test.ts`, kiểm chứng headless |

---

## 2. Giả định cho các điểm mở trong PRD-0

1. **Kích thước & địa hình Đảo Bến:** Đảo hình tròn bán kính `40m`, mặt đất phẳng `Y = 0`, `fall_enabled: false` (biển mây bao quanh chặn nhẹ ở rìa `R = 40m` để tránh rơi vô lý khi né Bóng Mực; nếu kịch bản test đặt vật thể ở xa hơn `40m`, biên di chuyển tự mở rộng để không chặn kịch bản test).
2. **Vị trí mặc định 5 Đèn Lồng Lớn (`L1..L5`):** Đặt trên vòng tròn bán kính `22m` quanh `(0, 0, 0)`, bắt đầu từ `L1` ở `(0, 0, 22)` và chia đều góc `72°` (nhằm cho phép test đặt đèn hoặc Bóng Mực xung quanh `0..35m` hợp lý).
3. **`safe_radius` (`6.0m`):** Chỉ các đèn **đã thắp sáng (`lit: true`)** mới tỏa vùng an toàn xua Bóng Mực. Nếu Bóng Mực đang ở trong `safe_radius` khi đèn vừa sáng (hoặc sinh ra bên trong khi dựng scenario), Bóng Mực chuyển sang trạng thái `"flee"` và di chuyển ra ngoài vùng an toàn thay vì kẹt đứng yên.
4. **Đom đóm bị đánh rơi (`hit_drop_ratio: 0.5`):** Số lượng rơi tính bằng `Math.floor(carried * 0.5)` và **tan biến vào sương đen** (không rơi lại xuống chân Mây để tránh bị tự nhặt lại ngay trong cùng khung bất tử).
5. **Điểm thưởng khi thắng (`all_lit`):** Khi đèn thứ 5 sáng, cộng thêm `Math.floor(time_left_s) * per_second_left + flames * per_flame_left` rồi kết thúc game ngay với `state = "won"`.
6. **Quy ước góc `cam_yaw_deg` và hướng phím `WASD`:** Tuân thủ tuyệt đối công thức Test Contract v1.0 (`x' = x*cosθ + z*sinθ`, `z' = -x*sinθ + z*cosθ`). Ở góc `θ = 0`, `move = [0, 1]` đi về `+Z`; camera đứng phía sau Mây nhìn về `+Z`.
7. **Tách biệt Sáng tạo (`creative` flag):** Chế độ headless luôn khởi tạo `Simulation` với `creative: false` (không có Bé Lạc, không phân chia Bóng Mực Lớn/Nhỏ, không có hiệu ứng màu của đom đóm, chỉ hành vi chuẩn PRD-0). Chế độ 3D trên trình duyệt bật `creative: true`.
