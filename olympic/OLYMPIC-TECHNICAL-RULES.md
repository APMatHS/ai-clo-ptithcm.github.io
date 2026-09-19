# AI-CLO OLYMPIC — Kỹ thuật & quy tắc phát triển

> Áp dụng cho toàn bộ `/olympic/`. Mục tiêu: mở rộng lâu dài mà không hard reload, không chớp trắng và không ảnh hưởng ứng dụng AI-CLO chính.

## 1. Kiến trúc bắt buộc

Olympic V2 dùng **persistent app shell + client-side router**.

- Sidebar, header, footer, Supabase client và trạng thái đăng nhập chỉ khởi tạo **một lần trong mỗi document**.
- Chuyển URL nội bộ `/olympic/...` bằng `history.pushState()`; chỉ render lại `#olyContent`.
- Không hard reload khi đổi Đại số/Giải tích/Nội dung/Bài học/Luyện tập/Giảng viên/Admin.
- Mỗi route vẫn có `index.html` vật lý để GitHub Pages hỗ trợ mở trực tiếp, bookmark và F5.
- Các `index.html` Olympic dùng cùng một scaffold tối giản; không chép nghiệp vụ vào HTML.

Runtime V2 nằm ở `/olympic/assets/js/v2/` và được nạp đúng thứ tự:

1. `base.js`
2. `shell.js`
3. `data.js`
4. `math.js`
5. `public-home.js`
6. `public-content.js`
7. `public-lessons.js`
8. `teacher-content.js`
9. `teacher-actions.js`
10. `teacher-lessons.js`
11. `editor.js`
12. `admin.js`
13. `render.js`
14. `router.js`
15. `boot.js`

`/olympic/assets/js/olympic-core.js` là mã V1/legacy và không được scaffold V2 nạp nữa.

## 2. Quy tắc điều hướng

### Phải dùng

Link nội bộ vẫn là URL thật, ví dụ:

```html
<a href="/olympic/algebra/lessons/">Bài học</a>
```

Router tự intercept link cùng origin thuộc `/olympic/`.

Từ JavaScript dùng:

```js
OlympicApp.navigate('/olympic/algebra/lessons/');
OlympicApp.refresh();
```

### Không dùng cho điều hướng nội bộ Olympic

```js
location.reload();
location.href = '/olympic/...';
window.location = '/olympic/...';
```

Hard navigation chỉ dùng khi đi ra khỏi Olympic hoặc link cố ý có `data-hard-nav`.

## 3. Quy tắc Supabase

- Một document chỉ có **một Supabase client**, được tạo ở `base.js` và dùng chung cho tất cả module.
- Không tạo Supabase client riêng cho từng trang/guard/feature.
- Không đưa `service_role` hay secret key vào frontend.
- Bảng riêng của Olympic dùng prefix `olympic_` và tiếp tục bảo vệ bằng RLS.
- Không đổi/xóa foreign key chỉ để chữa lỗi query giao diện nếu có thể chỉ rõ quan hệ.

### Quan hệ `olympic_lessons` → `olympic_topics`

Database hiện có hơn một relationship giữa hai bảng. Vì vậy mọi embed phải chỉ rõ constraint:

```js
.select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(title)')
```

Không dùng:

```js
.select('*,olympic_topics(title)')
```

vì PostgREST sẽ báo `more than one relationship was found`.

## 4. Session, dữ liệu và cache

- Session, profile và danh sách môn nạp một lần khi app khởi tạo.
- Không gọi lại auth/profile sau mỗi click menu.
- Cây nội dung và danh sách bài học được cache ngắn hạn ở client để quay lại trang nhanh hơn.
- Sau insert/update/delete phải invalidate đúng cache:

```js
OlympicApp.invalidate('algebra');
```

hoặc môn tương ứng rồi `OlympicApp.refresh()` nếu cần.
- Không dùng cache dài hạn cho dữ liệu giảng viên có thể sửa thường xuyên.

## 5. Render và loading

