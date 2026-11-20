# Phase 2 — Đặc tả, Tiêu chí nghiệm thu & Thay đổi (TICKET-02 · Contract v1.1)

## 1. Bảng ánh xạ yêu cầu Phần 1–4 -> Tiêu chí nghiệm thu

| Hạng mục | Yêu cầu TICKET-02 | Tiêu chí nghiệm thu (Acceptance Criteria) | Cách kiểm chứng |
|---|---|---|---|
| **Di chuyển & Nhảy** | `6.0 m/s`, tăng tốc/dừng `≤ 0.1s`, điều khiển trên không đầy đủ; Nhảy `7.0 m/s`, `g = -20 m/s²` khi chạm đất | Mây di chuyển đúng theo `cam_yaw_deg`, nhảy lên từ mặt đất với `vy = 7.0` và rơi theo `g = -20` | Unit test + Contract test `10` |
| **Lướt (Dash)** | `14 m/s`, `0.2s` (`12` tick), hồi `1.5s` (`90` tick từ lúc bắt đầu), giữ `Y` trên không, không bất tử | Nhấn `dash` khi hết hồi chiêu → đi `2.8m` trong `12` tick, `vel[1] = 0`, `dash_cd_s = 1.5`, phát `dash` | Contract test `09-dash` |
| **Đom đóm & Đèn** | Sức chứa `10`; nhặt `XZ ≤ 1.0m` & `ΔY ≤ 1.5m`; 20 con đầu, trần `30`, sinh thêm tại tick `240, 480...`; nạp `10` vào đèn trong `2.0m` | Tự nhặt không cộng điểm; nạp vào đèn gần nhất cộng `+10/đom đóm` (`deposit`) và `+100` khi đủ `10` (`lantern_lit`) | Contract test `01`, `02`, `09` |
| **Vùng an toàn** | Đèn sáng tạo vùng `6m`: chặn Bóng ở mép `6m`; Bóng đang ở trong lúc đèn vừa thắp bị đẩy ra trong `≤ 30` tick và không gây sát thương | Bóng ngoài bị chặn ở `≥ 6m`; Bóng bên trong bị đẩy ra không gây `player_hit` | Contract test `04-safe-radius` |
| **Tỏa Sáng (Pulse)** | Tốn `3`, bán kính `5m` 3D từ `Y+0.8`, hồi `3s` (`180` tick); choáng `120` tick, đẩy `4m` trong `15` tick đầu (dừng gặp vật cản); `+5`/con | Bóng trong `5m` 3D chuyển `stunned`, lùi dần `4m` trong 15 tick; `+5` điểm/con (kể cả đang choáng) | Contract test `03-pulse-stun-cooldown` |
| **Bóng Mực** | `4.0 m/s` (Đêm 3: `4.5 m/s`); phát hiện `12m` / bỏ đuổi `18m`; chạm `XZ ≤ 1.0m & ΔY ≤ 1.5m`; lùi `2m` trong `60` tick (`recoil`); rơi `floor(carried/2)` ra vành `1.5–2.5m` (`ttl: 480` tick); bất tử `90` tick | Đúng 5 trạng thái (`spawning`, `wander`, `chase`, `recoil`, `stunned`); đom đóm rơi nhặt lại được từ tick sau; sinh `2` con tick `300`, sau đó theo chu kỳ Đêm | Contract test `05`, `10` |
| **Rơi khỏi đảo** | `Y < -10`: `-1` Ngọn Lửa, bỏ qua bất tử, mất hết đom đóm, chờ `60` tick rồi hồi sinh ở `(0,0,0)` với bất tử `90` tick; hết lửa thua ngay | Phát `player_hit` (`by: "fall"`, `lost`), chờ 60 tick không nhặt/bị đánh, hồi sinh đúng `(0,0,0)` | Contract test `10-fall-and-dropped-motes` |
| **Đêm 2 — Đảo Cau** | 2 đảo `R=28m` tại `(0,0)` & `(70,0)`, cầu tre `x∈[26,44], z∈[-2,2]`, 2 bục nhảy `(20,0,18)` & `(50,0,-18)` (`vy=14, vh=24`), `L1..L6`, `330s` | Bục nhảy phóng Mây sang đảo đích trong ~1.4s; cầu tre đi qua được, bước ra ngoài cầu sẽ rơi | Contract test `12-night2-jumppad-charm` |
| **Đêm 3 — Đảo Chuông & Gió** | `R=45m`, 3 tầng (`Y=0,3,6`), vách đứng, 2 dốc `30°/150°` (`3m`), bục nhảy `(0,3,13)` (`vy=12, vz=-8`), Tháp Chuông `R=2, H=8`, `L1..L7`, Gió mỗi `30s` báo `2s` thổi `5s` (`2 m/s`), `360s` | Vách đứng chặn leo lên; dốc đi lên tầng 1 mượt; bục nhảy đáp tầng 2; Tháp chặn tâm; gió đẩy đúng `2 m/s` | Contract test `14-night3-tiers-ramps-wind` |
| **Gió Lạc (Drifter)** | Đêm 2 & 3, tối đa `2`, sinh tick `1200, 2400...`, `idle (2 m/s)` → `chase (7 m/s)` khi mang `≥ 5` & `≤ 15m`; cướp `min(3, carried)` bỏ qua `safe_radius`/bất tử → `flee (240` tick); Pulse trúng `chase` → `flee`, trúng `flee` có đồ → thả lại & biến mất sau `120` tick | Phát `drifter_steal`, `drifter_drop`; giữ nguyên Ngọn Lửa | Contract test `13-night2-drifter` |
| **Bùa Gió (Charm)** | `C1 (35,0,0)` Đêm 2; `C1 (30,0,25), C2 (-30,0,25)` Đêm 3; `600` tick: chạy `7.2 m/s` & Dash không hồi chiêu; hồi sau `2700` tick | Phát `charm_picked`, tốc độ `7.2 m/s`, dash liên tiếp không chờ `1.5s`, hồi lại sau `2700` tick | Contract test `12-night2-jumppad-charm` |
| **Tạm dừng & Chuỗi 3 Đêm** | `Esc/P` dừng logic (`state: "paused"`, `sim_tick`/timer/TTL đứng yên); Menu chính → Giới thiệu Đêm → Chơi → Kết quả → Đêm tiếp → Màn hình Bình Minh; Cài đặt lưu `localStorage`; Âm thanh đầy đủ; HUD 10 ô, mũi tên chỉ đèn | `tick` tăng khi pause nhưng `sim_tick` giữ nguyên; tổng điểm cộng dồn qua Đêm thắng; `localStorage` giữ âm lượng & độ nhạy chuột | Contract test `11-pause-resume` + kiểm tra trình duyệt |
| **Hiệu năng & Tất định** | Headless `21.600` tick Đêm 3 `≤ 30s`; 3D `≥ 30 FPS` tại `1280×720`; SHA-256 giống hệt | `21.600` tick hoàn thành trong vài trăm ms; SHA-256 2 lần chạy Đêm 1/2/3 khớp 100%; FPS `≥ 30` | Contract test `15` + `verify-phase2.mjs` + đo FPS |

