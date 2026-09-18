# AI-CLO Aptis Lab V1

- Tạo công cụ độc lập tại `/tools/aptis-lab/` với giao diện riêng.
- Dùng cùng Supabase/Auth của AI-CLO PTITHCM.
- Admin/teacher truy cập mặc định; student cần Admin cấp quyền.
- Mục tiêu mặc định B2, đổi được B1/B2.
- English teacher quản lý nội dung; teacher thường/student dùng như learner.
- Quota AI mặc định 10 lượt/ngày/người, Admin cấu hình được.
- Có streak, sổ từ, tiến độ, đề xuất và AI Coach không gọi API ở V1.
- Ngân hàng câu hỏi lưu DB; learner rút câu qua RPC, không tải trường đáp án trực tiếp.
- Media dùng private Supabase Storage (`aptis-content`, `aptis-recordings`).
- Speaking recording lưu Storage; Writing lưu response; chưa tự chấm AI ở V1.
- Chừa schema cho `exam_family='advanced'` nhưng frontend hiện chỉ Aptis General.
- Thêm card truy cập AI-CLO Aptis Lab tại `/tools`.
