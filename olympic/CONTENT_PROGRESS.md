# Tiến độ nâng cấp nội dung Olympic

_Cập nhật: 20/09/2026_

## Mục tiêu chung

Nội dung Olympic được xây theo hướng **thi thực tế**, không dừng ở mức ôn tập học phần. Mỗi chủ đề tăng dần từ nền tảng chọn lọc đến kỹ thuật Olympic, phối hợp nhiều ý, bài thi thực chiến và thử thách.

Chuẩn đang áp dụng:

- Mỗi chủ đề ưu tiên khoảng **6 bài học** theo lộ trình tăng dần.
- Mỗi bài học có mục tiêu, kỹ thuật Olympic, ví dụ/chiến lược và sai lầm thường gặp.
- Mỗi bài có **đề luyện 4 câu** theo tầng: Củng cố → Biến thể → Olympic → Thử thách.
- Không tạo nội dung quá cơ bản hoặc lặp lại giáo trình đại trà.
- Tăng liên kết giữa các ngôn ngữ: **ma trận ↔ ánh xạ tuyến tính ↔ kernel/image ↔ dimension ↔ trực giao ↔ cấu trúc phổ ↔ truy hồi ↔ đa thức**.
- Đề luyện trong `olympic_tests` hiện chỉ lưu nội dung đề, không nhúng lời giải. Trường `answer_tex` thuộc ngân hàng bài toán (`olympic_problems`) và phần lời giải sẽ tiếp tục được tách/siết quyền khi triển khai.

## Định hướng bám đề gần đây

- Ưu tiên đề cương Olympic Toán sinh viên toàn quốc 2026 và các đề/đề đề nghị 2024–2026; đồng thời tham khảo kỷ yếu các kỳ thi gần đây của Hội Toán học Việt Nam.
- Phần Đại số tuyến tính đã bám các mạch xuất hiện trực tiếp trong đề cương và đề gần đây: hạng, định thức, nghịch đảo, ánh xạ tuyến tính, trị riêng, chéo hóa, ma trận đặc biệt, Cayley–Hamilton, vết và giao hoán.
- Kỷ yếu Olympic 2024–2025 có nhiều bài/chuyên đề đa thức, nên phần Đa thức ưu tiên **cấu trúc nghiệm, đối xứng, nội suy, bất khả quy, hợp thành và cực trị**, tránh biến thành ôn phổ thông thuần túy.
- Nội dung nâng cao chỉ giữ khi tạo giá trị giải bài rõ ràng: Gauss–Lucas, sai phân hữu hạn, cyclotomic nguyên tố, liên hợp affine, Chebyshev–Markov.

## Tiến độ hiện tại

Tổng số mục nội dung của môn Đại số: **27**.

Đã nâng theo chuẩn Olympic: **20/27**.

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

### Đa thức — đã hoàn thành 6/6

1. ✅ Nghiệm & đạo hàm đa thức
2. ✅ Viète & tổng Newton
3. ✅ Nội suy Lagrange
4. ✅ Đa thức bất khả quy
5. ✅ Phương trình hàm đa thức
6. ✅ Chebyshev & cực trị đa thức

### Tổ hợp – Rời rạc — còn 7/7

1. ⬜ Nguyên lý đếm; hoán vị – chỉnh hợp – tổ hợp
2. ⬜ Nhị thức Newton & đồng nhất thức tổ hợp
3. ⬜ Nguyên lý Dirichlet
4. ⬜ Đếm hai cách & nguyên lý bù trừ
5. ⬜ Hệ thức truy hồi
6. ⬜ Bất biến & nguyên lý cực hạn
7. ⬜ Đồ thị cơ bản

## Phần Đa thức đã hoàn thành

### Nghiệm & đạo hàm đa thức

6 bài: nghiệm bội và `gcd(P,P')`; Rolle lặp và đạo hàm cao; đếm nghiệm bằng đơn điệu–độ lồi–bảng dấu; bài tham số với nghiệm kép là điểm chuyển pha; Gauss–Lucas và hình học nghiệm phức; Mini Olympic tổng hợp. Descartes chỉ giữ như công cụ phụ.

### Viète & tổng Newton

6 bài: Viète và đa thức đối xứng; tổng Newton như truy hồi; biến đổi nghiệm (nghịch đảo, tịnh tiến); bài toán ngược dựng đa thức; log-đạo-hàm `P'/P` cho tổng phân thức theo nghiệm; Mini Olympic Viète–Newton. Trọng tâm là không giải phương trình nếu chỉ cần dữ liệu đối xứng.

