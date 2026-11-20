# Đảo Đèn Lồng — AI SDLC (Day 12)

> **Tác giả:** Nguyễn Thành Danh (`2A202603493`) · **Repo:** Cá nhân, Public  
> **Phase hiện tại:** `phase-1` (Đêm 1 – Đảo Bến · Test Contract v1.0)

Game 3D góc nhìn thứ ba chạy trên trình duyệt (**Three.js + TypeScript + Vite**) kèm chế độ mô phỏng không giao diện **Headless 60Hz** chạy trực tiếp bằng **Node.js** (tương thích macOS, Linux, Windows — không cần GPU hay cửa sổ).

---

## Cài đặt và Chạy (3 lệnh)

Yêu cầu: **Node.js >= 20** và **npm**.

```bash
npm ci
npm run build
npm run preview
```

Mở trình duyệt tại `http://localhost:4173` và nhấn **Bắt đầu Đêm 1** để chơi.

---

## Điều khiển

| Phím / Thao tác | Hành động |
|---|---|
| `W` `A` `S` `D` hoặc `Phím mũi tên` | Di chuyển Mây theo hướng camera |
| `Space` | Nhảy |
| `E` | Nạp ánh sáng vào Đèn Lồng Lớn gần nhất (trong `2.5m`) |
| `Q` hoặc `F` | **Tỏa sáng** — đẩy lùi & làm choáng Bóng Mực (tốn `1` ánh sáng, hồi `2.0s`) |
| `H` | Gọi **Chim Giấy Đèn Lồng** bay chỉ đường tới đèn chưa sáng gần nhất |
| `Kéo chuột` / `Cuộn chuột` / `J`, `L` | Xoay góc nhìn 3D & thu phóng camera |
| `M` | Bật / tắt âm thanh |

---

## Cách tính điểm

Toàn bộ thông số đọc trực tiếp từ [`game.contract.json`](game.contract.json):

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm (`per_mote`) | `+10` |
| Thắp sáng hoàn toàn 1 Đèn Lồng Lớn (`per_lantern`, cần `3` ánh sáng) | `+100` |
| Làm choáng 1 Bóng Mực bằng Tỏa Sáng (`per_stun`) | `+25` |
| Thưởng mỗi giây còn lại khi thắng (`per_second_left`) | `+2` × `floor(time_left_s)` |
| Thưởng mỗi ngọn lửa còn lại khi thắng (`per_flame_left`) | `+50` × `flames` |

---

## Kiểm thử & Chế độ Headless (Test Contract v1.0)

```bash
# Chạy toàn bộ unit test + contract test + tính tất định (Vitest)
npm test

# Chạy build + test + xuất bộ bằng chứng thật vào docs/proof/phase-1/
npm run verify

# Chạy trực tiếp CLI headless theo Test Contract v1.0
node dist/headless/cli.js --seed 42 --night 1 --ticks 300 --out out.jsonl
```

- Lỗi sai tham số hoặc thiếu file: thoát mã `1` kèm thông báo ra `stderr`.
- File `--scenario` / `--inputs` sai định dạng hoặc `tick` không tăng nghiêm ngặt: thoát mã `2` kèm thông báo ra `stderr`.
- Chi tiết thông số & giả định xem tại [docs/notes/phase-1-assumptions.md](docs/notes/phase-1-assumptions.md).

---

## Sáng tạo của tôi

Mọi phần sáng tạo được cô lập qua cờ `creative: true` (chỉ bật ở bản chơi 3D trình duyệt, **tắt hoàn toàn `creative: false` khi chạy headless**):

1. **Cô bé lang thang trong rừng ("Bé Lạc"):** Xuất hiện trong khu rừng nhỏ ở Đảo Bến. Khi Mây tìm thấy Bé Lạc, cô bé tặng **+5 ánh sáng** (tối đa tới `carry_capacity = 8`) kèm hiệu ứng hạt sáng vàng.
2. **Chim Giấy Đèn Lồng:** Bạn đồng hành bay quanh Mây, tự động bay dẫn đường (kèm vệt đốm sáng) hướng về Đèn Lồng Lớn chưa thắp khi Mây mang đủ ánh sáng, đi lạc >6 giây, hoặc nhấn `H`; cánh chim đổi sắc cảnh báo khi Bóng Mực tiến gần.
3. **Hai loại Bóng Mực:** **Bóng Mực Nhỏ** (nhanh hơn, dễ bị đẩy lùi xa) và **Bóng Mực Lớn** (có sừng mực, to lớn, chậm hơn nhưng tầm chạm rộng hơn và kháng đẩy lùi hơn).
4. **Đom đóm đa sắc:** Ngoài đom đóm **Vàng**, bản 3D có thêm đom đóm **Đỏ** (tăng bán kính & thời gian choáng của Tỏa Sáng trong 8s), **Xanh dương** (tăng tốc di chuyển 6s), và **Xanh lá** (hồi ngay chiêu Tỏa Sáng & +1 ngọn lửa nếu bị mất máu).
5. **Bối cảnh & Âm thanh tự sinh:** Bầu trời tím đen chuyển ấm dần theo tiến độ `0/5 → 5/5` đèn sáng; Đảo Bến có cầu gỗ, thuyền mây và âm thanh ngũ cung cổ tích tự tổng hợp bằng Web Audio API.

**Bằng chứng phần lõi không bị ảnh hưởng:**
- Test `Creative isolation guarantee` trong [tests/unit/sim.test.ts](tests/unit/sim.test.ts) xác nhận `creative: false` không sinh Bé Lạc, không có buff màu và giữ đồng nhất toàn bộ chỉ số Bóng Mực theo `game.contract.json`.
- Kết quả chạy 8 kịch bản headless thật và kiểm tra SHA-256 tính tất định tại [docs/proof/phase-1/SUMMARY.md](docs/proof/phase-1/SUMMARY.md) đạt **ALL PASS**.

---

## Hồ sơ Phase 1 & Tài liệu Lab

| Tài liệu | Nội dung |
|---|---|
| [game.contract.json](game.contract.json) | Khai báo lệnh build/run/headless và toàn bộ thông số `tuning` |
| [docs/notes/phase-1-assumptions.md](docs/notes/phase-1-assumptions.md) | Bảng ánh xạ yêu cầu, tiêu chí nghiệm thu & giả định Phase 1 |
| [docs/proof/phase-1/SUMMARY.md](docs/proof/phase-1/SUMMARY.md) | Bằng chứng chạy thật CLI headless & hash tất định |
| [docs/notes/ai-log.md](docs/notes/ai-log.md) | Nhật ký dùng AI, lỗi đã phát hiện, harness & ước tính token |
| [AGENTS.md](AGENTS.md) & [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) | Harness AI & quy trình kiểm chứng tự động |
| [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) | Nguồn tài nguyên & giấy phép MIT |

### Tài liệu gốc của bài Lab
- [GUIDE.md](GUIDE.md) · [CHECKPOINTS.md](CHECKPOINTS.md) · [SUBMISSION.md](SUBMISSION.md) · [RULES.md](RULES.md) · [RUBRIC.md](RUBRIC.md)
