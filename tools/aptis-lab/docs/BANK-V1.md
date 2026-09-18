# AI-CLO Aptis Lab — Bank V1

Cập nhật: 18/09/2026.

## Kiến trúc

- `aptis_questions`: câu hỏi độc lập hoặc câu con của một bộ.
- `aptis_sets`: passage/audio/prompt cha cho Reading, Listening, Speaking, Writing.
- `aptis_question_revisions`, `aptis_set_revisions`: lưu lịch sử trước khi nội dung được chỉnh.
- `set_id` + `item_order`: liên kết câu con với bộ và xác định thứ tự.
- `content_hash`: hỗ trợ phát hiện trùng.

Learner không đọc trực tiếp bảng đáp án. Bài luyện được rút qua RPC `aptis_draw_practice`.

## Rút câu thích nghi

Thứ tự ưu tiên:

1. Câu chưa gặp.
2. Câu từng trả lời sai.
3. Câu đã lâu chưa luyện.
4. Câu đã đúng nhiều lần.

Không gọi AI ở bước rút câu.

## Ngân hàng khởi đầu trên production

Đã nạp 72 câu nguyên bản:

- Grammar B1: 14
- Grammar B2: 14
- Vocabulary B1: 14
- Vocabulary B2: 14
- Reading B1: 8 câu trong 2 passage
- Reading B2: 8 câu trong 2 passage

Tổng Reading: 4 bộ passage, 16 câu.

Listening chưa xuất bản câu mẫu khi chưa có audio thật. Audio sẽ lưu ở private bucket `aptis-content` và chỉ tạo/upload một lần để tái sử dụng.

## Quản trị

Module `js/bank-extension.js` bổ sung:

- Tab **Bộ Reading / Listening** trong Quản trị Aptis.
- Tạo/sửa bộ passage hoặc audio.
- Gắn câu hỏi vào bộ và đặt thứ tự câu.
- Kiểm tra câu tương tự trước khi lưu.
- Hiển thị passage Reading khi learner làm bài.
- Dùng audio của bộ Listening cho các câu con.

Admin có quyền xóa bộ; English teacher có quyền tạo/sửa nội dung theo RLS.

## Lưu ý triển khai

Các migration schema/RPC trong `supabase/migrations/20260918_05_*` và `20260918_06_*` đã được áp dụng lên production `rraooqedkpyhokattwdz` trước khi commit vào repo. Không chạy lại chỉ để đồng bộ GitHub.
