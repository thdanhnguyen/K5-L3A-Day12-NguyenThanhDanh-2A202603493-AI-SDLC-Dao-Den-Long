# Đảo Đèn Lồng — AI SDLC (Day 12)

> **Tác giả:** Nguyễn Thành Danh (`2A202603493`) · **Repo:** Cá nhân, Public  
> **Phase hiện tại:** `phase-3` — *Đèn Cạn Dầu* (Contract v1.2)

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
| `E` | Nạp ánh sáng thắp đèn (`10` lần đầu, `5` thắp lại) hoặc **Châm dầu** đèn đang sáng |
| `Q` hoặc `F` | **Tỏa sáng** — tốn `3` đom đóm, đẩy lùi `4m` & choáng `2s` trong bán kính `5m` 3D (hồi `3s`) |
| `H` | Gọi **Chim Giấy Đèn Lồng** bay chỉ đường tới đèn chưa sáng gần nhất |
| `Esc` hoặc `P` | **Tạm dừng** (dừng toàn bộ logic, mở menu Tiếp tục / Chơi lại / Cài đặt / Về Menu) |
| `Kéo chuột` / `Cuộn chuột` / `J`, `L` | Xoay góc nhìn 3D & thu phóng camera |
| `M` | Bật / tắt âm thanh |

---

## Luật chơi & Cách tính điểm (Contract v1.2)

Toàn bộ thông số đọc trực tiếp từ [`game.contract.json`](game.contract.json):
- **Giữ đảo sáng tới bình minh:** Đêm 1 / 2 / 3 kéo dài `240 / 270 / 300 s`. Đèn sáng bắt đầu với `100` dầu và hao `1.0/s`; khi `fuel < 30` mất vùng an toàn và Bóng Mực có thể tới hút `5.0/s` (`drain`). Thắng khi sống sót tới bình minh với ít nhất `60%` đèn sáng (`3/5`, `4/6`, `5/7`).
- **Sức chứa tăng dần:** `10 + 2 × số lần thắp thành công` (tối đa `20`).
- **Chế độ mù màu:** Bật trong **Cài đặt** để đổi viền/mắt Bóng Mực sang `#00B3FF` và cảnh báo `#FFFFFF` kèm `⚠`. Đèn tắt bị xẹp `20%` và có vết rách giấy.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp/châm dầu (`per_mote`) | `+5` |
| Thắp đèn lần đầu (`per_lantern`) / Thắp lại | `+100` / `+40` |
| Bóng Mực trúng Tỏa Sáng (`per_stun`) / Đang `drain` | `+5` / `+15` |
| Bình minh (chỉ khi thắng): mỗi đèn sáng / mỗi Ngọn Lửa còn | `+(50 + floor(fuel))` / `+50` |

---

## Kiểm thử & Chế độ Headless (Test Contract v1.2)

```bash
# Chạy toàn bộ 28 test (unit + regression Phase 1-2 + Phase 3 fuel/drain/dawn/capacity)
npm test

# Chạy build + test + xuất bộ bằng chứng thật vào docs/proof/phase-3/
npm run verify

# Chạy trực tiếp CLI headless theo Test Contract v1.2 (--night 1 | 2 | 3)
node dist/headless/cli.js --seed 42 --night 3 --ticks 600 --out out.jsonl
```

---

## Sáng tạo của tôi

Mọi phần sáng tạo từ Phase 1–2 được giữ nguyên ở Phase 3 và cô lập qua cờ `creative: true` (chỉ bật ở bản chơi 3D trình duyệt, **tắt hoàn toàn `creative: false` khi chạy headless**):
- **Bé Lạc trong rừng** (+5 ánh sáng, tôn trọng sức chứa tăng dần `capacity`), **Chim Giấy Đèn Lồng** dẫn đường, **Bóng Mực Lớn/Nhỏ**, và **đom đóm đa sắc** (Đỏ/Xanh dương/Xanh lá).
- Bằng chứng phần lõi giữ nguyên tính tất định trên 3 Đêm tại [docs/proof/phase-3/SUMMARY.md](docs/proof/phase-3/SUMMARY.md) và `Creative isolation guarantee` trong [tests/unit/sim.test.ts](tests/unit/sim.test.ts).

---

## Hồ sơ Dự án & Tài liệu Lab

| Tài liệu | Nội dung |
|---|---|
| [game.contract.json](game.contract.json) | Contract v1.2 (`fuel_*`, `relight_cost`, `win_ratio`, `drain_per_s`, `capacity_max`) |
| [docs/notes/adr-001-lantern-fuel-and-dawn.md](docs/notes/adr-001-lantern-fuel-and-dawn.md) | ADR-001 quyết định thiết kế mô hình nhiên liệu & luật thắng bình minh |
| [CHANGELOG.md](CHANGELOG.md) | Danh sách các thay đổi phá vỡ tương thích (breaking changes) qua các phase |
| [docs/proof/phase-3/SUMMARY.md](docs/proof/phase-3/SUMMARY.md) | Bằng chứng chạy thật Contract v1.2, benchmark 18.000 tick & hash SHA-256 3 Đêm |
| [docs/notes/ai-log.md](docs/notes/ai-log.md) | Nhật ký dùng AI, lỗi đã phát hiện, harness & ước tính token |
| [AGENTS.md](AGENTS.md) & [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) | Harness AI & quy trình kiểm chứng tự động |
| [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) | Nguồn tài nguyên & giấy phép MIT |

### Tài liệu gốc của bài Lab
- [GUIDE.md](GUIDE.md) · [CHECKPOINTS.md](CHECKPOINTS.md) · [SUBMISSION.md](SUBMISSION.md) · [RULES.md](RULES.md) · [RUBRIC.md](RUBRIC.md)
