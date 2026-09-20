-- AI-CLO PTITHCM V12.6.55 — free-tier assessment load optimization.
-- Goals: reduce burst writes/queries for 100–250 concurrent students without changing exam semantics.
-- Safe to run again.

begin;

-- Prevent duplicate open attempts caused by double-click / concurrent start requests.
create unique index if not exists idx_exam_attempts_one_open_per_student
  on public.exam_attempts(exam_id, student_id)
  where submitted_at is null;

-- Cleanup scan for 30-day monitor retention.
create index if not exists idx_attempt_monitor_events_created
  on public.attempt_monitor_events(created_at);

create or replace function public.assessment_free_tier_optimization_version()
returns text
language sql
stable
security invoker
set search_path=public,pg_temp
as $$ select '12.6.55'::text $$;
revoke all on function public.assessment_free_tier_optimization_version() from public,anon;
grant execute on function public.assessment_free_tier_optimization_version() to authenticated;

create or replace function public.populate_attempt_questions(p_attempt_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_previous uuid;
  v_added integer;
  v_batch integer;
  v_order integer:=0;
  v_matrix jsonb;
  v_fixed jsonb;
  v_fixed_count integer;
  v_kind text;
  v_scope_id uuid;
  v_clo_id uuid;
  v_need integer;
  cell record;
begin
  -- Serialize only population of the same attempt. Different students still run concurrently.
  perform pg_advisory_xact_lock(hashtextextended(p_attempt_id::text, 0));

  select * into v_attempt from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;

  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id
     and not public.is_admin()
     and not public.is_subject_teacher(v_exam.subject_id) then
    raise exception 'Không có quyền tạo bộ câu cho lượt làm này';
  end if;

  if exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
    return (select count(*) from public.attempt_questions where attempt_id=p_attempt_id);
  end if;

  -- Common fixed: already optimal — one INSERT ... SELECT for the whole attempt.
  if coalesce(v_exam.question_mode,'common_fixed')='common_fixed' then
    insert into public.attempt_questions(
      attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
      content,correct_answer,explanation,options
    )
    select p_attempt_id,p.question_id,eq.question_order,p.chapter_id,p.chapter_name,p.topic_id,p.topic_name,p.clo_id,p.clo_code,
           p.content,p.correct_answer,p.explanation,p.options
    from public.exam_questions eq
    join public.exam_question_pool p
      on p.exam_id=eq.exam_id and p.question_id=eq.question_id
    where eq.exam_id=v_exam.id
    order by eq.question_order;

  -- Student-fixed: later attempts reuse the first materialized set in one bulk insert.
  elsif v_exam.question_mode='student_fixed' then
    select ea.id into v_previous
    from public.exam_attempts ea
    where ea.exam_id=v_exam.id
      and ea.student_id=v_attempt.student_id
      and ea.id<>p_attempt_id
      and exists(select 1 from public.attempt_questions aq where aq.attempt_id=ea.id)
    order by ea.attempt_number asc
    limit 1;

    if v_previous is not null then
      insert into public.attempt_questions(
        attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
        content,correct_answer,explanation,options
      )
      select p_attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
             content,correct_answer,explanation,options
      from public.attempt_questions
      where attempt_id=v_previous
      order by question_order;
    end if;
  end if;

  if not exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
    v_matrix:=coalesce(v_exam.question_blueprint->'matrix','{}'::jsonb);

    if v_matrix='{}'::jsonb then
      v_matrix:=coalesce((
        select jsonb_object_agg('t:'||x.topic_id::text||':'||x.clo_id::text,x.need)
        from (
          select p.topic_id,p.clo_id,count(*)::integer as need
          from public.exam_questions eq
          join public.exam_question_pool p
            on p.exam_id=eq.exam_id and p.question_id=eq.question_id
          where eq.exam_id=v_exam.id
            and p.topic_id is not null
            and p.clo_id is not null
          group by p.topic_id,p.clo_id
        ) x
      ),'{}'::jsonb);
    end if;

    -- Mixed mode fixed questions: one bulk insert instead of one INSERT per question.
    if v_exam.question_mode='mixed_fixed_random' then
      v_fixed:=coalesce(v_exam.question_blueprint->'fixed_question_ids','[]'::jsonb);
      if jsonb_typeof(v_fixed)<>'array' then
        raise exception 'Danh sách câu cố định không hợp lệ';
      end if;
      if jsonb_array_length(v_fixed)<1 then
        raise exception 'Chế độ Cố định và rút ngẫu nhiên cần ít nhất một câu cố định';
      end if;

      if exists(
        select 1
        from jsonb_array_elements_text(v_fixed) f(value)
        group by value
        having count(*)>1
      ) then
        raise exception 'Danh sách câu cố định có câu trùng';
      end if;

      if exists(
        select 1
        from jsonb_array_elements_text(v_fixed) f(value)
        where not exists(
          select 1 from public.exam_question_pool p
          where p.exam_id=v_exam.id and p.question_id=f.value::uuid
        )
      ) then
        raise exception 'Có câu cố định không nằm trong pool đóng băng';
      end if;

      insert into public.attempt_questions(
        attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
        content,correct_answer,explanation,options
      )
      select p_attempt_id,p.question_id,f.ord::integer,p.chapter_id,p.chapter_name,p.topic_id,p.topic_name,p.clo_id,p.clo_code,
             p.content,p.correct_answer,p.explanation,p.options
      from jsonb_array_elements_text(v_fixed) with ordinality as f(value,ord)
      join public.exam_question_pool p
        on p.question_id=f.value::uuid and p.exam_id=v_exam.id
      order by f.ord;

      get diagnostics v_batch = row_count;
      v_order:=v_order+v_batch;
    end if;

    for cell in select key,value from jsonb_each_text(v_matrix)
    loop
      v_kind:=split_part(cell.key,':',1);
      begin
        v_scope_id:=split_part(cell.key,':',2)::uuid;
        v_clo_id:=split_part(cell.key,':',3)::uuid;
        v_need:=greatest(0,cell.value::integer);
      exception when others then
        raise exception 'Blueprint bài kiểm tra không hợp lệ tại ô %',cell.key;
      end;

      if v_need=0 then continue; end if;
      if v_exam.structure_mode='topic_clo' and v_kind<>'t' then
        raise exception 'Blueprint không khớp chế độ Mục x CLO';
      end if;
      if v_exam.structure_mode='chapter_pool' and v_kind<>'c' then
        raise exception 'Blueprint không khớp chế độ Chương x CLO';
      end if;

      select count(*)::integer into v_fixed_count
      from public.attempt_questions aq
      where aq.attempt_id=p_attempt_id
        and aq.clo_id=v_clo_id
        and (
          (v_kind='t' and aq.topic_id=v_scope_id)
          or
          (v_kind='c' and aq.chapter_id=v_scope_id and aq.topic_id=any(v_exam.topic_ids))
        );

      if v_fixed_count>v_need then
        raise exception 'Số câu cố định vượt chỉ tiêu tại ô %',cell.key;
      end if;

      v_need:=v_need-v_fixed_count;
      if v_need=0 then continue; end if;
      v_added:=0;

      -- First pass: prefer questions not previously seen by this student.
      with candidates as (
        select p.*, random() as rnd
        from public.exam_question_pool p
        where p.exam_id=v_exam.id
          and p.clo_id=v_clo_id
          and (
            (v_kind='t' and p.topic_id=v_scope_id)
            or
            (v_kind='c' and p.chapter_id=v_scope_id and p.topic_id=any(v_exam.topic_ids))
          )
          and not exists(
            select 1 from public.attempt_questions aq
            where aq.attempt_id=p_attempt_id and aq.question_id=p.question_id
          )
          and (
            v_exam.question_mode not in ('attempt_random','mixed_fixed_random')
            or not exists(
              select 1
              from public.exam_attempts ea2
              join public.attempt_questions aq2 on aq2.attempt_id=ea2.id
              where ea2.exam_id=v_exam.id
                and ea2.student_id=v_attempt.student_id
                and aq2.question_id=p.question_id
            )
          )
        order by rnd
        limit v_need
      ), numbered as (
        select c.*,row_number() over(order by c.rnd)::integer as rn
        from candidates c
      )
      insert into public.attempt_questions(
        attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
        content,correct_answer,explanation,options
      )
      select p_attempt_id,n.question_id,v_order+n.rn,n.chapter_id,n.chapter_name,n.topic_id,n.topic_name,n.clo_id,n.clo_code,
             n.content,n.correct_answer,n.explanation,n.options
      from numbered n
      order by n.rn;

      get diagnostics v_batch = row_count;
      v_added:=v_batch;
      v_order:=v_order+v_batch;

      -- Fallback: permit previously seen questions, but never duplicate in the same attempt.
      if v_added<v_need then
        with candidates as (
          select p.*, random() as rnd
          from public.exam_question_pool p
          where p.exam_id=v_exam.id
            and p.clo_id=v_clo_id
            and (
              (v_kind='t' and p.topic_id=v_scope_id)
              or
              (v_kind='c' and p.chapter_id=v_scope_id and p.topic_id=any(v_exam.topic_ids))
            )
            and not exists(
              select 1 from public.attempt_questions aq
              where aq.attempt_id=p_attempt_id and aq.question_id=p.question_id
            )
          order by rnd
          limit (v_need-v_added)
        ), numbered as (
          select c.*,row_number() over(order by c.rnd)::integer as rn
          from candidates c
        )
        insert into public.attempt_questions(
          attempt_id,question_id,question_order,chapter_id,chapter_name,topic_id,topic_name,clo_id,clo_code,
          content,correct_answer,explanation,options
        )
        select p_attempt_id,n.question_id,v_order+n.rn,n.chapter_id,n.chapter_name,n.topic_id,n.topic_name,n.clo_id,n.clo_code,
               n.content,n.correct_answer,n.explanation,n.options
        from numbered n
        order by n.rn;

        get diagnostics v_batch = row_count;
        v_added:=v_added+v_batch;
        v_order:=v_order+v_batch;
      end if;

      if v_added<v_need then
        raise exception 'Pool không đủ câu ngẫu nhiên cho ô %',cell.key;
      end if;
    end loop;
  end if;

  if (select count(*) from public.attempt_questions where attempt_id=p_attempt_id)<>v_exam.total_questions then
    raise exception 'Không rút đủ số câu cho lượt làm';
  end if;

  return (select count(*) from public.attempt_questions where attempt_id=p_attempt_id);
end;
$$;
revoke all on function public.populate_attempt_questions(uuid) from public,anon;
grant execute on function public.populate_attempt_questions(uuid) to authenticated;

create or replace function public.start_exam_attempt(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype;
  v_open public.exam_attempts%rowtype;
  v_attempt public.exam_attempts%rowtype;
  v_count integer;
  v_next integer;
  v_expired boolean;
begin
  select * into v_exam from public.exams where id=p_exam_id;
  if not found then raise exception 'Không tìm thấy bài kiểm tra'; end if;
  if auth.uid() is null or not public.is_subject_student(v_exam.subject_id) then raise exception 'Bạn không thuộc học phần này'; end if;

  -- Admission lock only serializes duplicate requests from the same student for the same exam.
  perform pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||auth.uid()::text, 0));

  select * into v_open
  from public.exam_attempts
  where exam_id=p_exam_id and student_id=auth.uid() and submitted_at is null
  order by attempt_number desc
  limit 1
  for update;

  if found then
    v_expired:=v_exam.duration_minutes is not null
      and now()>=v_open.started_at+make_interval(mins=>v_exam.duration_minutes);
    if not v_expired then
      perform public.populate_attempt_questions(v_open.id);
      return jsonb_build_object('attempt_id',v_open.id,'attempt_number',v_open.attempt_number,'resumed',true);
    end if;
    perform public.finalize_exam_attempt(v_open.id);
  end if;

  if v_exam.status<>'active' then raise exception 'Bài kiểm tra đang tạm dừng hoặc chưa được phát hành'; end if;
  if v_exam.opens_at is not null and now()<v_exam.opens_at then raise exception 'Bài kiểm tra chưa đến thời gian mở'; end if;
  if v_exam.closes_at is not null and now()>v_exam.closes_at then raise exception 'Bài kiểm tra đã kết thúc'; end if;
  if not exists(select 1 from public.exam_question_pool where exam_id=p_exam_id) then raise exception 'Bài kiểm tra chưa có pool câu hỏi'; end if;

  select count(*) into v_count from public.exam_attempts where exam_id=p_exam_id and student_id=auth.uid();
  if v_count>=greatest(1,v_exam.max_attempts) then raise exception 'Bạn đã sử dụng hết số lần làm bài'; end if;

  v_next:=v_count+1;
  insert into public.exam_attempts(exam_id,student_id,attempt_number,started_at)
  values(p_exam_id,auth.uid(),v_next,now()) returning * into v_attempt;
  perform public.populate_attempt_questions(v_attempt.id);
  return jsonb_build_object('attempt_id',v_attempt.id,'attempt_number',v_attempt.attempt_number,'resumed',false);
