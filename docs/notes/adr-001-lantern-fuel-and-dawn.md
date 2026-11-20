# ADR-001: Mô hình nhiên liệu đèn, Bóng Mực hút dầu và Luật thắng bình minh (Phase 3)

- **Trạng thái:** Đã chấp nhận & triển khai (`phase-3` · Contract v1.2)
- **Bối cảnh:** Trong Phase 1–2, người chơi thắp đủ đèn thì thắng ngay (`all_lit`), khiến nửa sau của Đêm không có áp lực duy trì. TICKET-03 yêu cầu thay đổi luật cốt lõi sang cơ chế giữ đèn sáng tới bình minh.

## Quyết định thiết kế
1. **Biểu diễn nhiên liệu bằng số nguyên `fuelUnits` (đơn vị `1/60`):**
   - `fuel_max = 100` được lưu nội bộ là `6000` units; hao tự nhiên `-1` unit/tick và bị hút `-5` units/tick (`drain`).
   - Chỉ chia `60` và làm tròn 1 chữ số thập phân khi xuất snapshot/event, tránh hoàn toàn sai số tích lũy IEEE-754 khi trừ `1/60` hàng chục nghìn lần.
   - Châm dầu dùng phép tính nguyên `ceil((6000 - fuelUnits) / 600)` tương đương chính xác `ceil((100 - fuel) / 10)`.
2. **Mô hình trạng thái đèn & Bóng Mực `drain`:**
   - Đèn sáng có 2 vùng hành vi: `fuel >= 30` (`>= 1800` units) duy trì vùng an toàn `6m`; `fuel < 30` mất vùng an toàn và trở thành mục tiêu ưu tiên cho Bóng Mực `wander`.
   - Bóng Mực thêm trạng thái `drain` (đứng yên trong `≤ 2m` quanh đèn yếu, hút `5/s`, phát `fuel_drain` mỗi `60` tick; chuyển `chase` khi Mây vào `6m`, `stunned` khi trúng Pulse kèm thưởng `+15`, `wander` khi đèn tắt hoặc châm lên `≥ 30`).
3. **Luật thắng tại bình minh (`dawn_survived`):**
   - Bỏ thắng sớm khi thắp đủ đèn (`all_lit` không còn dùng).
   - Ở cuối tick bình minh, kiểm tra `flames <= 0` (`no_flames`) trước mọi điều kiện khác, sau đó mới xét `lit >= ceil(0.6 * total)` (`dawn_survived` vs `dawn`).

## Hệ quả & Cách giữ ổn định
- Các test Phase 1–2 không bị thay thế (di chuyển, nhảy, dash, rơi, Gió Lạc, Bùa Gió, Tạm dừng, bản đồ 3 Đêm, mã thoát `2`) giữ nguyên hành vi và tiếp tục chạy hồi quy.
- Chỉ test `02-deposit-win` và kỳ vọng `per_mote = 5` / `duration` được cập nhật tương ứng với `[THAY THẾ]` trong TICKET-03 và ghi rõ trong `CHANGELOG.md`.
