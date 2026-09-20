# Storage

## Hiện tại

V1 dùng private Supabase Storage bucket `exam-files` trong project `unpqmttdkmmbnmmcfqbj`.

Object path chuẩn:

```text
exams/{exam_id}/source/...
exams/{exam_id}/image/...
exams/{exam_id}/audio/...
exams/{exam_id}/archive/...
exams/{exam_id}/other/...
```

RLS lấy `exam_id` từ object path và kiểm `manage_assets`. Sinh viên không có quyền Storage trực tiếp; Edge Function tạo signed URL ngắn hạn cho asset được câu hỏi tham chiếu.

## Metadata

`exam_assets` giữ provider, bucket, object path, loại file, MIME, size, checksum nếu có, người tạo và `deleted_at`.

Không lưu binary vào PostgreSQL.

## File nguồn

Word/PDF giảng viên/khảo thí giao phải giữ như `kind=source` để đối chiếu. Bản thi được biên tập riêng, không ghi đè file nguồn.

## Ảnh và audio

- Ảnh câu hỏi/passages lưu `kind=image`.
- Audio Anh văn lưu `kind=audio`.
- Signed URL chỉ cấp khi người dùng có quyền hoặc SV đang làm đúng attempt.
- Asset đã được snapshot tham chiếu bởi bài thi không nên xóa riêng lẻ.

## Retention

Mặc định 30 ngày sau thi. Hệ thống không tự xóa. Trước khi purge cần hiển thị số bài làm và số asset bị ảnh hưởng, export hồ sơ nếu cần, rồi Admin xác nhận.

## Chuyển R2 sau này

`exam_assets.provider` hỗ trợ `r2`. Frontend đi qua `storageService`, do đó khi kích hoạt Cloudflare R2 chỉ cần thay adapter/API ký URL, không thay model câu hỏi hoặc attempt.
