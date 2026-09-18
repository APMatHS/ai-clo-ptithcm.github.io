# AI-CLO Aptis Lab — Learning Path V1

Ngày triển khai: 18/09/2026

## Mục tiêu

Nâng trang **Luyện tập** từ màn hình rút câu đơn giản thành hệ thống học có 3 tab:

1. **Lộ trình học** — học tuần tự từ B1 đến B2.
2. **Luyện kỹ năng** — tự chọn Grammar, Vocabulary, Reading, Listening, Speaking, Writing.
3. **Ôn tập thông minh** — ưu tiên câu từng sai, câu chưa gặp, câu lâu chưa ôn.

Mọi lượt luyện cá nhân tiếp tục dùng chung `aptis_attempts` và `aptis_attempt_items`, do đó lịch sử cũ không bị tách thành một hệ thống mới.

## Giữ trạng thái

Thiết kế theo kinh nghiệm AI-CLO/TOEIC:

- Supabase là nguồn dữ liệu chính.
- `aptis_learning_state` lưu bài đang làm, lesson, tab, câu hiện tại, draft và scroll.
- `localStorage` là lớp phục hồi nhanh nếu request lưu Supabase chưa kịp hoàn tất.
- `sessionStorage` giữ scroll theo từng màn hình.
- Đáp án đã nộp vẫn nằm trong `aptis_attempt_items`; reload/đổi màn hình không rút bộ câu mới.
- Writing draft được autosave.
- Speaking chỉ upload recording sau khi người dùng chủ động lưu.

## Schema mới

- `aptis_learning_courses`
- `aptis_learning_units`
- `aptis_learning_lessons`
- `aptis_lesson_progress`
- `aptis_learning_state`

Tất cả bảng mới đều bật RLS. `anon` không có SELECT; learner chỉ đọc/ghi dữ liệu của chính mình ở progress/state.

## RPC mới

- `aptis_get_learning_path()`
- `aptis_start_lesson(p_lesson_id, p_limit)`
- `aptis_get_attempt_resume(p_attempt_id)`
- `aptis_draw_review(p_limit)`
- `aptis_mark_lesson_complete(p_lesson_id, p_attempt_id)`

Các RPC chỉ grant cho `authenticated`. RPC có `SECURITY DEFINER` đều kiểm tra `auth.uid()`, quyền sở hữu attempt hoặc `aptis_has_access()`.

## Lộ trình seed

Course: `APTIS-GENERAL-B1-B2`

12 Unit:

1. Everyday English Foundation
2. People, Family & Daily Life
3. Travel, Places & Services
4. Work & Study
5. Health & Lifestyle
6. Technology & Media
7. Society & Environment
8. B2 Vocabulary Builder
9. B2 Grammar Builder
10. Reading & Listening Strategies
11. Speaking & Writing for Aptis
12. Aptis General Consolidation

Tổng cộng 36 lesson. Hiện 33 lesson mở được; Listening/Speaking/Writing chưa đủ bank được hiển thị **Sắp mở** thay vì tạo bài rỗng.

## Frontend

Các module mới độc lập với `app.js` cũ:

- `js/learning-api.js`
- `js/learning-path.js`
- `js/view-state.js`
- `css/learning-path.css`

`learning-path.js` thay giao diện Luyện tập sau khi `app.js` render, nhờ đó không cần vá lớn file app chính.

## Supabase production

Migration đã áp dụng trên project `rraooqedkpyhokattwdz` với tên:

`aptis_learning_path_v1_20260918`

Không chạy lại migration trên production chỉ để đồng bộ GitHub.

## Kiểm tra sau triển khai

- 1 course hoạt động.
- 12 unit hoạt động.
- 36 lesson hoạt động.
- 33 lesson khả dụng.
- 3 lesson ở trạng thái sắp mở.
- RLS bật trên toàn bộ 5 bảng mới.
- `authenticated` có quyền theo policy; `anon` không có SELECT.
- Security Advisor không phát hiện bảng Aptis mới bị thiếu RLS/policy.

## Nguyên tắc tiếp theo

Khi bổ sung Listening/Speaking/Writing, chỉ cần thêm bank media/prompt rồi bật `is_available` cho lesson tương ứng. Không cần đổi cấu trúc lộ trình.
