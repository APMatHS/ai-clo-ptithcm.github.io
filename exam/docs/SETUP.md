# Khởi tạo AI-CLO EXAM

## 1. Supabase

Project production/dev hiện tại: `unpqmttdkmmbnmmcfqbj`.

Migrations nằm trong `exam/supabase/migrations/` và phải chạy theo thứ tự tên file. Edge Functions nằm trong `exam/supabase/functions/`.

Không đưa service-role key vào repository hoặc frontend.

## 2. Admin đầu tiên

Project mới chưa có staff. Chỉ lần đầu tiên cần bootstrap thủ công:

1. Supabase Dashboard -> Authentication -> Users -> Add user.
2. Tạo email/mật khẩu cho Admin đầu tiên.
3. Trigger sẽ tạo `public.profiles` với trạng thái chưa kích hoạt.
4. Trong SQL Editor chạy câu sau, thay email bằng email vừa tạo:

```sql
update public.profiles
set system_role = 'admin',
    active = true,
    full_name = 'Tên Admin'
where lower(email) = lower('admin@example.com');
```

5. Đăng nhập `/exam/#/staff`.
6. Từ menu `Tài khoản`, Admin đầu tiên tạo các Admin/Khảo thí/GV/Giám thị còn lại. Không cần SQL nữa.

Không hạ quyền/vô hiệu hóa Admin hoạt động cuối cùng; Edge Function `staff-admin` có guard cho trường hợp này.

## 3. Edge Functions cần deploy

- `student-exam`: Verify JWT OFF có chủ đích; function tự xác thực MSSV+mã và opaque attempt token.
- `exam-operations`: Verify JWT ON.
- `paper-hotfix`: Verify JWT ON.
- `exam-results`: Verify JWT ON.
- `staff-admin`: Verify JWT ON.
- `exam-preflight`: Verify JWT ON.

## 4. Storage

Bucket `exam-files` phải private. Migration tạo bucket và policy theo `exam_id`.

## 5. Trước khi thi thật

- Chạy `node exam/tools/check-source.mjs`.
- Chạy tab `Kiểm tra trước thi` cho từng kỳ thi.
- Diễn tập với tài khoản thử.
- Kiểm tra LIVE, autosave, mất mạng, đổi máy, hotfix, nộp và export.
- Stress test tối thiểu 500 client giả lập trước khi dùng production quy mô lớn.

## 6. Fork và production

Phát triển hiện thực hiện trên `APMatHS/ai-clo-ptithcm.github.io`. Backup trước V1: `backup-before-exam-v1-20260920`.

Chỉ merge/pull sang repository AI-CLO chính sau khi E2E đạt.
