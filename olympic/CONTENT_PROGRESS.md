# Tiến độ nâng cấp nội dung Olympic

_Cập nhật: 20/09/2026_

## Mục tiêu chung

Nội dung Olympic được xây theo hướng **thi thực tế**, không dừng ở mức ôn tập học phần. Mỗi chủ đề tăng dần từ nền tảng chọn lọc đến kỹ thuật Olympic, phối hợp nhiều ý, bài thi thực chiến và thử thách.

Chuẩn đang áp dụng:

- Mỗi chủ đề ưu tiên khoảng **6 bài học** theo lộ trình tăng dần.
- Mỗi bài học có mục tiêu, kỹ thuật Olympic, ví dụ/chiến lược và sai lầm thường gặp.
- Mỗi bài có **đề luyện 4 câu** theo tầng: Củng cố → Biến thể → Olympic → Thử thách.
- Không tạo nội dung quá cơ bản hoặc lặp lại giáo trình đại trà.
- Tăng liên kết giữa các ngôn ngữ: **ma trận ↔ ánh xạ tuyến tính ↔ kernel/image ↔ dimension ↔ trực giao ↔ cấu trúc phổ ↔ truy hồi ↔ đa thức ↔ tổ hợp**.
- Đề luyện trong `olympic_tests` hiện chỉ lưu nội dung đề, không nhúng lời giải. Trường `answer_tex` thuộc ngân hàng bài toán (`olympic_problems`) và phần lời giải sẽ tiếp tục được tách/siết quyền khi triển khai.

## Định hướng bám đề gần đây

- Ưu tiên đề cương Olympic Toán sinh viên toàn quốc 2026 và các đề/đề đề nghị 2024–2026; đồng thời tham khảo kỷ yếu các kỳ thi gần đây của Hội Toán học Việt Nam.
- Đại số tuyến tính tập trung vào hạng, định thức, nghịch đảo, ánh xạ tuyến tính, trị riêng, chéo hóa, ma trận đặc biệt, Cayley–Hamilton, vết và giao hoán.
- Đa thức ưu tiên cấu trúc nghiệm, đối xứng, nội suy, bất khả quy, hợp thành và cực trị.
- Tổ hợp 2026 nêu trực tiếp chỉnh hợp–tổ hợp, Pascal–nhị thức, quy tắc đếm, bao hàm–loại trừ, phân hoạch số tự nhiên, quy nạp, Dirichlet, cực hạn; bảng A có thêm chuỗi lũy thừa hình thức và hàm sinh. Phần Tổ hợp hiện đã bám các mạch này.
- Đồ thị giữ như phần mở rộng rời rạc hỗ trợ tư duy cấu trúc, không để lấn các nội dung cốt lõi của đề cương 2026.

## Tiến độ hiện tại

Tổng số mục nội dung của môn Đại số: **27**.

Đã nâng theo chuẩn Olympic: **27/27 — hoàn thành**.

### Đại số tuyến tính — hoàn thành 14/14

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

### Đa thức — hoàn thành 6/6

1. ✅ Nghiệm & đạo hàm đa thức
2. ✅ Viète & tổng Newton
3. ✅ Nội suy Lagrange
4. ✅ Đa thức bất khả quy
5. ✅ Phương trình hàm đa thức
6. ✅ Chebyshev & cực trị đa thức

### Tổ hợp – Rời rạc — hoàn thành 7/7

1. ✅ Nguyên lý đếm; hoán vị – chỉnh hợp – tổ hợp
2. ✅ Nhị thức Newton & đồng nhất thức tổ hợp
3. ✅ Nguyên lý Dirichlet
4. ✅ Đếm hai cách & nguyên lý bù trừ
5. ✅ Hệ thức truy hồi
6. ✅ Bất biến & nguyên lý cực hạn
7. ✅ Đồ thị cơ bản

## Tổ hợp – Rời rạc vừa hoàn thành

### Nguyên lý đếm; hoán vị – chỉnh hợp – tổ hợp

