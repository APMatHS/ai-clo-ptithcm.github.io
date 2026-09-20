# Kiến trúc AI-CLO EXAM

## 1. Biên hệ thống

`/exam/` là app con cùng thương hiệu AI-CLO nhưng dùng backend riêng. Không phụ thuộc database, Gemini hoặc nghiệp vụ của AI-CLO chính.

```text
GitHub Pages /exam/
        |
        +-- Staff browser -> Supabase Auth + RLS
        |
        +-- Student browser -> Edge Function student-exam -> service role -> DB
        |
        +-- Private Storage exam-files
```

## 2. Miền dữ liệu

```text
Exam
 ├─ ExamMember (quyền theo kỳ thi)
 ├─ Session (ca thi)
 │   ├─ Room
 │   │   ├─ RoomStaff
 │   │   └─ Student
 │   └─ Paper
 │       ├─ PaperVersion
 │       ├─ QuestionGroup / GroupVersion
 │       └─ Question / QuestionVersion
 └─ Attempt
     ├─ AttemptSession (opaque device token)
     ├─ AttemptQuestion (snapshot tham chiếu + thứ tự trộn)
     ├─ AttemptAnswer
     └─ AttemptEvent
```

Không copy toàn bộ nội dung đề cho từng sinh viên. `attempt_questions` lưu `question_version_id`, `display_no` và `choice_order`; vì question version là bất biến nên vẫn tái dựng chính xác đề cũ nhưng tiết kiệm database.

## 3. Frontend module

- `core/`: hạ tầng chung, không chứa nghiệp vụ môn học.
- `services/`: ranh giới duy nhất tới Supabase/API/storage/export.
- `features/`: màn hình và orchestration theo nghiệp vụ.
- `components/`: UI tái sử dụng, không tự gọi database.
- `state.js`: trạng thái điều hướng/UI cần giữ giữa các màn hình.

`app.js` chỉ bootstrap và route, không được trở thành file nghiệp vụ lớn.

## 4. Quy tắc bất biến

- Một ca có tối đa một `exam_papers` hiện hành.
- Một sinh viên chỉ có một attempt hoạt động theo mặc định.
- Access code chỉ lưu hash.
- Opaque attempt token chỉ lưu hash ở DB; token thô nằm ở sessionStorage của thiết bị.
- Deadline lấy từ server.
- Hotfix không thay đổi question version đã được sinh viên nhìn thấy.
- Đáp án đúng không đi xuống client sinh viên.
- Asset bucket là private và chỉ cấp signed URL ngắn hạn.

## 5. Tải đồng thời

LIVE dùng polling từ số ít staff, không mở Realtime socket cho mỗi sinh viên. Student autosave theo thao tác và heartbeat khoảng 15 giây. Mục tiêu test tải: 500 client giả lập dù nhu cầu hiện tại khoảng 200 SV/ca.

## 6. Khả năng thay Storage

Feature không gọi `supabase.storage` trực tiếp. `services/storage.js` là adapter. Khi chuyển sang Cloudflare R2 chỉ thay adapter/API cấp URL, không thay schema nghiệp vụ; `exam_assets.provider` đã hỗ trợ `supabase` và `r2`.

## 7. Versioning

Paper và question có version riêng. Khi hotfix:

1. Tạo question version mới.
2. Tạo paper version mới.
3. Attempt chưa bắt đầu trỏ paper version mới.
4. Attempt đang làm nhưng chưa nhìn câu: cập nhật question version của câu đó.
5. Attempt đã nhìn câu: giữ version cũ.
6. Ghi audit log tác động.

## 8. Retention

`retention_days` mặc định 30. Không tự động xóa khi đến hạn. Sau thời gian này Admin/Khảo thí có thể export archive rồi quyết định giữ hoặc xóa theo quy trình có audit.
