# AI-CLO OLYMPIC — V2

Module con độc lập trong AI-CLO PTITHCM, dùng chung Supabase Auth nhưng dùng các bảng `olympic_*` riêng để không ảnh hưởng dữ liệu CLO hiện tại.

> Quy tắc kỹ thuật và cách mở rộng: [`OLYMPIC-TECHNICAL-RULES.md`](./OLYMPIC-TECHNICAL-RULES.md)

## URL

- `/olympic/` — tổng quan.
- `/olympic/algebra/` — Đại số.
- `/olympic/calculus/` — Giải tích.
- Mỗi môn có `contents`, `lessons`, `practice`, `problems`, `tests`, `results`.
- `/olympic/teacher/` — khu vực giảng viên.
- `/olympic/admin/` — phân quyền giảng viên theo môn.

## V2 — kiến trúc điều hướng

- App shell (sidebar/header/footer) tồn tại xuyên suốt phiên sử dụng.
- Router phía client đổi URL bằng History API và chỉ render `#olyContent`.
- Chuyển trang nội bộ Olympic không hard reload, tránh chớp trắng và không khởi tạo lại Supabase/session.
- Mỗi URL vẫn giữ `index.html` vật lý để GitHub Pages hỗ trợ F5/direct URL.
- Session, profile và danh sách môn chỉ nạp lúc khởi tạo document; dữ liệu cây/bài học có cache ngắn hạn và invalidate sau chỉnh sửa.
- Subject guard của bài học được tích hợp vào query chính, không tạo Supabase client thứ hai.

## Đã hoạt động

- Giao diện toán học riêng với thương hiệu **AI-CLO OLYMPIC**.
- Responsive desktop/mobile.
- Dùng chung đăng nhập AI-CLO/Supabase.
- Hai môn Đại số và Giải tích.
- Cây nội dung linh hoạt: Nhóm nội dung → Mục nội dung.
- Giảng viên được cấp quyền theo môn có thể thêm/sửa/ẩn/hiện nhóm và mục.
- Trạng thái mục: Nháp → Đang biên soạn → Đã duyệt → Đang dạy.
- Mức nội dung: Bắt buộc / Khuyến nghị / Nâng cao.
- Trình soạn bài học TeX với xem trước MathJax.
- Hỗ trợ các block `theorem`, `lemma`, `definition`, `example`, `proof`, `note`, `exercise`.
- Admin cấp quyền quản lý Đại số/Giải tích cho từng giảng viên.
- Query `olympic_lessons → olympic_topics` chỉ rõ foreign key để tránh lỗi relationship mơ hồ của PostgREST.

## Chưa nối nghiệp vụ đầy đủ

- Trắc nghiệm/luyện tập.
- Ngân hàng bài toán Olympic.
- Đề luyện/thi thử.
- Theo dõi kết quả sinh viên.

Các phần này đã có URL và giao diện khung riêng để phát triển tiếp mà không dồn mọi chức năng vào một trang.

## Database

- `olympic_subjects`
- `olympic_sections`
- `olympic_topics`
- `olympic_lessons`
- `olympic_teacher_subjects`

RLS được bật cho toàn bộ bảng. Frontend chỉ dùng publishable key; không dùng service-role key.

## Nguyên tắc lộ trình

Olympic **không khóa lộ trình theo 8/16 tuần**. Nội dung được quản lý như kho kiến thức có cấu trúc. Sau khi giảng viên thống nhất, lộ trình có thể là một lớp dữ liệu riêng tham chiếu các mục đã có.
