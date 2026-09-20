-- AI-CLO PTITHCM — atomic update of a question and its four answer options.
-- Production RPC is already deployed on Supabase project rraooqedkpyhokattwdz.
-- This migration keeps the repository source aligned with production.

create or replace function public.update_question_with_options(
  p_question_id uuid,
  p_content text,
  p_explanation text,
  p_correct_answer text,
  p_chapter_id uuid,
  p_topic_id uuid,
  p_clo_id uuid,
  p_question_scope text,
  p_approval_status text,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_question public.questions%rowtype;
  v_actor uuid := auth.uid();
  v_revision_no integer;
  v_option_count integer;
  v_now timestamptz := now();
begin
  if v_actor is null then
    raise exception 'Bạn chưa đăng nhập';
  end if;

  select *
  into v_question
  from public.questions
  where id = p_question_id
  for update;

  if not found then
    raise exception 'Không tìm thấy câu hỏi';
  end if;

  if not public.is_admin() and v_question.created_by is distinct from v_actor then
    raise exception 'Chỉ người nhập hoặc Admin được sửa câu hỏi';
  end if;

  if v_question.is_official and not public.is_admin() then
    raise exception 'Câu hỏi Học viện đã xác nhận chỉ Admin được chỉnh sửa';
  end if;

  if nullif(btrim(coalesce(p_content, '')), '') is null then
    raise exception 'Nội dung câu hỏi không được để trống';
  end if;

  if p_correct_answer not in ('A','B','C','D') then
    raise exception 'Đáp án đúng phải là A, B, C hoặc D';
  end if;

  if p_question_scope not in ('practice','secure_exam','both') then
    raise exception 'Nơi lưu câu hỏi không hợp lệ';
  end if;

  if p_approval_status not in ('draft','pending','approved','archived') then
    raise exception 'Trạng thái duyệt không hợp lệ';
  end if;

  if p_chapter_id is null or p_topic_id is null or p_clo_id is null then
    raise exception 'Câu hỏi phải có Chương, Chủ đề và CLO';
  end if;

  if not exists (
    select 1 from public.topics t
    where t.id = p_topic_id and t.chapter_id = p_chapter_id
  ) then
    raise exception 'Chủ đề không thuộc Chương đã chọn';
  end if;

  if jsonb_typeof(p_options) is distinct from 'object'
     or not (p_options ? 'A' and p_options ? 'B' and p_options ? 'C' and p_options ? 'D') then
    raise exception 'Phải có đủ bốn phương án A, B, C, D';
  end if;

  if nullif(btrim(coalesce(p_options->>'A','')), '') is null
     or nullif(btrim(coalesce(p_options->>'B','')), '') is null
     or nullif(btrim(coalesce(p_options->>'C','')), '') is null
     or nullif(btrim(coalesce(p_options->>'D','')), '') is null then
    raise exception 'Các phương án A, B, C, D không được để trống';
  end if;

  v_revision_no := public.archive_question_revision(p_question_id);

  update public.questions
  set content = btrim(p_content),
      explanation = nullif(btrim(coalesce(p_explanation, '')), ''),
      correct_answer = p_correct_answer::char(1),
      chapter_id = p_chapter_id,
      topic_id = p_topic_id,
      clo_id = p_clo_id,
      question_scope = p_question_scope,
      approval_status = p_approval_status,
      status = case when p_approval_status = 'approved' then 'active' else status end,
      approved_by = case when p_approval_status = 'approved' then v_actor else null end,
      approved_at = case when p_approval_status = 'approved' then v_now else null end,
      updated_at = v_now
  where id = p_question_id;

  insert into public.question_options(question_id, option_key, content)
  values
    (p_question_id, 'A', btrim(p_options->>'A')),
    (p_question_id, 'B', btrim(p_options->>'B')),
    (p_question_id, 'C', btrim(p_options->>'C')),
    (p_question_id, 'D', btrim(p_options->>'D'))
  on conflict (question_id, option_key)
  do update set content = excluded.content,
                updated_at = v_now;

  select count(*) into v_option_count
  from public.question_options
  where question_id = p_question_id;

  if v_option_count <> 4 then
    raise exception 'Câu hỏi phải có đúng bốn phương án; hiện có %', v_option_count;
  end if;

  return jsonb_build_object(
    'question_id', p_question_id,
    'revision_no', v_revision_no,
    'option_count', v_option_count,
    'updated_at', v_now
  );
end;
$function$;

revoke all on function public.update_question_with_options(uuid,text,text,text,uuid,uuid,uuid,text,text,jsonb) from public;
revoke all on function public.update_question_with_options(uuid,text,text,text,uuid,uuid,uuid,text,text,jsonb) from anon;
grant execute on function public.update_question_with_options(uuid,text,text,text,uuid,uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.update_question_with_options(uuid,text,text,text,uuid,uuid,uuid,text,text,jsonb) to service_role;