- Không ẩn trắng toàn bộ `body` trong lúc auth/query.
- App shell phải tồn tại khi chuyển route.
- Không xóa trắng `#olyContent` trước khi dữ liệu route mới sẵn sàng; giữ nội dung cũ cho đến lúc render mới.
- Lỗi query chỉ hiện ở vùng nội dung/toast, không làm biến mất shell.
- MathJax chỉ load một lần và tái sử dụng giữa các route.
- Prefetch nhẹ được phép khi hover/pointerover link nội bộ.

## 6. Bài học và trình soạn

- Bài học chi tiết phải kiểm tra `lesson.subject_id` khớp môn đang mở.
- Sinh viên chỉ mở bài có `status = published` và `is_visible = true`.
- Giảng viên/Admin được quản lý bản nháp trong khu vực giảng viên.
- Query bài học luôn dùng explicit FK nêu ở mục 3.
- Editor có trạng thái `dirty`; bấm link nội bộ khi chưa lưu phải cảnh báo.
- Save thành công không reload document; chỉ cập nhật dữ liệu, invalidate cache và điều hướng mềm.
- Không dùng lại `lesson-subject-guard.js` để tạo client thứ hai; guard đã nằm trong query/data layer chính.

## 7. Thêm route/feature mới

Ví dụ thêm `/olympic/algebra/solutions/`:

1. Tạo thư mục và `index.html` từ scaffold chuẩn V2.
2. Thêm route hợp lệ trong `base.js`.
3. Tạo module renderer riêng, không nhồi nghiệp vụ vào `shell.js`.
4. Query dùng data/helper chung; không tự tạo auth hoặc Supabase client mới.
5. Định nghĩa cache + cách invalidate nếu có dữ liệu đọc nhiều.
6. Thêm renderer vào `render.js`.
7. Kiểm tra direct URL, F5, Back/Forward và soft navigation.

Nếu feature lớn, có thể tách thêm file trong `/olympic/assets/js/v2/` hoặc thư mục `features/`; giữ mỗi module có trách nhiệm rõ ràng.

## 8. Cache busting

Khi deploy thay đổi runtime/CSS, tăng version query đồng bộ trong **tất cả scaffold**, ví dụ:

```html
<link rel="stylesheet" href="/olympic/assets/css/olympic.css?v=2.1.0">
<script defer src="/olympic/assets/js/v2/base.js?v=2.1.0"></script>
```

Không để các route dùng version khác nhau.

## 9. An toàn dữ liệu và refactor

- Trước refactor lớn phải tạo backup branch/tag.
- Không chỉnh các bảng AI-CLO không có prefix `olympic_` nếu nhiệm vụ chỉ thuộc Olympic.
- Mọi delete cần xác nhận và tuân thủ FK/RLS.
- Thay đổi schema phải đi qua migration có thể kiểm tra/rollback.
- Không sửa schema chỉ để tránh một lỗi embed mà frontend có thể giải quyết bằng explicit relation.

## 10. Checklist trước deploy

- `/olympic/`, `/olympic/algebra/`, `/olympic/calculus/` mở trực tiếp được.
- F5 ở `/olympic/algebra/lessons/` và các route con vẫn hoạt động.
- Chuyển menu liên tục không hard reload/chớp trắng.
- Browser Back/Forward hoạt động.
- Login/logout không cần reload toàn document.
- Danh sách/bài học không còn lỗi `more than one relationship`.
- `?id=...` của môn khác bị chặn đúng môn.
- Giảng viên đổi môn, thêm/sửa nội dung, lưu bài học không dùng `location.reload()`.
- Mobile menu đóng sau khi chọn route.
- Console không có lỗi JavaScript/PostgREST mới.
- Chạy kiểm tra cú pháp toàn bộ runtime V2 trước khi cập nhật `main`.

## 11. API nội bộ

`window.OlympicApp` cung cấp:

```js
OlympicApp.navigate(url)
OlympicApp.refresh()
OlympicApp.invalidate(subjectCode)
OlympicApp.state
OlympicApp.route
OlympicApp.supabase
```

Feature tương lai ưu tiên dùng API/runtime chung này thay vì tự dựng router/auth/Supabase riêng.
