# AI-CLO OLYMPIC — Kỹ thuật & quy tắc phát triển

> Áp dụng cho toàn bộ thư mục `/olympic/`. Mục tiêu chính: mở rộng lâu dài mà không làm chậm, chớp trang hoặc ảnh hưởng hệ AI-CLO chính.

## 1. Kiến trúc bắt buộc

Olympic dùng **persistent app shell + client-side router**:

- Header, sidebar, footer, trạng thái đăng nhập và Supabase client chỉ khởi tạo **một lần**.
- Chuyển giữa các URL trong `/olympic/` dùng `history.pushState()` và chỉ render lại vùng `#olyContent`.
- Không reload toàn trang khi đổi giữa Đại số, Giải tích, Bài học, Nội dung, Luyện tập, khu vực Giảng viên/Admin.
- Mỗi URL vẫn có `index.html` vật lý để F5, mở bookmark hoặc truy cập trực tiếp trên GitHub Pages vẫn hoạt động.
- Tất cả `index.html` trong Olympic dùng chung một scaffold tối giản; **không copy logic nghiệp vụ vào HTML**.

File lõi hiện tại:

- `/olympic/assets/js/olympic-core.js` — app shell, router, auth, data layer và renderer V2.
- `/olympic/assets/css/olympic.css` — giao diện dùng chung.
- `/js/config.js` — cấu hình Supabase dùng chung với AI-CLO.

## 2. Quy tắc điều hướng

### Phải làm

- Link nội bộ Olympic dùng URL thật, ví dụ `/olympic/algebra/lessons/`.
- Router sẽ tự intercept link cùng origin thuộc `/olympic/`.
- Khi cần điều hướng từ JavaScript, dùng:

```js
window.OlympicApp.navigate('/olympic/algebra/lessons/');
```

- Khi dữ liệu vừa thay đổi và chỉ cần render lại trang hiện tại, dùng:

```js
window.OlympicApp.refresh();
```

### Không làm

Không dùng các cách sau cho điều hướng nội bộ Olympic:

```js
location.href = '/olympic/...';
location.reload();
window.location = '/olympic/...';
```

Ngoại lệ: đi ra ngoài module Olympic (`/app.html`, website ngoài) hoặc khi cố ý hard-navigation bằng `data-hard-nav`.

## 3. Quy tắc Supabase

- Trong một document chỉ có **một Supabase client**. Dùng client do `olympic-core.js` tạo; không tạo client mới ở từng feature/page.
- Không đưa `service_role` hoặc secret key vào frontend.
- Mọi bảng Olympic tiếp tục dùng prefix `olympic_` và RLS.
- Schema thay đổi phải thực hiện bằng migration có thể kiểm tra/rollback, không sửa tùy tiện từ frontend.
- Query relation có nhiều foreign key phải **chỉ rõ constraint**.

Ví dụ quan hệ `olympic_lessons -> olympic_topics` hiện có nhiều đường FK, vì vậy dùng:

```js
.select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(title)')
```

Không dùng:

```js
.select('*,olympic_topics(title)')
```

vì PostgREST không biết chọn relationship nào.

## 4. Quy tắc dữ liệu và cache

- Session/profile/subjects được nạp một lần khi khởi tạo app, không tải lại sau mỗi click menu.
- Dữ liệu đọc nhiều như cây nội dung và danh sách bài học được cache ngắn hạn ở client.
- Sau insert/update/delete phải invalidate đúng cache bằng:

```js
window.OlympicApp.invalidate('algebra');
```

hoặc môn tương ứng, rồi render lại.
- Không giữ cache dài hạn cho dữ liệu có thể được giảng viên chỉnh thường xuyên.

## 5. Quy tắc render/loading

- Tuyệt đối không ẩn trắng toàn bộ `body` trong lúc auth/query.
- App shell phải luôn giữ nguyên khi chuyển trang.
- Khi query trang mới, nội dung cũ có thể giữ lại đến khi dữ liệu mới sẵn sàng; không xóa trắng `#olyContent` trước query.
- Lỗi của một query chỉ hiện trong vùng nội dung/toast, không làm mất toàn bộ shell.
- MathJax chỉ load một lần và tái sử dụng.

## 6. Thêm trang mới

Khi thêm một feature mới, ví dụ `/olympic/algebra/solutions/`:

1. Tạo thư mục + `index.html` bằng scaffold chuẩn Olympic.
2. Thêm route vào `routeFromPath()`/danh sách feature hợp lệ.
3. Viết một renderer riêng, không nhồi logic vào `shell()`.
4. Nếu có query, đặt ở data layer/helper dùng chung.
5. Nếu có cache, định nghĩa cách invalidate ngay từ đầu.
6. Kiểm tra direct URL, F5, Back/Forward và chuyển trang mềm.

Nếu feature lớn, tách thành `/olympic/assets/js/features/<feature>.js`; không để `olympic-core.js` tăng vô hạn.

## 7. Biên tập bài học

- Khi editor có thay đổi chưa lưu, router phải cảnh báo trước khi rời trang.
- Save thành công không reload document; chỉ cập nhật dữ liệu, invalidate cache và điều hướng mềm.
- Bài học chi tiết luôn kiểm tra `lesson.subject_id` đúng môn đang mở.
- Sinh viên chỉ được mở bài học có `status = published` và `is_visible = true`; giảng viên/Admin có thể mở bản nháp trong khu vực quản lý.
- Không dùng một script guard tạo Supabase client thứ hai; subject guard phải nằm trong query/data layer chính.

## 8. HTML/CSS/JS cache busting

Khi thay file lõi được deploy, tăng version query trong scaffold, ví dụ:

```html
<script defer src="/olympic/assets/js/olympic-core.js?v=2.1.0"></script>
```

Nếu đổi CSS, tăng version CSS cùng đợt. Sau đó cập nhật **tất cả** scaffold Olympic đồng bộ.

## 9. An toàn dữ liệu

- Không đổi/xóa schema chỉ để chữa lỗi UI nếu có thể chỉ rõ FK hoặc sửa query.
- Trước refactor lớn phải tạo backup branch hoặc tag.
- Không chỉnh các bảng AI-CLO không có prefix `olympic_` nếu nhiệm vụ chỉ thuộc Olympic.
- Mọi delete cần xác nhận và tuân thủ FK/RLS.

## 10. Checklist trước khi merge/deploy

Kiểm tra tối thiểu:

- `/olympic/` mở trực tiếp được.
- `/olympic/algebra/` và `/olympic/calculus/` mở trực tiếp/F5 được.
- Chuyển menu 10 lần liên tục không có hard reload/chớp trắng.
- Back/Forward của browser hoạt động.
- Login/logout không reload toàn document.
- Danh sách bài học không còn lỗi “more than one relationship”.
- Mở bài học bằng `?id=...` đúng môn; ID của môn khác bị chặn.
- Giảng viên đổi môn, thêm/sửa nội dung, lưu bài học mà không cần `location.reload()`.
- Mobile menu đóng sau khi chọn route.
- Console không có lỗi JavaScript/PostgREST mới.

## 11. API nội bộ cho feature tương lai

`window.OlympicApp` cung cấp:

```js
OlympicApp.navigate(url)
OlympicApp.refresh()
OlympicApp.invalidate(subjectCode)
OlympicApp.state
OlympicApp.route
OlympicApp.supabase
```

Feature mới nên dùng các API này thay vì tự dựng router/auth/Supabase riêng.