end;
$$;
revoke all on function public.start_exam_attempt(uuid) from public,anon;
grant execute on function public.start_exam_attempt(uuid) to authenticated;

create or replace function public.save_exam_progress(p_attempt_id uuid,p_question_id uuid,p_selected_option text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id for update;
  if not found or v_attempt.student_id<>auth.uid() then raise exception 'Không có quyền lưu bài này'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Bài đã được nộp'; end if;

  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if v_exam.duration_minutes is not null
     and now()>v_attempt.started_at+make_interval(mins=>v_exam.duration_minutes)+interval '30 seconds' then
    raise exception 'Đã hết thời gian làm bài';
  end if;
  if p_selected_option is not null and p_selected_option not in ('A','B','C','D') then raise exception 'Phương án không hợp lệ'; end if;

  -- Do not call populate_attempt_questions on every answer once the attempt is already ready.
  if not exists(
    select 1 from public.attempt_questions
    where attempt_id=p_attempt_id and question_id=p_question_id
  ) then
    if not exists(select 1 from public.attempt_questions where attempt_id=p_attempt_id) then
      perform public.populate_attempt_questions(p_attempt_id);
    end if;
    if not exists(
      select 1 from public.attempt_questions
      where attempt_id=p_attempt_id and question_id=p_question_id
    ) then
      raise exception 'Câu hỏi không thuộc lượt làm này';
    end if;
  end if;

  insert into public.attempt_draft_answers(attempt_id,question_id,selected_option,updated_at)
  values(p_attempt_id,p_question_id,p_selected_option::character(1),now())
  on conflict(attempt_id,question_id)
  do update set selected_option=excluded.selected_option,updated_at=excluded.updated_at;
  return true;
end;
$$;
revoke all on function public.save_exam_progress(uuid,uuid,text) from public,anon;
grant execute on function public.save_exam_progress(uuid,uuid,text) to authenticated;

create or replace function public.finalize_exam_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_total integer;
  v_correct integer;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id for update;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;
  if auth.uid()<>v_attempt.student_id and not public.is_admin() and not public.is_subject_teacher(v_exam.subject_id) then
    raise exception 'Không có quyền nộp bài';
  end if;
  if v_attempt.submitted_at is not null then return public.get_attempt_result(p_attempt_id); end if;

  perform public.populate_attempt_questions(p_attempt_id);

  delete from public.student_answers where attempt_id=p_attempt_id;
  insert into public.student_answers(attempt_id,question_id,selected_option,is_correct)
  select p_attempt_id,aq.question_id,d.selected_option::character(1),coalesce(d.selected_option=aq.correct_answer::text,false)
  from public.attempt_questions aq
  left join public.attempt_draft_answers d
    on d.attempt_id=p_attempt_id and d.question_id=aq.question_id
  where aq.attempt_id=p_attempt_id;

  select count(*),count(*) filter(where is_correct)
  into v_total,v_correct
  from public.student_answers
  where attempt_id=p_attempt_id;

  update public.exam_attempts
  set submitted_at=now(),score=round(coalesce(v_correct,0)*10.0/nullif(v_total,0),2)
  where id=p_attempt_id;

  -- Draft data is no longer needed once the canonical student_answers rows exist.
  delete from public.attempt_draft_answers where attempt_id=p_attempt_id;

  return public.get_attempt_result(p_attempt_id);
end;
$$;
revoke all on function public.finalize_exam_attempt(uuid) from public,anon;
grant execute on function public.finalize_exam_attempt(uuid) to authenticated;

create or replace function public.submit_exam_attempt(p_attempt_id uuid,p_answers jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id for update;
  if not found then raise exception 'Không tìm thấy lượt làm bài'; end if;
  select * into v_exam from public.exams where id=v_attempt.exam_id;

  if auth.uid()<>v_attempt.student_id
     and not public.is_admin()
     and not public.is_subject_teacher(v_exam.subject_id) then
    raise exception 'Không có quyền nộp bài';
  end if;
  if v_attempt.submitted_at is not null then return public.get_attempt_result(p_attempt_id); end if;

  if p_answers is not null and jsonb_typeof(p_answers)<>'object' then
    raise exception 'Dữ liệu đáp án không hợp lệ';
  end if;

  perform public.populate_attempt_questions(p_attempt_id);

  -- Preserve previous security semantics: only the student can send answer changes.
  if auth.uid()<>v_attempt.student_id
     and p_answers is not null
     and p_answers<>'{}'::jsonb then
    raise exception 'Chỉ sinh viên sở hữu lượt làm mới được cập nhật đáp án';
  end if;

  if p_answers is not null and exists(
    select 1
    from jsonb_each_text(p_answers) a
    where (a.value is not null and a.value not in ('A','B','C','D'))
       or not exists(
         select 1 from public.attempt_questions aq
         where aq.attempt_id=p_attempt_id and aq.question_id::text=a.key
       )
  ) then
    raise exception 'Có đáp án hoặc mã câu hỏi không hợp lệ';
  end if;

  -- One bulk UPSERT replaces N calls to save_exam_progress during submission.
  if p_answers is not null and p_answers<>'{}'::jsonb then
    insert into public.attempt_draft_answers(attempt_id,question_id,selected_option,updated_at)
    select p_attempt_id,aq.question_id,a.value::character(1),now()
    from jsonb_each_text(p_answers) a
    join public.attempt_questions aq
      on aq.attempt_id=p_attempt_id and aq.question_id::text=a.key
    on conflict(attempt_id,question_id)
    do update set selected_option=excluded.selected_option,updated_at=excluded.updated_at;
  end if;

  return public.finalize_exam_attempt(p_attempt_id);
end;
$$;
revoke all on function public.submit_exam_attempt(uuid,jsonb) from public,anon;
grant execute on function public.submit_exam_attempt(uuid,jsonb) to authenticated;

create or replace function public.cleanup_assessment_transient_data()
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_drafts integer:=0;
  v_live integer:=0;
  v_events integer:=0;
begin
  -- Safety net for legacy submitted attempts that still have drafts.
  delete from public.attempt_draft_answers d
  where exists(
    select 1 from public.exam_attempts a
    where a.id=d.attempt_id and a.submitted_at is not null
  );
  get diagnostics v_drafts = row_count;

  -- Keep Live state for one day so teachers can still inspect the finished session.
  delete from public.attempt_live_state l
  where exists(
    select 1 from public.exam_attempts a
    where a.id=l.attempt_id
      and a.submitted_at is not null
      and a.submitted_at < now()-interval '1 day'
  );
  get diagnostics v_live = row_count;

  -- Monitoring events are operational data; retain 30 days only.
  delete from public.attempt_monitor_events e
  where e.created_at < now()-interval '30 days';
  get diagnostics v_events = row_count;

  return jsonb_build_object('drafts_deleted',v_drafts,'live_deleted',v_live,'events_deleted',v_events);
end;
$$;
revoke all on function public.cleanup_assessment_transient_data() from public,anon,authenticated;

-- Daily cleanup at 03:17 UTC. Re-scheduling by name keeps migration idempotent.
do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='aiclo_assessment_transient_cleanup' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
  perform cron.schedule(
    'aiclo_assessment_transient_cleanup',
    '17 3 * * *',
    'select public.cleanup_assessment_transient_data();'
  );
end;
$$;

commit;

select 'ASSESSMENT_FREE_TIER_LOAD_OPTIMIZATION_OK' as status,
       public.assessment_free_tier_optimization_version() as version;
