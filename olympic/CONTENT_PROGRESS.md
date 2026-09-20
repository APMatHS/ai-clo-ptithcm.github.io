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

- Ưu tiên đề cương Olympic Toán sinh viên toàn quốc 2026 và các đề/đề đề nghị 2024–2026.
- Nhóm trọng tâm Đại số tuyến tính: hệ phương trình, hạng, định thức, nghịch đảo, không gian–ánh xạ tuyến tính, trị riêng, đa thức đặc trưng/tối tiểu, chéo hóa; với bảng A chú ý thêm ma trận đặc biệt và Cayley–Hamilton.
- Đề 2026 có dạng toán tử tuyến tính–trị riêng và bài giao hoán tử dùng trực tiếp `tr(AB)=tr(BA)`; các bài mới phải tăng kỹ năng nhận cấu trúc thay vì chỉ tính toán cơ học.
- Đề đề nghị 2024 có trực tiếp các cấu trúc khối `[[A,B],[B,A]]` và `[[A,-B],[B,A]]`; vì vậy phần ma trận khối ưu tiên đồng dạng khối, tổng–hiệu và thực hóa ma trận phức.
- Nội dung Markov không phải trọng tâm đề cương 2026; chỉ giữ như ứng dụng phụ của lũy thừa ma trận. Trọng tâm chủ đề này chuyển sang Cayley–Hamilton, đa thức tối tiểu, phần lũy linh, truy hồi và lũy thừa toán tử.

## Tiến độ hiện tại

Tổng số mục nội dung của môn Đại số: **27**.

Đã nâng theo chuẩn Olympic: **11/27**.

### Đại số tuyến tính — đã hoàn thành 11/14

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
11. ✅ Ma trận khối & ma trận nghịch đảo
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

## Bốn chủ đề vừa nâng

### Chéo hóa ma trận

Đã chuyển thành 6 bài theo hướng thi: bội đại số–bội hình học, tham số và đa thức tối tiểu, dựng cơ sở riêng và tính lũy thừa, phân biệt trên R/C và ma trận cấu trúc, chéo hóa đồng thời–giao hoán, chéo hóa trực giao.

### Vết & ma trận lũy linh

Đã chuyển thành 6 bài: vết và đổi thứ tự tích, giao hoán tử vết 0, ma trận cấp 2 vết 0, lũy linh–hạng–kernel, idempotent/phép chiếu, bài tổng hợp vết–phổ–đồng nhất thức. Có bài luyện bám trực tiếp ý tưởng của đề quốc gia 2026.

### Lũy thừa ma trận & truy hồi tuyến tính

Đã chuyển trọng tâm khỏi Markov: chéo hóa, Cayley–Hamilton, dạng `λI+N`, truy hồi tuyến tính, lũy thừa toán tử `T^n(p)`; Markov chỉ còn một bài ứng dụng phụ.

### Ma trận khối & ma trận nghịch đảo

Đã nâng từ 4 lên 6 bài, mỗi bài có đề luyện 4 câu. Trọng tâm: biến đổi khối và tam giác hóa; cấu trúc `[[A,B],[B,A]]` với cơ sở tổng–hiệu; thực hóa `A+iB` qua `[[A,-B],[B,A]]`; đồng nhất thức `I-AB` và `I-BA`, định thức Sylvester; phần bù Schur như phép khử khối; cập nhật hạng một `I+uv^T` và nghịch đảo nhanh. Hạn chế học thuộc công thức nặng, ưu tiên nhận cấu trúc.

## Thứ tự tiếp tục

Làm hết phần Đại số tuyến tính trước:

1. Phương trình ma trận & ma trận giao hoán
2. Không gian Euclide & trực giao
3. Dạng toàn phương

Sau đó mới chuyển sang **Đa thức**, cuối cùng là **Tổ hợp – Rời rạc**.

## Nguyên tắc làm việc

- Làm **từng chủ đề một**, không nâng hàng loạt máy móc.
- Trước khi chỉnh, đọc lại nội dung hiện có và tài liệu lộ trình/đề thi liên quan.
- Ưu tiên các dạng bài có giá trị luyện thi: tham số, cấu trúc, bất biến, cực trị, chứng minh, phối hợp nhiều công cụ.
- Nếu một nội dung không nằm trong trọng tâm đề cương gần đây, hạ xuống mức ứng dụng/phần mở rộng thay vì cho chiếm tỷ trọng lớn.
- Sau mỗi chủ đề, kiểm tra lại số bài học, số đề luyện và số câu cấu trúc trước khi chuyển sang chủ đề kế tiếp.
- Chỉ sửa dữ liệu Supabase khi thay nội dung; không sửa frontend nếu không cần thiết.

## Trạng thái tiếp theo

**Chủ đề kế tiếp: Phương trình ma trận & ma trận giao hoán.**

Mục tiêu: ưu tiên các phương trình `AX=XB`, `AX=XA`, `AX+XA=0`, nghiệm của phương trình đa thức theo ma trận, không gian giao hoán của ma trận có phổ đơn, và các bài dùng chéo hóa/khối bất biến để hạ phương trình ma trận thành các điều kiện vô hướng. Tránh biến chủ đề thành giải hệ tuyến tính cơ học trên `n^2` ẩn nếu còn cấu trúc tốt hơn.