---

## 2. Nhật ký thay đổi từ Phase 1 -> Phase 2 (Regression Audit)
Theo yêu cầu chuẩn hóa của **TICKET-02 Phần 1**, các giá trị tự chọn ở Phase 1 được thay thế và các bài test Phase 1 được cập nhật kèm lý do rõ ràng:
1. **Thông số `tuning` trong `game.contract.json` (`1.0` -> `1.1`):**
   - `carry_capacity`: `8 -> 10`, `lantern_cost`: `3 -> 10`, `pickup_radius`: `1.6 -> 1.0`, `interact_radius`: `2.5 -> 2.0`.
   - `pulse_cost`: `1 -> 3`, `pulse_radius`: `7.0 -> 5.0` (tâm `Y+0.8`), `pulse_stun_s`: `3.0 -> 2.0` (`120` tick), `pulse_cooldown_s`: `2.0 -> 3.0`.
   - `night1_duration_s`: `180 -> 300`, `shade_speed`: `3.6 -> 4.0`, `shade_hit_radius`: `1.1 -> 1.0`, `fall_enabled`: `false -> true`.
   - `score`: `per_mote: 10` chuyển từ lúc nhặt sang **lúc nạp vào đèn** (`deposit`); `per_stun: 25 -> 5`.
2. **Trạng thái Bóng Mực:** Đổi từ `chase | stunned | flee` ở Phase 1 sang 5 trạng thái chuẩn v1.1: `spawning | wander | chase | recoil | stunned`.
3. **Đom đóm rơi khi bị đánh:** Thay vì tan biến vào sương như giả định Phase 1, đom đóm rơi thành thực thể vật lý (`kind: "dropped"`, `ttl: 480` tick) ở vành `1.5–2.5m` và nhặt lại được từ tick sau.
4. **Sáng tạo Phase 1 được giữ nguyên 100% ở chế độ giao diện (`creative: true`):** Bé Lạc (+5 ánh sáng), Chim Giấy Đèn Lồng, Bóng Mực Lớn/Nhỏ và đom đóm đa sắc vẫn hoạt động trong 3 Đêm khi chơi trên trình duyệt, và tắt hoàn toàn (`creative: false`) ở chế độ headless.
