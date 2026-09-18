# AI-CLO Aptis Lab — Bank milestone 451

Ngày cập nhật: 18/09/2026.

## Trạng thái production

Ngân hàng Aptis hiện có **451 câu published, active**.

| Kỹ năng | Level | Số câu |
|---|---:|---:|
| Grammar | B1 | 69 |
| Grammar | B2 | 56 |
| Vocabulary | B1 | 78 |
| Vocabulary | B2 | 68 |
| Reading | B1 | 36 |
| Reading | B2 | 36 |
| Listening | B1 | 12 |
| Listening | B2 | 12 |
| Speaking | B2 | 42 |
| Writing | B2 | 42 |

Tổng: **451**.

Ba câu trong batch mục tiêu 454 bị cơ chế chống trùng bỏ qua; không tắt duplicate protection chỉ để đạt số tròn.

## Listening

Có **6 Listening sets published** và cả 6 đều có audio WAV trong private bucket `aptis-content`.

- 3 set B1 / 12 câu.
- 3 set B2 / 12 câu.
- Audio: WAV, mono, 24 kHz, PCM 16-bit.
- File đặt dưới `listening/generated/<level>/<set_id>.wav`.
- Transcript vẫn nằm trong `aptis_sets` để quản trị; learner nhận nội dung nghe qua media, không cần public bucket.

Audio được sinh bằng Gemini TTS phía Edge Function. Function thử model TTS chính trước và có fallback model. API key và service-role key chỉ tồn tại phía server.

## Edge Function

Function: `aptis-listening-tts`.

Bản production cuối:

- `verify_jwt = true`.
- Chỉ Admin hoặc Aptis `english_teacher` đang enabled được phép gọi.
- Không cho anonymous/public maintenance call.
- Upload vào bucket private `aptis-content`.
- Khi set có audio, set và các câu Listening liên quan được publish.
- Lesson Listening chỉ được mở khi đã có đủ ngân hàng published.

Source được lưu tại:

`supabase/functions/aptis-listening-tts/index.ts`

## Lộ trình

Hiện **36/36 lesson active đã available**.

Lesson Listening `APT-L1003` đã được mở sau khi B2 Listening có đủ câu published và audio.

## Reading mở rộng gần nhất

Bốn passage nguyên bản mới:

1. B1 Community — `Reading Extension 01 - Community Repair Cafe`.
2. B1 Education — `Reading Extension 02 - Weekend Study Skills Workshop`.
3. B2 Work — `Reading Extension 03 - Four Day Work Pilot`.
4. B2 Environment — `Reading Extension 04 - Smart Waste Bins`.

Mỗi passage có 4 câu MCQ.

## Nội dung mở rộng gần nhất

Ngoài Reading, batch gần nhất bổ sung:

- Grammar B1/B2.
- Vocabulary B1/B2.
- 12 Speaking prompts B2 trải từ Part 1 đến Part 4.
- 12 Writing prompts B2 trải từ Part 1 đến Part 4.

Nội dung là câu nguyên bản theo dạng Aptis General, không sao chép đề thi chính thức.

## Ghi chú triển khai

`pg_net` đã được bật trên production để phục vụ lần tạo audio nội bộ. Repo chỉ lưu migration idempotent bật extension:

`supabase/migrations/20260918_08_enable_pg_net_for_aptis_tts.sql`

Các migration one-time dùng để enqueue/restart worker khi sinh 6 audio **không được đưa vào migration tái triển khai**, nhằm tránh tự động sinh lại audio khi dựng môi trường mới.

Production đã chạy các thay đổi này; không chạy lại các thao tác one-time chỉ để đồng bộ repo.
