# AI-CLO Assessment Load Test

Mục tiêu: kiểm tra tải bài kiểm tra trực tuyến theo các mốc 50 → 100 → 150 → 200 → 250 sinh viên đồng thời sau tối ưu V12.6.55.

## An toàn

- Chỉ chạy trên **Supabase staging/test**, không chạy trên production `rraooqedkpyhokattwdz`.
- Script tự chặn URL production.
- Chỉ dùng tài khoản sinh viên thử nghiệm. Không commit mật khẩu, token hoặc service-role key vào GitHub.
- Bài kiểm tra staging phải có đủ pool câu hỏi và `max_attempts` đủ lớn nếu chạy nhiều mức tải liên tiếp.

## File tài khoản thử nghiệm

Tạo file cục bộ `test-users.json` và không commit:

```json
[
  {"email":"load001@example.test","password":"..."},
  {"email":"load002@example.test","password":"..."}
]
```

Cần ít nhất số tài khoản bằng mức tải lớn nhất.

## Chạy

Node.js 18+:

```bash
SUPABASE_URL="https://<staging-ref>.supabase.co" \
SUPABASE_ANON_KEY="<publishable-or-anon-key>" \
EXAM_ID="<staging-exam-uuid>" \
USERS_FILE="./test-users.json" \
LOAD_LEVELS="50,100,150,200,250" \
CONFIRM_NON_PRODUCTION="I_UNDERSTAND_THIS_IS_STAGING" \
node tools/assessment-load-test/load-test.mjs
```

Muốn chỉ đo Bắt đầu + tải đề, không nộp bài:

```bash
SUBMIT=false ... node tools/assessment-load-test/load-test.mjs
```

## Chỉ số cần xem

Script báo số request thành công, p50, p95 và max cho:

- `AUTH`: đăng nhập;
- `START`: `start_exam_attempt`;
- `PAYLOAD`: `get_exam_attempt_payload`;
- `SUBMIT`: `submit_exam_attempt`.

Ngưỡng vận hành nên đặt thấp hơn mức stress-test ổn định. Mục tiêu thực tế của production Free là khoảng 200 sinh viên/ca; nên stress-test đến 250 để có biên an toàn.

## Tiêu chí gợi ý

Không coi là “đạt” chỉ vì 100% request trả về. Cần xem đồng thời:

- không có lỗi 5xx / timeout / pool không đủ;
- p95 START và SUBMIT không tăng đột biến khi từ 150 lên 200;
- không sinh duplicate open attempt;
- không mất đáp án;
- sau nộp, `attempt_draft_answers` của lượt đã nộp phải được xóa;
- database CPU/RAM/connection không duy trì sát trần trong nhiều phút.

## Lưu ý dữ liệu

Mỗi mức tải tạo lượt làm thật trong staging. Nếu chạy đủ 5 mức với cùng tài khoản, bài staging cần cho phép ít nhất 5 lượt hoặc cần reset dữ liệu giữa các lần thử.