6 bài: mô hình hóa trước khi đếm; hoán vị có lặp và điều kiện vị trí; chọn–sắp và cấu hình nhiều trạng thái; phân phối/stars-and-bars và phân biệt composition–partition; chuỗi nhị phân với vị trí cấm; song ánh và mã hóa cấu hình.

### Nhị thức Newton & đồng nhất thức tổ hợp

6 bài: Pascal và nhị thức Newton; trích hệ số; tổng có trọng số bằng đạo hàm; tổng luân phiên và lọc chỉ số; Vandermonde và đếm hai cách; nhập môn hàm sinh hình thức. Phần hàm sinh được giữ ở mức phù hợp cho bảng A.

### Nguyên lý Dirichlet

6 bài: ngưỡng bắt buộc; lớp đồng dư; Dirichlet hình học; tổng từng phần; dãy đơn điệu kiểu Erdős–Szekeres; Dirichlet kết hợp cực hạn. Trọng tâm là **thiết kế hộp**, không chỉ áp công thức máy móc.

### Đếm hai cách & nguyên lý bù trừ

6 bài: incidence; đồng nhất thức bằng đếm hai cách; bao hàm–loại trừ; derangement và ánh xạ toàn ánh; đúng `r` điều kiện và tư duy đảo; Mini Olympic chọn chiến lược giữa song ánh, incidence và PIE.

### Hệ thức truy hồi

6 bài: lập truy hồi bằng bước cuối; phương trình đặc trưng; truy hồi không thuần nhất; Fibonacci/Catalan; giải truy hồi bằng hàm sinh hình thức; trạng thái hữu hạn và ma trận chuyển.

### Bất biến & nguyên lý cực hạn

6 bài: parity và tô màu; bất biến modulo/trọng số; đơn biến; nguyên lý cực hạn; phản ví dụ tối tiểu; Mini Olympic thao tác–bất biến–cực hạn.

### Đồ thị cơ bản

6 bài: bậc và định lý bắt tay; đường đi–chu trình–liên thông; cây; đồ thị hai phía; đường đi Euler; matching/Hall và mô hình phân công. Đây là phần mở rộng rời rạc, không phải trọng tâm chính của đề cương 2026.

## Kiểm tra dữ liệu sau nâng cấp Tổ hợp – Rời rạc

- Cả **7 chủ đề** đều có đúng **6 bài học**.
- Mỗi chủ đề có đúng **6 đề luyện**.
- Cả **42 đề luyện** đều có đúng **4 câu**.
- `order_index` bài học và đề luyện trong từng chủ đề không trùng.
- Tổng phần Tổ hợp – Rời rạc hiện có **42 bài học + 42 đề luyện = 168 câu luyện cấu trúc**.
- Không sửa frontend; chỉ cập nhật dữ liệu Olympic trong Supabase và file tiến độ này.

## Tổng kết môn Đại số Olympic

- **Đại số tuyến tính: 14/14**.
- **Đa thức: 6/6**.
- **Tổ hợp – Rời rạc: 7/7**.
- **Tổng: 27/27 chủ đề đã nâng theo chuẩn Olympic**.

Nội dung hiện ưu tiên nhận cấu trúc, chứng minh, bất biến, tham số, cực trị và phối hợp nhiều công cụ thay vì thao tác cơ học. Các phần nâng cao chỉ được giữ khi có giá trị giải bài rõ ràng.

## Nguyên tắc làm việc tiếp theo

- Không mở rộng thêm chủ đề chỉ để tăng số lượng.
- Bước tiếp theo nên là **audit chất lượng toàn bộ 27 chủ đề**, phát hiện bài trùng ý, bài quá dễ/quá xa đề cương và cân lại độ khó.
- Sau audit có thể xây **đề tổng hợp Olympic Đại số** theo ma trận chủ đề và mức độ, thay vì tiếp tục thêm bài rời rạc.
- Chỉ sửa dữ liệu Supabase khi thay nội dung; không sửa frontend nếu không cần thiết.

## Trạng thái tiếp theo

**Môn Đại số: HOÀN THÀNH 27/27 chủ đề.**

Đề xuất bước kế tiếp: audit toàn bộ nội dung và xây bộ đề tổng hợp theo cấu trúc thi thực tế.