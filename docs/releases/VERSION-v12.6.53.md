# AI-CLO PTITHCM — V12.6.53

## Nhận dạng câu hỏi từ ảnh

- Thêm tab giữa **Nhận dạng từ ảnh** tại trang **Thêm câu hỏi**.
- Giảng viên có thể dán, kéo thả hoặc chọn một ảnh PNG/JPG/WEBP tối đa 8 MB.
- Gemini trả về nội dung câu hỏi, bốn phương án A–D, đáp án đúng và lời giải; kết quả được điền vào biểu mẫu hiện hành để chỉnh sửa trước khi lưu.
- Câu sau nhận dạng được gắn nguồn **AI hỗ trợ**.
- Ảnh chỉ được gửi khi người dùng chủ động nhấn nút nhận dạng và không được lưu vào bảng câu hỏi.

## Backend

Triển khai mới Edge Function self-contained:

```text
supabase/functions/recognize-question-image/index.ts
```

Function dùng secret `GEMINI_API_KEY` và cơ chế fallback `GEMINI_MODELS`/`GEMINI_MODEL` hiện hành. Không cần migration hoặc thay đổi schema.


