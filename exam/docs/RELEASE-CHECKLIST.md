# Checklist trước một đợt thi thật

## 1. Hệ thống

- [ ] GitHub Action `Exam Source Check` xanh.
- [ ] Supabase project `ACTIVE_HEALTHY`.
- [ ] Security Advisor không có WARN chưa xử lý.
- [ ] Performance Advisor không có WARN chưa xử lý.
- [ ] Edge Functions cần thiết đều `ACTIVE`.
- [ ] Storage `exam-files` private và còn đủ dung lượng.
- [ ] Kiểm tra dung lượng/băng thông dự kiến, đặc biệt audio Anh văn.

## 2. Kỳ thi

- [ ] Đúng môn, loại thi, năm học/học kỳ.
- [ ] Chế độ hiện điểm đúng quy định.
- [ ] Đã gán Chủ kỳ thi/Khảo thí/GV/Giám thị.
- [ ] Ca thi đúng giờ, thời lượng không vượt cửa sổ ca.
- [ ] Phòng thi đúng sức chứa.
- [ ] Cuối kỳ: mỗi phòng đã có giám thị.

## 3. Sinh viên

- [ ] Import roster thành công.
- [ ] MSSV/họ tên/lớp/ca/phòng đã đối chiếu.
- [ ] Mỗi SV có mã thi.
- [ ] Đã xuất Excel/PDF mã thi và lưu an toàn.
- [ ] Không có roster trùng hoặc gắn sai phòng.

## 4. Đề

- [ ] Word/PDF gốc đã lưu trong `Tài liệu gốc`.
- [ ] Preview nội dung/công thức/ảnh/audio trên desktop và mobile.
- [ ] Mỗi ca có đúng một đề.
- [ ] Đúng cấu trúc generic hoặc English Part/passage/audio.
- [ ] Đáp án đúng khớp lựa chọn.
- [ ] Điểm từng câu đúng.
- [ ] Ảnh/audio mở được bằng signed URL.
- [ ] Đề đã khóa.

## 5. Preflight & diễn tập

- [ ] Tab `Kiểm tra trước thi` không còn lỗi chặn.
- [ ] Diễn tập 5–10 tài khoản thử.
- [ ] Kiểm thử reload giữa bài.
- [ ] Kiểm thử mất mạng và đồng bộ lại.
- [ ] Kiểm thử đổi máy qua giám thị.
- [ ] Kiểm thử khóa/mở bài.
- [ ] Kiểm thử hotfix câu đã xem/chưa xem.
- [ ] Kiểm thử nộp bài/hết giờ.
- [ ] Kiểm thử LIVE theo đúng phòng và không lộ đáp án.

## 6. Sau thi thử

- [ ] Điểm server khớp đáp án mẫu.
- [ ] Excel tổng hợp đúng.
- [ ] Excel chi tiết đúng thứ tự câu/đáp án đã trộn.
- [ ] Hồ sơ một SV dựng lại đúng và in/lưu PDF được.
- [ ] Quyền xem đáp án đúng hoạt động đúng.

## 7. Tải

- [ ] Stress test mục tiêu 500 client giả lập trước lần production đầu tiên.
- [ ] Autosave/heartbeat không tạo lỗi đáng kể.
- [ ] LIVE staff vẫn phản hồi tốt khi tải cao.

## 8. Kết thúc kỳ thi

- [ ] Đóng kỳ thi sau khi không còn attempt đang làm/bị khóa.
- [ ] Xuất các hồ sơ cần lưu.
- [ ] Ghi nhận thời điểm đủ retention.
- [ ] Chỉ Admin thực hiện purge sau khi xem preview, nhập đúng mã kỳ thi và xác nhận đã lưu hồ sơ.
