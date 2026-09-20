# Database AI-CLO EXAM

Supabase project: `unpqmttdkmmbnmmcfqbj`.

## 1. Staff và quyền

### `profiles`
Mirror thông tin staff từ `auth.users`. Chỉ staff dùng Supabase Auth.

Các vai trò hệ thống: `admin`, `exam_officer`, `teacher`, `proctor`.

### `exam_members`
Quyền theo từng kỳ thi. Một người có thể là owner ở kỳ thi A nhưng chỉ author/viewer ở kỳ thi B.

### `exam_room_staff`
Gán giám thị theo phòng; dùng cho LIVE phạm vi phòng.

## 2. Cấu trúc kỳ thi

### `exams`
Thông tin kỳ thi, môn/nhóm môn, loại giữa kỳ/cuối kỳ, trạng thái, chế độ hiện điểm, retention.

### `exam_sessions`
Ca thi: giờ mở/đóng và thời lượng.

### `exam_rooms`
Nhiều phòng thuộc một ca.

### `exam_students`
Roster theo kỳ thi, gắn chính xác ca và phòng. Trigger DB chặn gắn sai phạm vi.

### `exam_student_codes`
Chỉ lưu hash mã thi; mã thô chỉ xuất lúc phát/sinh lại.

## 3. Đề thi và version

### `exam_papers`
Một đề logic cho một ca; `structure_mode` là `generic` hoặc `english`.

### `exam_paper_versions`
Version đề: draft / locked / hotfix / retired.

### `question_groups`, `question_group_versions`
Block Part/passage/audio/image. Đặc biệt dùng cho Anh văn.

### `questions`, `question_versions`
Câu hỏi và nội dung bất biến từng version. `choices` là JSON array, `correct_key` nằm server-side.

### `paper_version_questions`
Snapshot cấu trúc một paper version: thứ tự nguồn, question version và group version.

## 4. Bài làm

### `exam_attempts`
Một lượt thi của một sinh viên. Mặc định chỉ một attempt hoạt động.

### `attempt_sessions`
Opaque token theo thiết bị. Chỉ lưu hash token trong DB; có thể revoke khi chuyển máy.

### `attempt_questions`
Không copy HTML đề. Lưu `question_version_id`, `display_no`, `choice_order` và `first_seen_at`. Đây là snapshot đủ để tái dựng đúng đề SV đã thấy.

### `attempt_answers`
Đáp án hiện hành của SV, có `client_seq` để chống request cũ ghi đè request mới.

### `attempt_events`
Sự kiện LIVE/audit mức attempt: reload, tab hidden, offline/online, chuyển máy, lock/unlock, submit...

Trigger `sync_attempt_answer_stats` cập nhật `answered_count` và `last_saved_at` để LIVE không phải COUNT toàn bộ answer liên tục.

## 5. File và audit

### `exam_assets`
Metadata của Word/PDF nguồn, ảnh, audio, archive. Binary nằm trong private Storage. Đã chừa `provider = supabase | r2`.

### `audit_logs`
Hành động staff quan trọng: tạo/cập nhật quyền, hotfix, chuyển máy, reset, purge...

### `student_login_failures`
Rate limit login MSSV+mã. Không có client RLS policy có chủ đích; chỉ service-role function dùng. Trigger tự dọn dữ liệu cũ để phù hợp Free tier.

## 6. Dữ liệu nóng và lạnh

**Hot path khi thi:** `exam_attempts`, `attempt_sessions`, `attempt_questions`, `attempt_answers`, `attempt_events`.

**Warm path quản trị:** `exam_students`, sessions/rooms, paper/question versions.

**Cold/archive:** source/assets, audit và kỳ thi đã đóng.

LIVE dùng `exam_attempts.answered_count`, `last_saved_at` và event gần nhất; không join toàn bộ answer mỗi chu kỳ.

## 7. Guard quan trọng

- Student session/room phải thuộc cùng exam.
- Attempt session/room phải khớp roster.
- Attempt paper version phải thuộc đúng ca và ở trạng thái locked/hotfix.
- Attempt mới chỉ sinh khi exam `ready` hoặc `live`.
- Access code không lưu plaintext.
- Asset private, path bắt đầu `exams/{exam_id}/...`.
- Student không có policy đọc bảng trực tiếp.

## 8. Migration

Tên file trong `supabase/migrations/` phải khớp version đã ghi trong `supabase_migrations.schema_migrations`; không chạy DDL rời rồi bỏ quên source migration.

Sau mỗi migration: chạy Supabase Security Advisor + Performance Advisor và `node exam/tools/check-source.mjs`.
