# AI-CLO EXAM

Hệ thống thi trực tuyến tách biệt về nghiệp vụ và backend với AI-CLO chính, chạy tại thư mục `/exam/`.

## Phạm vi V1

- Thi giữa kỳ, cuối kỳ và kỳ thi khác.
- Một kỳ thi có nhiều ca; một ca có nhiều phòng và đúng một đề đang sử dụng.
- Mỗi sinh viên dùng MSSV + mã thi riêng theo kỳ thi; sinh viên không dùng Supabase Auth.
- Mỗi sinh viên có thứ tự câu và đáp án được trộn ổn định riêng.
- Toán/Lý/Triết dùng đề trắc nghiệm rich editor; Vật lý hỗ trợ ảnh.
- Anh văn dùng cấu trúc Part / passage / audio / nhóm câu tương tự TOEIC Full Test.
- LIVE cho giám thị: trạng thái kết nối, tiến độ, sự kiện rời tab/reload/đổi máy; giám thị quyết định khóa/mở.
- Local-first autosave, server deadline, cho chuyển máy nhưng không reset thời gian.
- Hotfix đề trong khi thi có versioning; sinh viên đã xem câu giữ bản cũ.
- Xuất Excel tổng hợp/chi tiết và dựng lại đúng đề đã trộn của từng sinh viên để in/lưu PDF.
- Không sử dụng AI.

## Backend

Supabase project: `unpqmttdkmmbnmmcfqbj` (organization `AI-CLO-EXAM`).

Frontend chỉ chứa publishable key. Service-role key không được đưa vào GitHub hoặc browser. Sinh viên đi qua Edge Function `student-exam`; staff dùng Supabase Auth + RLS.

## Cấu trúc source

```text
exam/
├── index.html
├── assets/
│   ├── css/                 # design system theo miền chức năng
│   └── js/
│       ├── core/            # auth client, router support, UI, permission
│       ├── components/      # rich editor và component tái sử dụng
│       ├── features/        # exams, LIVE, student, results, accounts
│       └── services/        # DB/API/storage/import/export/autosave
├── docs/
├── supabase/
│   ├── migrations/
│   └── functions/
└── tools/
```

Không tạo file vá kiểu `fix-v2.js`, `patch-v3.css`. Thay đổi phải đi vào đúng module miền chức năng.

## Edge Functions

- `student-exam`: login MSSV+mã, start/resume, câu hỏi, autosave, heartbeat/event, submit.
- `exam-operations`: roster, cấp mã, khóa/mở, chuyển máy, mở lại bài.
- `paper-hotfix`: áp dụng version mới cho bài chưa xem câu.
- `exam-results`: kết quả, hồ sơ đối chiếu, dữ liệu export.
- `staff-admin`: quản lý nhiều Admin/Khảo thí/GV/Giám thị.
- `exam-preflight`: kiểm tra trước thi và health check.

## Quy tắc phát triển

1. UI không dùng service-role và không bypass RLS.
2. Sinh viên không đọc bảng thi trực tiếp.
3. Không sửa đè nội dung câu hỏi đã dùng; dùng version.
4. Không phụ thuộc trực tiếp vào Supabase Storage trong feature; đi qua `storageService` để sau này đổi R2.
5. Không tự xóa hồ sơ khi đủ 30 ngày; chỉ đánh dấu đến hạn và Admin quyết định.
6. Trước khi deploy chạy `node exam/tools/check-source.mjs`.

Xem thêm: `docs/ARCHITECTURE.md`, `docs/PERMISSIONS.md`, `docs/EXAM-FLOW.md`, `docs/STORAGE.md`, `docs/SETUP.md`.
