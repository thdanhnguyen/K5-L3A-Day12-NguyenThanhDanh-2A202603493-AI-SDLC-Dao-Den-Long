# Đảo Đèn Lồng — AI SDLC (Day 12)

> **Tác giả:** Nguyễn Thành Danh (`2A202603493`) · **Repo:** Cá nhân, Public  
> **Phase hiện tại:** `phase-2` — *Ba Hòn Đảo* (Contract v1.1)

Game 3D góc nhìn thứ ba chạy trên trình duyệt (**Three.js + TypeScript + Vite**) qua chuỗi **3 Đêm (Đảo Bến · Đảo Cau · Đảo Chuông)** kèm chế độ mô phỏng không giao diện **Headless 60Hz** chạy trực tiếp bằng **Node.js** (tương thích macOS, Linux, Windows).

---

## Cài đặt và Chạy (3 lệnh)

Yêu cầu: **Node.js >= 20** và **npm**.

```bash
npm ci
npm run build
npm run preview
```

Mở trình duyệt tại `http://localhost:4173` và chọn **Bắt đầu hành trình (Đêm 1)** hoặc chọn nhanh Đêm 1 / 2 / 3.

---

## Điều khiển

| Phím / Thao tác | Hành động |
|---|---|
| `W` `A` `S` `D` hoặc `Phím mũi tên` | Di chuyển Mây theo hướng camera |
| `Space` | Nhảy |
| `Shift` | **Lướt (Dash)** — `14 m/s` trong `0.2s` (hồi `1.5s`, giữ độ cao trên không) |
| `E` | Nạp ánh sáng vào Đèn Lồng Lớn gần nhất (trong `2.0m`) |
| `Q` hoặc `F` | **Tỏa sáng** — tốn `3` đom đóm, đẩy lùi `4m` & choáng `2s` trong bán kính `5m` 3D (hồi `3s`) |
| `H` | Gọi **Chim Giấy Đèn Lồng** bay chỉ đường tới đèn chưa sáng gần nhất |
| `Esc` hoặc `P` | **Tạm dừng** (dừng toàn bộ logic, mở menu Tiếp tục / Chơi lại / Cài đặt / Về Menu) |
| `Kéo chuột` / `Cuộn chuột` / `J`, `L` | Xoay góc nhìn 3D & thu phóng camera |
| `M` | Bật / tắt âm thanh |

---

## Cách tính điểm (Contract v1.1)

Toàn bộ thông số đọc trực tiếp từ [`game.contract.json`](game.contract.json):

| Sự kiện | Điểm |
|---|---|
| Nạp đom đóm vào đèn (`per_mote`) | `+10` mỗi đom đóm nạp |
| Thắp sáng hoàn toàn 1 Đèn Lồng Lớn (`per_lantern`, cần `10` đom đóm) | `+100` |
| Bóng Mực trúng Tỏa Sáng (`per_stun`, kể cả con đang choáng) | `+5` |
| Thưởng mỗi giây còn lại khi thắng (`per_second_left`) | `+2` × `floor(time_left_s)` |
| Thưởng mỗi Ngọn Lửa còn lại khi thắng (`per_flame_left`) | `+50` × `flames` |

Tổng điểm chiến dịch là tổng điểm của các Đêm đã thắng (Đêm 1 → Đêm 2 → Đêm 3 → Màn hình Bình Minh).

---

## Kiểm thử & Chế độ Headless (Test Contract v1.1)

```bash
# Chạy toàn bộ 25 test (unit + regression Phase 1 + kịch bản Phase 2 + benchmark 21.600 tick)
npm test

# Chạy build + test + xuất bộ bằng chứng thật vào docs/proof/phase-2/
npm run verify

# Chạy trực tiếp CLI headless theo Test Contract v1.1 (--night 1 | 2 | 3)
node dist/headless/cli.js --seed 42 --night 3 --ticks 600 --out out.jsonl
```

- Lỗi sai tham số hoặc thiếu file: thoát mã `1` kèm thông báo ra `stderr`.
- File `--scenario` / `--inputs` sai định dạng hoặc `tick` không tăng nghiêm ngặt: thoát mã `2` kèm thông báo ra `stderr`.
- Đặc tả & lý do cập nhật test Phase 1 xem tại [docs/notes/phase-2-spec.md](docs/notes/phase-2-spec.md).

---

## Sáng tạo của tôi

Mọi phần sáng tạo từ Phase 1 được giữ nguyên ở Phase 2 và cô lập qua cờ `creative: true` (chỉ bật ở bản chơi 3D trình duyệt, **tắt hoàn toàn `creative: false` khi chạy headless**):

1. **Cô bé lang thang trong rừng ("Bé Lạc"):** Xuất hiện trong khu rừng nhỏ trên cả 3 hòn đảo; tìm thấy Bé Lạc được tặng **+5 ánh sáng** (tối đa tới `carry_capacity = 10`).
2. **Chim Giấy Đèn Lồng:** Bạn đồng hành bay quanh Mây, tự động dẫn đường về đèn chưa sáng gần nhất khi đủ đom đóm, đi lạc hoặc nhấn `H`; cánh chim đổi sắc cảnh báo khi Bóng Mực lại gần.
3. **Hai loại Bóng Mực:** **Bóng Mực Nhỏ** (nhanh hơn, dễ bị đẩy lùi) và **Bóng Mực Lớn** (có sừng mực, tầm chạm rộng hơn, kháng đẩy lùi hơn).
4. **Đom đóm đa sắc:** Đom đóm **Đỏ** (tăng sức mạnh Tỏa Sáng 8s), **Xanh dương** (tăng tốc 6s), và **Xanh lá** (hồi ngay Tỏa Sáng & +1 Ngọn Lửa nếu mất máu).

**Bằng chứng phần lõi không bị ảnh hưởng:**
- Test `Creative isolation guarantee` trong [tests/unit/sim.test.ts](tests/unit/sim.test.ts) xác nhận `creative: false` không sinh Bé Lạc, không có buff màu và giữ nguyên thông số chuẩn.
- Kết quả chạy đầy đủ Đêm 1/2/3, 21.600 tick Đêm 3 và hash SHA-256 tại [docs/proof/phase-2/SUMMARY.md](docs/proof/phase-2/SUMMARY.md) đạt **ALL PASS**.

---

## Hồ sơ Phase 1 & Phase 2

| Tài liệu | Nội dung |
|---|---|
| [game.contract.json](game.contract.json) | Khai báo Contract v1.1 (`dash`, `night2`, `night3`, `fall_enabled`, `score`) |
| [docs/notes/phase-2-spec.md](docs/notes/phase-2-spec.md) | Acceptance criteria Phần 1–4 & nhật ký thay đổi từ Phase 1 |
| [docs/proof/phase-2/SUMMARY.md](docs/proof/phase-2/SUMMARY.md) | Bằng chứng chạy thật Contract v1.1, benchmark 21.600 tick & hash SHA-256 3 Đêm |
| [docs/notes/ai-log.md](docs/notes/ai-log.md) | Nhật ký dùng AI, lỗi đã phát hiện, harness & ước tính token |
| [AGENTS.md](AGENTS.md) & [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) | Harness AI & quy trình kiểm chứng tự động |
| [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) | Nguồn tài nguyên & giấy phép MIT |

### Tài liệu gốc của bài Lab
- [GUIDE.md](GUIDE.md) · [CHECKPOINTS.md](CHECKPOINTS.md) · [SUBMISSION.md](SUBMISSION.md) · [RULES.md](RULES.md) · [RUBRIC.md](RUBRIC.md)
