# Tiến độ nâng cấp nội dung Olympic

_Cập nhật: 19/09/2026_

## Mục tiêu chung

Nội dung Olympic được xây theo hướng **thi thực tế**, không dừng ở mức ôn tập học phần. Mỗi chủ đề cần tăng dần từ nền tảng chọn lọc đến kỹ thuật Olympic, phối hợp nhiều ý, bài thi thực chiến và thử thách.

Chuẩn đang áp dụng:

- Mỗi chủ đề ưu tiên khoảng **6 bài học** theo lộ trình tăng dần.
- Mỗi bài học có mục tiêu, kỹ thuật Olympic, ví dụ có phân tích chiến lược, lưu ý phòng thi và sai lầm thường gặp.
- Mỗi bài có **đề luyện 4 câu** theo tầng: Củng cố → Biến thể → Olympic → Thử thách.
- Không tạo nội dung quá cơ bản hoặc lặp lại giáo trình đại trà.
- Tăng liên kết giữa các ngôn ngữ: **ma trận ↔ ánh xạ tuyến tính ↔ kernel/image ↔ dimension ↔ mô hình thực tế**.
- `answer_tex` của đề luyện hiện để trống để tránh lộ lời giải qua API; phần lời giải sẽ tách/siết quyền sau.

## Tiến độ hiện tại

Tổng số mục nội dung của môn Đại số: **27**.

Đã nâng theo chuẩn Olympic: **7/27**.

### Đại số tuyến tính — đã hoàn thành 7/14

1. ✅ Hệ phương trình tuyến tính & mô hình hóa
2. ✅ Định thức
3. ✅ Hạng ma trận & không gian nghiệm
4. ✅ Không gian vector
5. ✅ Ánh xạ tuyến tính
6. ✅ Giá trị riêng & vector riêng
7. ✅ Đa thức đặc trưng & đa thức tối tiểu
8. ⬜ Chéo hóa ma trận
9. ⬜ Vết & ma trận lũy linh
10. ⬜ Lũy thừa ma trận & mô hình Markov
11. ⬜ Ma trận khối & ma trận nghịch đảo
12. ⬜ Phương trình ma trận & ma trận giao hoán
13. ⬜ Không gian Euclide & trực giao
14. ⬜ Dạng toàn phương

### Đa thức — còn 6/6

1. ⬜ Nghiệm & đạo hàm đa thức
2. ⬜ Viète & tổng Newton
3. ⬜ Nội suy Lagrange
4. ⬜ Đa thức bất khả quy
5. ⬜ Phương trình hàm đa thức
6. ⬜ Chebyshev & cực trị đa thức

### Tổ hợp – Rời rạc — còn 7/7

1. ⬜ Nguyên lý đếm; hoán vị – chỉnh hợp – tổ hợp
2. ⬜ Nhị thức Newton & đồng nhất thức tổ hợp
3. ⬜ Nguyên lý Dirichlet
4. ⬜ Đếm hai cách & nguyên lý bù trừ
5. ⬜ Hệ thức truy hồi
6. ⬜ Bất biến & nguyên lý cực hạn
7. ⬜ Đồ thị cơ bản

## Thứ tự đề nghị tiếp tục

Làm hết phần Đại số tuyến tính trước:

1. Chéo hóa ma trận
2. Vết & ma trận lũy linh
3. Lũy thừa ma trận & mô hình Markov
4. Ma trận khối & ma trận nghịch đảo
5. Phương trình ma trận & ma trận giao hoán
6. Không gian Euclide & trực giao
7. Dạng toàn phương

Sau đó mới chuyển sang **Đa thức**, cuối cùng là **Tổ hợp – Rời rạc**.

## Nguyên tắc làm việc

- Làm **từng chủ đề một**, không nâng hàng loạt máy móc.
- Trước khi chỉnh, đọc lại nội dung hiện có và tài liệu lộ trình/đề thi liên quan.
- Ưu tiên các dạng bài có giá trị luyện thi: tham số, cấu trúc, bất biến, cực trị, chứng minh, phối hợp nhiều công cụ.
- Sau mỗi chủ đề, kiểm tra lại số bài học, số đề luyện và số câu cấu trúc trước khi chuyển sang chủ đề kế tiếp.
- Chỉ sửa dữ liệu Supabase khi thay nội dung; không sửa frontend/GitHub nếu không cần thiết.

## Trạng thái tiếp theo

**Chủ đề kế tiếp: Chéo hóa ma trận.**

Mục tiêu: không chỉ dạy thuật toán `P^{-1}AP=D`, mà tập trung vào tiêu chuẩn chéo hóa, bội hình học, đa thức tối tiểu, cơ sở riêng, chéo hóa đồng thời và các cách nhận biết nhanh trong bài thi Olympic.
