# AI-CLO Aptis Lab — V2

Ngày cập nhật: 23/09/2026

Branch triển khai: `aptis-v2-20260923`

Supabase production: `rraooqedkpyhokattwdz`

## Mục tiêu V2

Tập trung vào trải nghiệm luyện thi và an toàn dữ liệu:

1. Mini Mock.
2. Full Mock Aptis General dạng luyện tập.
3. AI chấm Speaking theo yêu cầu người học.
4. AI chấm Writing theo yêu cầu người học.
5. Timer / giới hạn Listening / Speaking gần trải nghiệm thi thật.
6. Phân tích tiến độ theo Skill → Part → Topic.
7. Mock không trả đáp án/correctness về trình duyệt trong lúc làm.

## Mock V2

### Trạng thái hiện tại

- Mock dùng RPC riêng và lưu `aptis_attempts.mode='mock'`.
- Không dùng `aptis_draw_practice` / `aptis_submit_answer` / `aptis_get_attempt_resume` cho Mock.
- Direct SELECT của learner vào `aptis_attempts` / `aptis_attempt_items` không thấy hàng `mode='mock'`.
- Các RPC Practice cũ vẫn giữ hành vi cũ cho Practice nhưng từ chối attempt Mock.
- Mock resume không trả:
  - `is_correct`;
  - đáp án đúng;
  - explanation;
  - transcript Listening.
- Mock submit chấm server-side nhưng chỉ trả acknowledgement/completion state.
- Khi một block kết thúc hoặc hết giờ, frontend gọi finalize và chỉ nhận summary theo block.

### RPC production

Migration source:

`tools/aptis-lab/supabase/v2-secure-mock.sql`

Đã áp lên production ngày 23/09/2026.

Các RPC learner-facing:

- `aptis_draw_mock_block(...)`
- `aptis_get_mock_resume(uuid)`
- `aptis_submit_mock_answer(uuid, uuid, jsonb, integer)`
- `aptis_finalize_mock_attempt(uuid)`
- `aptis_progress_breakdown_v2(integer)`

Các RPC trên chỉ grant cho `authenticated`; `anon` không có EXECUTE.

Hai implementation Practice cũ được giữ dưới tên nội bộ và đã revoke khỏi learner:

- `aptis_get_attempt_resume_legacy(uuid)`
- `aptis_submit_answer_legacy(uuid, uuid, jsonb, integer)`

### B1 / B2

Bank production hiện có Speaking và Writing ở B2 nhưng chưa có B1. Vì vậy Mini Mock / Full Mock 6 kỹ năng hiện chỉ bật khi mục tiêu là B2. Với mục tiêu B1, giao diện báo rõ lý do thay vì cho bắt đầu rồi lỗi ở giữa bài.

## Frontend

### `js/v2-api.js`

Bổ sung API:

- `drawMockBlock()`
- `resumeMockAttempt()`
- `submitMockAnswer()`
- `finalizeMockAttempt()`
- `getSpeakingAssessment()`
- `getWritingAssessment()`
- `assessSpeaking()`
- `assessWriting()`
- `getProgressBreakdown()`

`submitAnswer()` của Practice vẫn được bọc custom event để gắn AI Writing vào runner cũ mà không sửa lớn `learning-path.js`.

### `js/v2.js`

- Mini Mock và Full Mock có timer theo component.
- Reload có thể tiếp tục block Mock hiện tại từ Supabase.
- Writing draft được giữ local trong phiên Mock trên cùng thiết bị.
- Không hiển thị AI feedback giữa Mock.
- Timeout finalize block hiện tại trước khi chuyển section.
- MediaRecorder / microphone / prep timer được cleanup khi:
  - đổi câu;
  - hết giờ;
  - đổi view;
  - `pagehide` / `beforeunload`.
- Speaking timing:
  - Part 1: 30 giây;
  - Part 2/3: 45 giây;
  - Part 4: 60 giây chuẩn bị + tối đa 120 giây ghi âm.
