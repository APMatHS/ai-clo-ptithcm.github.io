# Tiến độ nâng cấp nội dung Olympic

_Cập nhật: 20/09/2026_

## Mục tiêu chung

Nội dung Olympic được xây theo hướng **thi thực tế**, không dừng ở mức ôn tập học phần. Mỗi chủ đề cần tăng dần từ nền tảng chọn lọc đến kỹ thuật Olympic, phối hợp nhiều ý, bài thi thực chiến và thử thách.

Chuẩn đang áp dụng:

- Mỗi chủ đề ưu tiên khoảng **6 bài học** theo lộ trình tăng dần.
- Mỗi bài học có mục tiêu, kỹ thuật Olympic, ví dụ có phân tích chiến lược, lưu ý phòng thi và sai lầm thường gặp.
- Mỗi bài có **đề luyện 4 câu** theo tầng: Củng cố → Biến thể → Olympic → Thử thách.
- Không tạo nội dung quá cơ bản hoặc lặp lại giáo trình đại trà.
- Tăng liên kết giữa các ngôn ngữ: **ma trận ↔ ánh xạ tuyến tính ↔ kernel/image ↔ dimension ↔ cấu trúc phổ ↔ truy hồi**.
- `answer_tex` của đề luyện hiện để trống để tránh lộ lời giải qua API; phần lời giải sẽ tách/siết quyền sau.

## Định hướng bám đề gần đây

- Ưu tiên đề cương Olympic Toán sinh viên toàn quốc 2026 và các đề 2024–2026.
- Nhóm trọng tâm Đại số tuyến tính: hệ phương trình, hạng, định thức, nghịch đảo, không gian–ánh xạ tuyến tính, trị riêng, đa thức đặc trưng/tối tiểu, chéo hóa; với bảng A chú ý thêm ma trận đặc biệt và Cayley–Hamilton.
- Đề 2026 có dạng toán tử tuyến tính–trị riêng và bài giao hoán tử dùng trực tiếp `tr(AB)=tr(BA)`; các bài mới phải tăng kỹ năng nhận cấu trúc thay vì chỉ tính toán cơ học.
- Nội dung Markov không phải trọng tâm đề cương 2026; chỉ giữ như ứng dụng phụ của lũy thừa ma trận. Trọng tâm chủ đề này chuyển sang Cayley–Hamilton, đa thức tối tiểu, phần lũy linh, truy hồi và lũy thừa toán tử.

## Tiến độ hiện tại

Tổng số mục nội dung của môn Đại số: **27**.

Đã nâng theo chuẩn Olympic: **10/27**.

### Đại số tuyến tính — đã hoàn thành 10/14

1. ✅ Hệ phương trình tuyến tính & mô hình hóa
2. ✅ Định thức
3. ✅ Hạng ma trận & không gian nghiệm
4. ✅ Không gian vector
5. ✅ Ánh xạ tuyến tính
6. ✅ Giá trị riêng & vector riêng
7. ✅ Đa thức đặc trưng & đa thức tối tiểu
8. ✅ Chéo hóa ma trận
9. ✅ Vết & ma trận lũy linh
10. ✅ Lũy thừa ma trận & truy hồi tuyến tính
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

## Ba chủ đề vừa nâng

### Chéo hóa ma trận

Đã chuyển thành 6 bài theo hướng thi: bội đại số–bội hình học, tham số và đa thức tối tiểu, dựng cơ sở riêng và tính lũy thừa, phân biệt trên R/C và ma trận cấu trúc, chéo hóa đồng thời–giao hoán, chéo hóa trực giao.

### Vết & ma trận lũy linh

Đã chuyển thành 6 bài: vết và đổi thứ tự tích, giao hoán tử vết 0, ma trận cấp 2 vết 0, lũy linh–hạng–kernel, idempotent/phép chiếu, bài tổng hợp vết–phổ–đồng nhất thức. Có bài luyện bám trực tiếp ý tưởng của đề quốc gia 2026.

### Lũy thừa ma trận & truy hồi tuyến tính

Đã chuyển trọng tâm khỏi Markov: chéo hóa, Cayley–Hamilton, dạng `λI+N`, truy hồi tuyến tính, lũy thừa toán tử `T^n(p)`; Markov chỉ còn một bài ứng dụng phụ.

## Thứ tự tiếp tục

Làm hết phần Đại số tuyến tính trước:

1. Ma trận khối & ma trận nghịch đảo
2. Phương trình ma trận & ma trận giao hoán
3. Không gian Euclide & trực giao
4. Dạng toàn phương

Sau đó mới chuyển sang **Đa thức**, cuối cùng là **Tổ hợp – Rời rạc**.

## Nguyên tắc làm việc

- Làm **từng chủ đề một**, không nâng hàng loạt máy móc.
- Trước khi chỉnh, đọc lại nội dung hiện có và tài liệu lộ trình/đề thi liên quan.
- Ưu tiên các dạng bài có giá trị luyện thi: tham số, cấu trúc, bất biến, cực trị, chứng minh, phối hợp nhiều công cụ.
- Nếu một nội dung không nằm trong trọng tâm đề cương gần đây, hạ xuống mức ứng dụng/phần mở rộng thay vì cho chiếm tỷ trọng lớn.
- Sau mỗi chủ đề, kiểm tra lại số bài học, số đề luyện và số câu cấu trúc trước khi chuyển sang chủ đề kế tiếp.
- Chỉ sửa dữ liệu Supabase khi thay nội dung; không sửa frontend nếu không cần thiết.

## Trạng thái tiếp theo

**Chủ đề kế tiếp: Ma trận khối & ma trận nghịch đảo.**

Mục tiêu: bám phần ma trận nghịch đảo trong đề cương 2026, nhưng nâng lên mức Olympic bằng cấu trúc khối, biến đổi sơ cấp có chiến lược, đồng dạng khối, định thức/khả nghịch và các công thức nghịch đảo thực sự hữu ích; tránh sa vào công thức Schur quá nặng nếu không phục vụ dạng đề.
