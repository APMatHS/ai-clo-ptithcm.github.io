# Luồng vận hành kỳ thi

## A. Chuẩn bị

1. Tạo kỳ thi; chọn môn/nhóm môn, giữa kỳ/cuối kỳ, cách hiện điểm.
2. Gán nhân sự và quyền theo kỳ thi.
3. Tạo ca thi.
4. Tạo các phòng trong từng ca; cuối kỳ gán giám thị theo phòng.
5. Import danh sách SV từ Excel/CSV.
6. Sinh mã thi; tải Excel hoặc in/lưu PDF để phát.
7. Tạo đề cho từng ca; upload Word/PDF gốc để lưu đối chiếu.
8. Soạn/hiệu chỉnh câu bằng rich editor, ảnh/audio nếu cần.
9. Khóa đề.
10. Chạy tab `Kiểm tra trước thi` và xử lý lỗi chặn.
11. Chạy diễn tập trước kỳ thi thật.

## B. Sinh viên vào thi

1. Nhập MSSV + mã thi.
2. Server xác thực kỳ thi/ca/phòng/trạng thái/mã hash.
3. Nếu đang có bài trên thiết bị khác, yêu cầu giám thị cho chuyển máy.
4. Đến giờ mới cho bắt đầu.
5. Server tạo attempt questions và thứ tự trộn ổn định một lần.
6. Deadline được tính ở server và không reset khi reload/chuyển máy.

## C. Trong lúc thi

- Mỗi thay đổi đáp án được ghi local trước rồi đồng bộ server.
- Heartbeat khoảng 15 giây.
- LIVE staff polling nhẹ, không dùng một Realtime socket cho mỗi SV.
- Ghi nhận tab hidden, focus loss, reload, offline/online, đổi thiết bị.
- Không tự khóa chỉ vì cảnh báo; giám thị quyết định.
- Giám thị không thấy SV đang chọn A/B/C/D.

## D. Sự cố

### Chuyển máy

Giám thị cho phép chuyển máy -> revoke session cũ -> SV đăng nhập máy mới -> tiếp tục attempt cũ, giữ deadline.

### Khóa/mở

Giám thị có thể khóa bài và ghi lý do. Mở lại không tự kéo dài thời gian trừ khi dùng chức năng reopen/gia hạn được cấp quyền.

### Hotfix đề

Sửa câu tạo version mới. Sinh viên đã nhìn thấy câu giữ bản cũ; SV chưa nhìn thấy nhận bản sửa. Tất cả tác động ghi audit.

## E. Nộp và chấm

- Sinh viên nộp thủ công hoặc client tự nộp khi deadline; server cũng kiểm deadline ở question/heartbeat/save.
- Chấm trên server từ `question_version_id` của chính attempt.
- Frontend sinh viên không nhận đáp án đúng trong lúc thi.
- Hiện điểm theo `score_visibility`: hidden / immediate / after_close.

## F. Sau thi

- Excel tổng hợp.
- Excel chi tiết từng câu.
- Dựng lại đúng đề đã trộn + lựa chọn SV.
- Bản đối chiếu không cần đáp án đúng.
- Bản chấm/phúc khảo chỉ hiện đáp án đúng khi có `view_correct_answers`.
- Browser print có thể lưu PDF.
- Giữ hồ sơ tối thiểu 30 ngày; không tự xóa.
