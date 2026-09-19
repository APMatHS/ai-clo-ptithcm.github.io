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

## Kiến trúc V2

- Persistent app shell: sidebar/header/footer không dựng lại sau mỗi click.
- Client-side router dùng History API; route nội bộ chỉ thay `#olyContent`.
- Mỗi route vẫn có `index.html` vật lý để direct URL, bookmark và F5 hoạt động trên GitHub Pages.
- Runtime được chia module trong `/olympic/assets/js/v2/` để dễ nâng cấp và tránh một file lõi quá lớn.
- Chỉ một Supabase client trong mỗi document; session/profile/subjects không nạp lại sau mỗi lần chuyển trang.
- Cây nội dung và danh sách bài học có cache ngắn hạn + invalidate sau chỉnh sửa.
- MathJax chỉ load một lần trong phiên document.
- `lesson-subject-guard.js` cũ không còn được scaffold V2 nạp; kiểm tra môn nằm ngay trong query chính.

## Lỗi relationship bài học đã xử lý ở frontend

Database có hơn một foreign-key relationship giữa `olympic_lessons` và `olympic_topics`. V2 không xóa schema mà chỉ rõ quan hệ PostgREST:

```js
.select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(title)')
```

Cách này loại lỗi `Could not embed because more than one relationship was found...` mà không làm mất dữ liệu.

## Chức năng hiện có

- Giao diện riêng **AI-CLO OLYMPIC**, responsive desktop/mobile.
- Dùng chung đăng nhập AI-CLO/Supabase.
- Hai môn Đại số và Giải tích.
- Cây nội dung: Nhóm nội dung → Mục nội dung.
- Giảng viên được cấp quyền theo môn có thể thêm/sửa/ẩn/hiện nhóm và mục.
- Trạng thái mục: Nháp → Đang biên soạn → Đã duyệt → Đang dạy.
- Mức nội dung: Bắt buộc / Khuyến nghị / Nâng cao.
- Trình soạn bài học TeX + MathJax preview.
- Các block `theorem`, `lemma`, `definition`, `example`, `proof`, `note`, `exercise`.
- Admin cấp quyền quản lý Đại số/Giải tích cho giảng viên.
- Sinh viên chỉ mở bài học đã xuất bản và đang hiển thị.

## Chưa nối nghiệp vụ đầy đủ

- Trắc nghiệm/luyện tập.
- Ngân hàng bài toán Olympic.
- Đề luyện/thi thử.
- Theo dõi kết quả sinh viên.

Các phần này đã có URL và khung riêng để phát triển tiếp trên nền router V2.

## Database

- `olympic_subjects`
- `olympic_sections`
- `olympic_topics`
- `olympic_lessons`
- `olympic_teacher_subjects`

Frontend chỉ dùng publishable key. RLS tiếp tục là lớp bảo vệ dữ liệu phía database.

## Nguyên tắc lộ trình

Olympic không khóa lộ trình theo 8/16 tuần. Nội dung được quản lý như kho kiến thức có cấu trúc; lộ trình sau này có thể là lớp dữ liệu riêng tham chiếu các mục đã có.
