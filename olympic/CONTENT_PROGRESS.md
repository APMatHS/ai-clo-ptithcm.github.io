# Tiến độ nâng cấp nội dung Olympic

_Cập nhật: 20/09/2026_

## Mục tiêu chung

Nội dung Olympic được xây theo hướng **thi thực tế**, không dừng ở mức ôn tập học phần. Mỗi chủ đề cần tăng dần từ nền tảng chọn lọc đến kỹ thuật Olympic, phối hợp nhiều ý, bài thi thực chiến và thử thách.

Chuẩn đang áp dụng:

- Mỗi chủ đề ưu tiên khoảng **6 bài học** theo lộ trình tăng dần.
- Mỗi bài học có mục tiêu, kỹ thuật Olympic, ví dụ có phân tích chiến lược, lưu ý phòng thi và sai lầm thường gặp.
- Mỗi bài có **đề luyện 4 câu** theo tầng: Củng cố → Biến thể → Olympic → Thử thách.
- Không tạo nội dung quá cơ bản hoặc lặp lại giáo trình đại trà.
- Tăng liên kết giữa các ngôn ngữ: **ma trận ↔ ánh xạ tuyến tính ↔ kernel/image ↔ dimension ↔ trực giao ↔ cấu trúc phổ ↔ truy hồi ↔ đa thức**.
- Đề luyện trong `olympic_tests` hiện chỉ lưu nội dung đề, không nhúng lời giải. Trường `answer_tex` thuộc ngân hàng bài toán (`olympic_problems`) và phần lời giải sẽ tiếp tục được tách/siết quyền khi triển khai.

## Định hướng bám đề gần đây

- Ưu tiên đề cương Olympic Toán sinh viên toàn quốc 2026 và các đề/đề đề nghị 2024–2026; đồng thời tham khảo kỷ yếu các kỳ thi gần đây của Hội Toán học Việt Nam.
- Nhóm trọng tâm Đại số tuyến tính: hệ phương trình, hạng, định thức, nghịch đảo, không gian–ánh xạ tuyến tính, trị riêng, đa thức đặc trưng/tối tiểu, chéo hóa; với bảng A chú ý thêm ma trận đặc biệt và Cayley–Hamilton.
- Đề cương 2026 nêu trực tiếp ma trận đối xứng, phản đối xứng, Hermite và **ma trận trực giao** ở phần bảng A; vì vậy phần Euclide–trực giao được ưu tiên theo hướng cấu trúc ma trận, phổ và bất biến chuẩn.
- Dạng toàn phương không được nêu thành mục riêng trong đề cương 2026, nên giữ như phần mở rộng hỗ trợ ma trận đối xứng, chéo hóa trực giao, xác định dương và cực trị; không để chiếm tỷ trọng lớn hơn các chủ đề cốt lõi.
- Đề 2026 có dạng toán tử tuyến tính–trị riêng và bài giao hoán tử dùng trực tiếp `tr(AB)=tr(BA)`; các bài mới phải tăng kỹ năng nhận cấu trúc thay vì chỉ tính toán cơ học.
- Đề đề nghị 2024 có trực tiếp các cấu trúc khối `[[A,B],[B,A]]` và `[[A,-B],[B,A]]`; vì vậy phần ma trận khối ưu tiên đồng dạng khối, tổng–hiệu và thực hóa ma trận phức.
- Đề tuyển Olympic 2026 của ĐH Bách Khoa Hà Nội có dạng phương trình `A^3+B=BA` và yêu cầu suy ra giao hoán; vì vậy chủ đề phương trình ma trận bổ sung riêng kỹ thuật **đồng nhất thức đa thức → khả nghịch → ép giao hoán**.
- Kỷ yếu Olympic 2024 có riêng chuyên đề/bài giảng về đa thức; vì vậy phần Đa thức được xây theo hướng cấu trúc nghiệm, nội suy, đồng nhất thức, bất khả quy và cực trị, tránh biến thành ôn tập phổ thông thuần túy.
- Nội dung Markov không phải trọng tâm đề cương 2026; chỉ giữ như ứng dụng phụ của lũy thừa ma trận. Trọng tâm chủ đề này chuyển sang Cayley–Hamilton, đa thức tối tiểu, phần lũy linh, truy hồi và lũy thừa toán tử.

## Tiến độ hiện tại

Tổng số mục nội dung của môn Đại số: **27**.

Đã nâng theo chuẩn Olympic: **15/27**.

### Đại số tuyến tính — đã hoàn thành 14/14

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
12. ✅ Phương trình ma trận & ma trận giao hoán
13. ✅ Không gian Euclide & trực giao
14. ✅ Dạng toàn phương

### Đa thức — đã hoàn thành 1/6

1. ✅ Nghiệm & đạo hàm đa thức
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

## Các chủ đề Đại số tuyến tính vừa nâng

### Chéo hóa ma trận

