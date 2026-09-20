# Phân quyền AI-CLO EXAM

## Vai trò hệ thống

- `admin`: nhiều Admin, toàn quyền hệ thống.
- `exam_officer`: Khảo thí.
- `teacher`: Giảng viên.
- `proctor`: Giám thị.

Vai trò hệ thống không quyết định toàn bộ quyền trên một kỳ thi. Quyền thực tế được gắn qua `exam_members` và `exam_room_staff`.

## Vai trò trong kỳ thi

- `owner`: Chủ kỳ thi, toàn quyền kỳ thi.
- `manager`: Đồng quản lý.
- `author`: Ra đề.
- `proctor`: Giám thị.
- `viewer`: Chỉ xem phạm vi được cấp.

## Permission hiện có

- `view_exam`
- `manage_exam`
- `manage_members`
- `manage_sessions`
- `manage_roster`
- `manage_paper`
- `manage_live`
- `view_results`
- `export_results`
- `view_correct_answers`
- `manage_assets`

## Mẫu giữa kỳ

Giảng viên thường là `owner`, đồng thời ra đề và giám thị. Có thể tự tạo ca/phòng, roster, đề, LIVE, xử lý sự cố và xuất kết quả.

## Mẫu cuối kỳ

- Khảo thí: owner/manager tùy phân công.
- Giảng viên: thường author + view results theo chính sách.
- Giám thị: `view_exam` và được gán cụ thể vào phòng qua `exam_room_staff`; không mặc định có `manage_live` toàn kỳ thi.
- Admin: can thiệp toàn hệ thống khi cần.

## Nguyên tắc bảo mật

Ẩn nút ở frontend không phải là phân quyền. RLS/Edge Function phải kiểm tra lại quyền. `service_role` chỉ tồn tại trong Edge Functions. Sinh viên không có policy đọc trực tiếp bảng thi.
