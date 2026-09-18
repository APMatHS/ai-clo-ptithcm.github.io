# AI-CLO Aptis Lab — V1

## Phạm vi

AI-CLO Aptis Lab là công cụ độc lập tại `/tools/aptis-lab/`, dùng chung Supabase project và Auth của AI-CLO PTITHCM nhưng có giao diện, code và dữ liệu riêng.

### Quyền truy cập

- `admin`: truy cập mặc định, quản trị toàn bộ Aptis Lab.
- `teacher` thường: truy cập mặc định như learner.
- `teacher` được Admin gán `english_teacher`: quản lý nội dung/ngân hàng, không quản lý tài khoản.
- `student`: chỉ truy cập khi Admin thêm vào `aptis_memberships` và bật quyền.
- Mục tiêu mặc định: B2; người dùng tự đổi B1/B2.

### AI

- Quota mặc định: 10 lượt/người/ngày, Admin thay đổi được.
- V1 chưa tự gọi AI khi mở trang hoặc khi rút câu.
- Hạ tầng `aptis_ai_usage` + RPC `aptis_take_ai_credit()` đã sẵn sàng cho Edge Function chấm Speaking/Writing hoặc AI Coach ở phiên bản sau.

## Storage

Hai bucket private:

- `aptis-content`: audio Listening, hình Reading/Speaking và media dùng chung. Learner có quyền đọc qua signed URL; Admin/English teacher được upload/update/delete.
- `aptis-recordings`: recording Speaking cá nhân. Đường dẫn bắt đầu bằng `user_id/`; chỉ chính người dùng và Admin được đọc/xóa.

Không lưu base64 media trong Postgres.

## Dữ liệu chính

- `aptis_settings`
- `aptis_memberships`
- `aptis_questions`
- `aptis_attempts`
- `aptis_attempt_items`
- `aptis_vocabulary`
- `aptis_activity_days`
- `aptis_ai_usage`
- `aptis_suggestions`

Learner không được SELECT trực tiếp `aptis_questions`, nên trường `answer` không bị tải xuống trình duyệt. Câu luyện được rút bằng `aptis_draw_practice()` và đáp án chỉ trả về sau `aptis_submit_answer()`.

## V1 đã có

- Login cùng tài khoản AI-CLO.
- Access gate đúng theo role.
- Dashboard riêng của Aptis Lab.
- Mục tiêu B1/B2 và streak.
- Luyện từ ngân hàng đã xuất bản.
- Grammar/Vocabulary/Reading/Listening dạng MCQ.
- Media private bằng signed URL.
- Speaking recording lưu Storage; Writing lưu text trong attempt item.
- Sổ từ vựng cá nhân.
- Tiến độ theo kỹ năng.
- AI Coach dạng thuật toán, không gọi API.
- Góp ý/đề xuất.
- Admin/English teacher quản lý ngân hàng.
- Admin quản lý quyền Aptis và quota AI.

## Phần chừa sẵn cho V1.1+

- Mini Mock / Full Mock theo ma trận Aptis General.
- AI chấm Speaking/Writing qua Edge Function, bắt buộc gọi `aptis_take_ai_credit()` phía server trước khi gọi model.
- AI sinh/nhân bản câu hỏi hàng loạt rồi lưu ngân hàng.
- Tự động dọn recording theo thời gian lưu cấu hình.
- Aptis Advanced (schema đã có `exam_family='advanced'`, frontend V1 chưa bật luồng học).

## Triển khai

Production Supabase đã được áp migration tương ứng khi tạo V1. Khi đưa code lên GitHub, copy các file trong ZIP vào root repo, giữ nguyên đường dẫn. Không cần chạy lại migration trên project production hiện tại.