6 bài: bội đại số–bội hình học, tham số và đa thức tối tiểu, dựng cơ sở riêng và tính lũy thừa, phân biệt trên R/C và ma trận cấu trúc, chéo hóa đồng thời–giao hoán, chéo hóa trực giao.

### Vết & ma trận lũy linh

6 bài: vết và đổi thứ tự tích, giao hoán tử vết 0, ma trận cấp 2 vết 0, lũy linh–hạng–kernel, idempotent/phép chiếu, bài tổng hợp vết–phổ–đồng nhất thức. Có bài luyện bám trực tiếp ý tưởng của đề quốc gia 2026.

### Lũy thừa ma trận & truy hồi tuyến tính

6 bài, chuyển trọng tâm khỏi Markov: chéo hóa, Cayley–Hamilton, dạng `λI+N`, truy hồi tuyến tính, lũy thừa toán tử `T^n(p)`; Markov chỉ còn một bài ứng dụng phụ.

### Ma trận khối & ma trận nghịch đảo

6 bài: biến đổi khối và tam giác hóa; cấu trúc `[[A,B],[B,A]]`; thực hóa `A+iB`; đồng nhất thức `I-AB` và `I-BA`; phần bù Schur như phép khử khối; cập nhật hạng một `I+uv^T` và nghịch đảo nhanh.

### Phương trình ma trận & ma trận giao hoán

6 bài: `AX=B` qua ảnh–kernel; `AX=XB` và giao của hai phổ; không gian giao hoán `C(A)` và trường hợp phổ đơn; phản giao hoán `AX+XA=0`; kỹ thuật đồng nhất thức ép khả nghịch rồi suy ra giao hoán; bài tổng hợp bằng không gian bất biến và `p(A)X=Xp(B)`.

### Không gian Euclide & trực giao

6 bài: Cauchy–Schwarz qua ma trận Gram; `(Im A)^⊥=ker A^T` và `(ker A)^⊥=Im A^T`; Gram–Schmidt/QR như công cụ; phép chiếu và phản xạ Householder; ma trận trực giao với cấu trúc phổ–định thức; định lý phổ cho ma trận đối xứng.

### Dạng toàn phương

6 bài, giữ tỷ trọng như phần mở rộng: biểu diễn `x^TAx` và công thức phân cực; đồng dư và chỉ số quán tính; tiêu chuẩn Sylvester cho bài tham số; xác định dương qua trị riêng và phân tích Gram; thương Rayleigh và cực trị; bài tổng hợp ma trận hạng một `αI+βuu^T`.

## Chủ đề Đa thức vừa nâng

### Nghiệm & đạo hàm đa thức

Đã nâng từ 4 lên 6 bài, mỗi bài có đề luyện 4 câu. Trọng tâm mới: nghiệm bội và `gcd(P,P')`; Rolle lặp và đạo hàm cao; đếm nghiệm bằng đơn điệu–độ lồi–bảng dấu; bài tham số với nghiệm kép là điểm chuyển pha; Gauss–Lucas và hình học nghiệm phức như phần nâng cao; Mini Olympic tổng hợp. Quy tắc dấu Descartes được hạ thành công cụ phụ thay vì chiếm riêng một bài.

## Thứ tự tiếp tục

Phần **Đại số tuyến tính đã hoàn thành 14/14**. Tiếp tục phần **Đa thức**:

1. Viète & tổng Newton
2. Nội suy Lagrange
3. Đa thức bất khả quy
4. Phương trình hàm đa thức
5. Chebyshev & cực trị đa thức

Sau đó mới chuyển sang **Tổ hợp – Rời rạc**.

## Nguyên tắc làm việc

- Làm **từng chủ đề một**, không nâng hàng loạt máy móc.
- Trước khi chỉnh, đọc lại nội dung hiện có và tài liệu lộ trình/đề thi liên quan.
- Ưu tiên các dạng bài có giá trị luyện thi: tham số, cấu trúc, bất biến, cực trị, chứng minh, phối hợp nhiều công cụ.
- Nếu một nội dung không nằm trong trọng tâm đề cương gần đây, hạ xuống mức ứng dụng/phần mở rộng thay vì cho chiếm tỷ trọng lớn.
- Sau mỗi chủ đề, kiểm tra lại số bài học, số đề luyện và số câu cấu trúc trước khi chuyển sang chủ đề kế tiếp.
- Chỉ sửa dữ liệu Supabase khi thay nội dung; không sửa frontend nếu không cần thiết.

## Trạng thái tiếp theo

**Chủ đề kế tiếp: Viète & tổng Newton.**

Mục tiêu: không dừng ở việc nhắc lại công thức Viète; ưu tiên biểu thức đối xứng theo nghiệm, truy hồi Newton cho tổng lũy thừa, dựng đa thức từ dữ kiện về nghiệm, các bài tham số và biến đổi nghiệm, cùng các bài chứng minh đồng nhất thức mà không cần giải phương trình.