### Nội suy Lagrange

6 bài: tính duy nhất và đủ số điểm; cơ sở Lagrange; công thức `Q'(x_i)` và các tổng Lagrange; sai phân hữu hạn trên lưới nguyên; phần dư modulo `Q(x)` bằng nội suy tại nghiệm; Mini Olympic nội suy. Hạn chế giải hệ Vandermonde cơ học.

### Đa thức bất khả quy

6 bài: bổ đề Gauss và khóa bậc nhân tử; Eisenstein và dịch biến; giảm modulo `p`; cyclotomic nguyên tố và đa thức nghịch đảo; kỹ thuật thế nhiều điểm cho dạng tích cộng hằng số; Mini Olympic chọn tiêu chuẩn. Ưu tiên tiêu chuẩn vừa đủ, phù hợp cấu trúc.

### Phương trình hàm đa thức

6 bài: khóa bậc và hệ số đầu; sai phân–tịnh tiến; lan truyền nghiệm và chia hết; hợp thành và điểm bất động; liên hợp affine; Mini Olympic tổng hợp. Quy trình chuẩn là xử lý nghiệm hằng → bậc → hệ số đầu → điểm đặc biệt → cuối cùng mới đồng nhất hệ số.

### Chebyshev & cực trị đa thức

6 bài: truy hồi và công thức `T_n(cos θ)=cos(nθ)`; nghiệm–cực trị xen kẽ; minimax cho đa thức monic; chuẩn hóa đoạn `[a,b]`; bất đẳng thức Markov cho đạo hàm; Mini Olympic xen dấu và cực trị. Trọng tâm là tư duy “xen dấu tối ưu”, không chỉ học thuộc Chebyshev.

## Kiểm tra dữ liệu sau nâng cấp Đa thức

- Cả **5 chủ đề vừa nâng** đều có đúng **6 bài học**.
- Mỗi chủ đề có đúng **6 đề luyện**.
- Cả **30 đề luyện** đều có đúng **4 câu**.
- `order_index` bài học và đề luyện trong từng chủ đề không trùng.
- Không sửa frontend; chỉ cập nhật dữ liệu Olympic trong Supabase và file tiến độ này.

## Thứ tự tiếp tục

Phần **Đại số tuyến tính đã hoàn thành 14/14** và **Đa thức đã hoàn thành 6/6**.

Tiếp theo chuyển sang **Tổ hợp – Rời rạc**:

1. Nguyên lý đếm; hoán vị – chỉnh hợp – tổ hợp
2. Nhị thức Newton & đồng nhất thức tổ hợp
3. Nguyên lý Dirichlet
4. Đếm hai cách & nguyên lý bù trừ
5. Hệ thức truy hồi
6. Bất biến & nguyên lý cực hạn
7. Đồ thị cơ bản

## Nguyên tắc làm việc

- Làm **từng chủ đề một**, không nâng hàng loạt máy móc nếu chưa kiểm tra chủ đề trước.
- Trước khi chỉnh, đọc lại nội dung hiện có và tài liệu lộ trình/đề thi liên quan.
- Ưu tiên các dạng bài có giá trị luyện thi: cấu trúc, bất biến, cực trị, chứng minh, phối hợp nhiều công cụ.
- Nếu một nội dung không nằm trong trọng tâm đề gần đây, hạ xuống mức ứng dụng/phần mở rộng thay vì cho chiếm tỷ trọng lớn.
- Sau mỗi chủ đề, kiểm tra lại số bài học, số đề luyện và số câu cấu trúc trước khi chuyển sang chủ đề kế tiếp.
- Chỉ sửa dữ liệu Supabase khi thay nội dung; không sửa frontend nếu không cần thiết.

## Trạng thái tiếp theo

**Chủ đề kế tiếp: Nguyên lý đếm; hoán vị – chỉnh hợp – tổ hợp.**

Mục tiêu: không dừng ở công thức `n!`, `A_n^k`, `C_n^k`; ưu tiên mô hình hóa phép đếm, song ánh, đếm theo vị trí/khoảng trống, hoán vị có ràng buộc, phân phối vật, đếm quỹ đạo nhỏ và các bài có nhiều cách đếm để chuẩn bị cho nguyên lý bù trừ và đếm hai cách.