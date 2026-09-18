# AI-CLO OLYMPIC — V1

Module con độc lập trong AI-CLO PTITHCM, dùng chung Supabase Auth nhưng dùng các bảng `olympic_*` riêng để không ảnh hưởng dữ liệu CLO hiện tại.

## URL

- `/olympic/` — tổng quan.
- `/olympic/algebra/` — Đại số.
- `/olympic/calculus/` — Giải tích.
- Mỗi môn có `contents`, `lessons`, `practice`, `problems`, `tests`, `results`.
- `/olympic/teacher/` — khu vực giảng viên.
- `/olympic/admin/` — phân quyền giảng viên theo môn.

## V1 đã hoạt động

- Giao diện toán học riêng với thương hiệu **AI-CLO OLYMPIC**.
- Responsive desktop/mobile.
- Dùng chung đăng nhập AI-CLO/Supabase.
- Hai môn Đại số và Giải tích.
- Cây nội dung linh hoạt: Nhóm nội dung → Mục nội dung.
- Giảng viên được cấp quyền theo môn có thể thêm/sửa/ẩn/hiện nhóm và mục.
- Trạng thái mục: Nháp → Đang biên soạn → Đã duyệt → Đang dạy.
- Mức nội dung: Bắt buộc / Khuyến nghị / Nâng cao.
- Sinh viên chỉ thấy các mục đã duyệt hoặc đang dạy.
- Trình soạn bài học TeX với xem trước MathJax.
- Hỗ trợ các block `theorem`, `lemma`, `definition`, `example`, `proof`, `note`, `exercise`.
- Admin cấp quyền quản lý Đại số/Giải tích cho từng giảng viên.

## V1 mới dựng khung, chưa nối nghiệp vụ đầy đủ

- Trắc nghiệm/luyện tập.
- Ngân hàng bài toán Olympic.
- Đề luyện/thi thử.
- Theo dõi kết quả sinh viên.

Các phần này đã có URL và giao diện khung riêng để phát triển tiếp mà không dồn mọi chức năng vào một file.

## Database

- `olympic_subjects`
- `olympic_sections`
- `olympic_topics`
- `olympic_lessons`
- `olympic_teacher_subjects`

RLS được bật cho toàn bộ bảng. `anon` không có quyền dữ liệu Olympic. `authenticated` được cấp quyền bảng nhưng vẫn bị giới hạn bởi RLS.

## Nguyên tắc lộ trình

V1 **không khóa lộ trình theo 8/16 tuần**. Nội dung được quản lý như kho kiến thức có cấu trúc. Sau khi giảng viên thống nhất, lộ trình sẽ là một lớp dữ liệu riêng tham chiếu các mục đã có.