- Listening trong Mock giới hạn theo `set_id` / recording thay vì theo từng question, tối đa 2 lượt cho cùng recording.
- Reading/Listening được rút theo cụm set thay vì đảo hoàn toàn từng câu riêng lẻ.
- Progress 90 ngày theo Skill / Part / Topic loại Mock khỏi aggregate để không tạo side-channel suy ra đáp án trong lúc làm bài.

## AI Speaking / Writing

### Speaking

Production Edge Function:

`aptis-speaking-assess`

- ACTIVE version 3 ngày 23/09/2026.
- `verify_jwt=true`.
- Source được theo dõi tại `supabase/functions/aptis-speaking-assess/index.ts`.
- Nếu attempt là Mock và block chưa `completed_at`, function trả `MOCK_ASSESSMENT_AVAILABLE_AFTER_BLOCK` và không gọi Gemini.

### Writing

Production Edge Function:

`aptis-writing-assess`

- ACTIVE version 2 ngày 23/09/2026.
- `verify_jwt=true`.
- Source: `supabase/functions/aptis-writing-assess/index.ts`.
- Cùng cơ chế khóa AI khi Mock block còn mở.

Cả hai function:

- xác minh JWT và ownership server-side;
- dùng private recording server-side cho Speaking;
- dùng quota AI hằng ngày;
- lưu cache vào `aptis_ai_assessments` theo schema production hiện có (`attempt_item_id + feature`);
- không đưa Gemini API key ra frontend;
- rubric chỉ là feedback luyện tập, không phải điểm Aptis chính thức.

## Practice Writing AI

Ngoài việc chèn nút AI ngay sau submit, V2 còn khôi phục nút/kết quả AI Writing khi người học reload một câu Writing đã lưu. Speaking tiếp tục dùng flow assessment hiện có của `learning-path.js`.

## Tiến độ / Analytics

`aptis_progress_breakdown_v2(p_days)` trả dữ liệu objective practice của chính `auth.uid()` theo:

- Skill;
- Part;
- Topic;
- số câu đã làm;
- số đúng;
- accuracy.

Mock bị loại khỏi RPC này.

## Kiểm tra bảo mật đã thực hiện

Sau migration đã xác nhận bằng metadata production:

- Mock RPC: `authenticated=true`, `anon=false`.
- Practice wrapper: `authenticated=true`, `anon=false`.
- Legacy implementation: `authenticated=false`, `anon=false`.
- RLS Mock direct-read đã khóa ở `aptis_attempts` và `aptis_attempt_items`.
- Security Advisor đã chạy sau thay đổi. Không xuất hiện lỗi missing-RLS mới do Aptis V2; còn một số warning cấp project đã tồn tại ở các module khác / do RPC SECURITY DEFINER có chủ đích.

SQL connector không cho `SET ROLE authenticated`, nên chưa thể giả lập hoàn toàn một browser learner bằng SQL runner. Trước merge `main` vẫn cần test bằng một tài khoản learner thật trên branch/deployment test.

## Hạn chế còn lại trước khi gọi là Full Mock sát đề thật

- Reading / Listening hiện đã gom theo set nhưng chưa cưỡng chế ma trận chính xác từng Part/task theo specification chính thức.
- Chưa có server-side `aptis_mock_session`; orchestration toàn bài (section index, deadline, listening play counter, draft) vẫn nằm localStorage, còn từng block/response đã ở Supabase.
- Chưa có Flag / quay lại câu trước.
- B1 chưa đủ bank Speaking/Writing nên Mock 6 kỹ năng đang tắt cho B1.
- Chưa hoàn tất browser E2E learner test trên branch.

## Gate trước merge

1. Test B2 Mini Mock bằng learner thật:
   Core → Reading → Listening → Speaking → Writing.
2. Kiểm tra DevTools/Network không có answer/correctness trong Mock submit/resume payload.
3. Reload giữa Reading, Writing và Speaking để kiểm tra resume/cleanup.
4. Test Listening cùng set chỉ phát tối đa 2 lượt.
5. Test timeout trong Core và Speaking.
6. Test Practice cũ vẫn hiện đáp án/feedback bình thường sau khi hoàn thành câu.
7. Test AI Speaking/Writing trong Practice; kiểm tra cache + quota.
8. Sau khi ổn mới merge `aptis-v2-20260923` vào `main`.
