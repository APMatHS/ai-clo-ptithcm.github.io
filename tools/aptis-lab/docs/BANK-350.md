# AI-CLO Aptis Lab — Bank milestone 350

Ngày cập nhật: 18/09/2026

## Trạng thái production Supabase

- 350 câu `published`, `is_active = true`.
- 24 câu Listening ở trạng thái `draft`.
- 6 Listening sets ở trạng thái `draft`, đã có transcript + 4 câu/set, chưa có audio.
- Lộ trình hiện có 36 lesson; 35 lesson mở được. `APT-L1003 Listening strategy lab` vẫn `is_available = false` cho tới khi có audio thật.

### Phân bố published

- Grammar B1: 60
- Grammar B2: 47
- Vocabulary B1: 69
- Vocabulary B2: 58
- Reading B1: 28
- Reading B2: 28
- Speaking B2: 30
- Writing B2: 30

Tổng: 350.

### Listening draft

- B1: 3 sets / 12 câu
- B2: 3 sets / 12 câu
- Các set có transcript nhưng `media = {}` và chưa được learner rút.

## Migration production đã chạy

Các seed mới trong đợt mở rộng này đã chạy trực tiếp trên production với các migration:

- `aptis_bank_expand_grammar_vocab_v2_20260918`
- `aptis_bank_expand_speaking_writing_v2_20260918`
- `aptis_bank_expand_reading_v2_20260918`
- `aptis_bank_listening_draft_v1_20260918`
- `aptis_bank_reach_350_v1_20260918`

Không chạy lại các migration này trên production.

## Quy tắc nội dung

- Nội dung được viết nguyên bản theo dạng luyện Aptis General/B1-B2; không sao chép đề chính thức.
- Grammar/Vocabulary có đáp án + giải thích.
- Reading dùng `aptis_sets` làm passage cha và 4 câu con mỗi set.
- Speaking/Writing là prompt tự do, được lưu attempt như các luyện tập cá nhân khác.
- Listening chỉ chuyển `published` sau khi gắn audio thật vào `aptis_sets.media` và kiểm thử phát audio/signed URL.
- Giữ cơ chế chống trùng theo prompt; không tắt kiểm tra trùng để đạt số lượng.

## Bước tiếp theo

1. Tạo hoặc thu audio nguyên bản cho 6 Listening draft.
2. Upload vào private bucket `aptis-content` và gắn media cho từng set.
3. Kiểm thử nghe trên mobile/desktop.
4. Chuyển set + questions sang `published` và mở lesson `APT-L1003`.
5. Sau đó tăng bank lên 450–500 với ưu tiên Reading/Listening và đa dạng Speaking/Writing.
