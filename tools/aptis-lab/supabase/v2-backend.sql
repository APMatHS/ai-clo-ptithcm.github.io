-- AI-CLO Aptis Lab V2 secure backend patch
-- Project: rraooqedkpyhokattwdz
-- Goals:
-- 1) keep mock answers hidden from learner-facing Data API/RPCs;
-- 2) store mock attempts with mode='mock';
-- 3) provide dedicated safe draw/resume/submit/finalize RPCs;
-- 4) keep progress analytics on non-mock practice data.

-- ---------------------------------------------------------------------------
-- Progress breakdown: exclude mock attempts so aggregate data cannot be used to
-- infer answer correctness while a mock is in progress.
-- ---------------------------------------------------------------------------
create or replace function public.aptis_progress_breakdown_v2(p_days integer default 90)
returns table(
  skill text,
  part text,
  topic text,
  answered_count bigint,
  correct_count bigint,
  accuracy_percent numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    q.skill,
    q.part,
    q.topic,
    count(*)::bigint as answered_count,
    count(*) filter (where i.is_correct is true)::bigint as correct_count,
    round(
      100.0 * count(*) filter (where i.is_correct is true)
      / nullif(count(*) filter (where i.is_correct is not null), 0),
      1
    ) as accuracy_percent
  from public.aptis_attempt_items i
  join public.aptis_attempts a on a.id = i.attempt_id
  join public.aptis_questions q on q.id = i.question_id
  where auth.uid() is not null
    and public.aptis_has_access()
    and a.user_id = auth.uid()
    and a.mode <> 'mock'
    and i.answered_at is not null
    and i.answered_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
    and i.is_correct is not null
  group by q.skill, q.part, q.topic
  order by q.skill, accuracy_percent asc nulls last, answered_count desc, q.part, q.topic;
$$;

revoke all on function public.aptis_progress_breakdown_v2(integer) from public;
revoke all on function public.aptis_progress_breakdown_v2(integer) from anon;
grant execute on function public.aptis_progress_breakdown_v2(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: learners may still read their normal practice rows directly, but mock
-- attempts/items are intentionally hidden and must go through safe RPCs below.
-- ---------------------------------------------------------------------------
drop policy if exists aptis_attempts_own_read on public.aptis_attempts;
create policy aptis_attempts_own_read
on public.aptis_attempts
for select
to authenticated
using (
  user_id = (select auth.uid())
  and mode <> 'mock'
  and public.aptis_has_access()
);

drop policy if exists aptis_attempt_items_own_read on public.aptis_attempt_items;
create policy aptis_attempt_items_own_read
on public.aptis_attempt_items
for select
to authenticated
using (
  public.aptis_has_access()
  and exists (
    select 1
    from public.aptis_attempts a
    where a.id = aptis_attempt_items.attempt_id
      and a.user_id = (select auth.uid())
      and a.mode <> 'mock'
  )
);

-- ---------------------------------------------------------------------------
-- Generic practice RPCs: explicitly reject mock attempts. This closes the old
-- answer-leak path where a learner could call the practice RPC manually.
-- ---------------------------------------------------------------------------
create or replace function public.aptis_get_attempt_resume(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.aptis_attempts%rowtype;
  v_questions jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  select a.* into v_attempt
  from public.aptis_attempts a
  where a.id = p_attempt_id and a.user_id = v_uid;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode='P0002';
  end if;

  if v_attempt.mode = 'mock' then
    raise exception 'MOCK_USE_SECURE_RESUME' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'skill',q.skill,
    'part',q.part,
    'question_type',q.question_type,
    'level',q.level,
    'difficulty',q.difficulty,
    'topic',q.topic,
    'prompt',q.prompt,
    'content',case when i.option_order is null then q.content else jsonb_set(
      q.content,
      '{options}',
      coalesce((
        select jsonb_agg(o order by ord.pos)
        from jsonb_array_elements(i.option_order) with ordinality ord(k,pos)
        join jsonb_array_elements(q.content->'options') o on o->>'key'=ord.k#>>'{}'
      ),'[]'::jsonb),
      true
    ) end,
    'media',q.media,
    'position',i.position,
    'response',i.response,
    'answered',(i.answered_at is not null),
    'is_correct',i.is_correct,
    'correct_answer',case when i.answered_at is not null and q.question_type not in ('speaking_prompt','writing_prompt') then q.answer else null end,
    'explanation',case when i.answered_at is not null then q.explanation else null end,
    'set',case when s.id is null then null else jsonb_build_object(
      'id',s.id,
      'title',s.title,
      'instructions',s.instructions,
      'body_text',s.body_text,
      'media',s.media,
      'transcript',case when i.answered_at is not null then s.transcript else null end
    ) end
  ) order by i.position),'[]'::jsonb)
  into v_questions
  from public.aptis_attempt_items i
  join public.aptis_questions q on q.id=i.question_id
  left join public.aptis_sets s on s.id=q.set_id
  where i.attempt_id=p_attempt_id;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,
    'mode',v_attempt.mode,
    'skill',v_attempt.skill,
    'target_level',v_attempt.target_level,
    'metadata',v_attempt.metadata,
    'question_count',v_attempt.question_count,
    'answered_count',v_attempt.answered_count,
    'score_percent',v_attempt.score_percent,
    'completed_at',v_attempt.completed_at,
    'questions',v_questions
  );
end;
$$;

create or replace function public.aptis_submit_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_response jsonb,
  p_response_time_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_q public.aptis_questions%rowtype;
  v_item public.aptis_attempt_items%rowtype;
  v_mode text;
  v_correct boolean;
  v_total integer;
  v_answered integer;
  v_graded integer;
  v_correct_count integer;
begin
  if not public.aptis_has_access() then
    raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501';
  end if;

  select i.*, a.mode
  into v_item, v_mode
  from public.aptis_attempt_items i
  join public.aptis_attempts a on a.id=i.attempt_id
  where i.attempt_id=p_attempt_id
    and i.question_id=p_question_id
    and a.user_id=v_uid;

  if not found then
    raise exception 'QUESTION_NOT_IN_ATTEMPT' using errcode='42501';
  end if;

  if v_mode = 'mock' then
    raise exception 'MOCK_USE_SECURE_SUBMIT' using errcode='42501';
  end if;

  select * into v_q from public.aptis_questions where id=p_question_id;

  if v_item.answered_at is not null then
    return jsonb_build_object(
      'is_correct',v_item.is_correct,
      'correct_answer',case when v_q.question_type in ('speaking_prompt','writing_prompt') then null else v_q.answer end,
      'explanation',v_q.explanation,
      'already_answered',true
    );
  end if;

  if v_q.question_type in ('speaking_prompt','writing_prompt') then
    v_correct:=null;
  else
    v_correct:=(coalesce(p_response,'null'::jsonb)=coalesce(v_q.answer,'null'::jsonb));
  end if;

  update public.aptis_attempt_items
  set response=p_response,
      is_correct=v_correct,
      answered_at=now(),
      response_time_ms=p_response_time_ms
  where id=v_item.id;

  update public.aptis_questions
  set times_used=times_used+1,
      times_correct=times_correct+case when v_correct then 1 else 0 end
  where id=v_q.id;

  insert into public.aptis_activity_days(user_id,activity_date,practice_count,questions_answered)
  values(v_uid,current_date,0,1)
  on conflict(user_id,activity_date)
  do update set questions_answered=public.aptis_activity_days.questions_answered+1;

  select a.question_count,
         count(*) filter(where i.answered_at is not null),
         count(*) filter(where i.answered_at is not null and i.is_correct is not null),
         count(*) filter(where i.is_correct=true)
    into v_total,v_answered,v_graded,v_correct_count
  from public.aptis_attempts a
  left join public.aptis_attempt_items i on i.attempt_id=a.id
  where a.id=p_attempt_id
  group by a.question_count;

  update public.aptis_attempts
  set answered_count=v_answered,
      correct_count=v_correct_count,
      score_percent=case when v_graded>0 then round((100.0*v_correct_count/v_graded)::numeric,2) else null end,
      completed_at=case when v_total>0 and v_answered>=v_total then now() else completed_at end
  where id=p_attempt_id;

  if v_total>0 and v_answered>=v_total then
    update public.aptis_activity_days
    set practice_count=practice_count+1
    where user_id=v_uid and activity_date=current_date;
  end if;

  return jsonb_build_object(
    'is_correct',v_correct,
    'correct_answer',case when v_q.question_type in ('speaking_prompt','writing_prompt') then null else v_q.answer end,
    'explanation',v_q.explanation,
    'already_answered',false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Secure mock draw. Reading/Listening are clustered by set so a mock does not
-- randomly jump across unrelated passages/audio on every single question.
-- Speaking/Writing use standard Part 1-4 prompts first.
-- ---------------------------------------------------------------------------
create or replace function public.aptis_draw_mock_block(
  p_skill text,
  p_level text default 'B2',
  p_limit integer default 10,
  p_mock_kind text default 'full',
  p_section text default null,
  p_mock_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt uuid;
  v_level text := coalesce(p_level,'B2');
  v_limit integer := greatest(1,least(coalesce(p_limit,10),50));
  v_questions jsonb;
begin
  if not public.aptis_has_access() then
    raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501';
  end if;

  if p_skill not in ('grammar','vocabulary','reading','listening','speaking','writing') then
    raise exception 'INVALID_SKILL' using errcode='22023';
  end if;
  if v_level not in ('B1','B2') then
    raise exception 'INVALID_LEVEL' using errcode='22023';
  end if;
  if p_mock_kind not in ('mini','full') then
    raise exception 'INVALID_MOCK_KIND' using errcode='22023';
  end if;
  if v_level='B1' and p_skill in ('speaking','writing') then
    raise exception 'MOCK_B1_SPEAKING_WRITING_UNAVAILABLE' using errcode='22023';
  end if;

  insert into public.aptis_attempts(user_id,mode,exam_family,skill,target_level,metadata)
  values(
    v_uid,
    'mock',
    'general',
    p_skill,
    v_level,
    jsonb_build_object(
      'v2',true,
      'mock_kind',p_mock_kind,
      'section',p_section,
      'mock_session_id',p_mock_session_id
    )
  )
  returning id into v_attempt;

  if p_skill in ('reading','listening') then
    with candidate_groups as (
      select g.group_id, random() as group_random
      from (
        select distinct coalesce(q.set_id,q.id) as group_id
        from public.aptis_questions q
        left join public.aptis_sets s on s.id=q.set_id
        where q.exam_family='general'
          and q.status='published'
          and q.is_active=true
          and q.skill=p_skill
          and q.level=v_level
          and (q.set_id is null or (s.status='published' and s.is_active=true))
      ) g
    ), candidates as (
      select q.id,
             row_number() over(
               order by cg.group_random, coalesce(q.item_order,2147483647), random()
             )::int as pos
      from public.aptis_questions q
      left join public.aptis_sets s on s.id=q.set_id
      join candidate_groups cg on cg.group_id=coalesce(q.set_id,q.id)
      where q.exam_family='general'
        and q.status='published'
        and q.is_active=true
        and q.skill=p_skill
        and q.level=v_level
        and (q.set_id is null or (s.status='published' and s.is_active=true))
    ), picked as (
      select id,pos from candidates order by pos limit v_limit
    )
    insert into public.aptis_attempt_items(attempt_id,question_id,position)
    select v_attempt,id,row_number() over(order by pos)::int
    from picked;

  elsif p_skill in ('speaking','writing') then
    with standard as (
      select q.id,
             q.part,
             row_number() over(partition by q.part order by random()) as part_rn
      from public.aptis_questions q
      where q.exam_family='general'
        and q.status='published'
        and q.is_active=true
        and q.skill=p_skill
        and q.level=v_level
        and q.part in ('Part 1','Part 2','Part 3','Part 4')
    ), primary_pick as (
      select id,
             case part
               when 'Part 1' then 1
               when 'Part 2' then 2
               when 'Part 3' then 3
               when 'Part 4' then 4
               else 99
             end as ord
      from standard
      where part_rn=1
    ), extra_pick as (
      select q.id,
             100 + row_number() over(order by random())::int as ord
      from public.aptis_questions q
      where q.exam_family='general'
        and q.status='published'
        and q.is_active=true
        and q.skill=p_skill
        and q.level=v_level
        and not exists (select 1 from primary_pick p where p.id=q.id)
    ), picked as (
      select id,ord
      from (
        select * from primary_pick
        union all
        select * from extra_pick
      ) x
      order by ord
      limit v_limit
    )
    insert into public.aptis_attempt_items(attempt_id,question_id,position)
    select v_attempt,id,row_number() over(order by ord)::int
    from picked;

  else
    with picked as (
      select q.id,
             row_number() over(order by random())::int as pos
      from public.aptis_questions q
      where q.exam_family='general'
        and q.status='published'
        and q.is_active=true
        and q.skill=p_skill
        and q.level=v_level
      order by random()
      limit v_limit
    )
    insert into public.aptis_attempt_items(attempt_id,question_id,position)
    select v_attempt,id,pos from picked;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'skill',q.skill,
    'part',q.part,
    'question_type',q.question_type,
    'level',q.level,
    'difficulty',q.difficulty,
    'topic',q.topic,
    'prompt',q.prompt,
    'content',q.content,
    'media',q.media,
    'position',i.position,
    'set_id',q.set_id,
    'item_order',q.item_order,
    'set_context',case when s.id is null then null else jsonb_build_object(
      'id',s.id,
      'title',s.title,
      'instructions',s.instructions,
      'body_text',case when q.skill='reading' then s.body_text else null end,
      'media',s.media,
      'part',s.part,
      'topic',s.topic
    ) end
  ) order by i.position),'[]'::jsonb)
  into v_questions
  from public.aptis_attempt_items i
  join public.aptis_questions q on q.id=i.question_id
  left join public.aptis_sets s on s.id=q.set_id
  where i.attempt_id=v_attempt;

  update public.aptis_attempts
  set question_count=jsonb_array_length(v_questions)
  where id=v_attempt;

  if jsonb_array_length(v_questions)=0 then
    delete from public.aptis_attempts where id=v_attempt;
    return jsonb_build_object('attempt_id',null,'questions','[]'::jsonb);
  end if;

  return jsonb_build_object(
    'attempt_id',v_attempt,
    'mode','mock',
    'target_level',v_level,
    'questions',v_questions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Safe mock resume: no is_correct, answer, explanation or listening transcript.
-- ---------------------------------------------------------------------------
create or replace function public.aptis_get_mock_resume(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.aptis_attempts%rowtype;
  v_questions jsonb;
begin
  if not public.aptis_has_access() then
    raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501';
  end if;

  select a.* into v_attempt
  from public.aptis_attempts a
  where a.id=p_attempt_id
    and a.user_id=v_uid
    and a.mode='mock';

  if not found then
    raise exception 'MOCK_ATTEMPT_NOT_FOUND' using errcode='P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'skill',q.skill,
    'part',q.part,
    'question_type',q.question_type,
    'level',q.level,
    'difficulty',q.difficulty,
    'topic',q.topic,
    'prompt',q.prompt,
    'content',case when i.option_order is null then q.content else jsonb_set(
      q.content,
      '{options}',
      coalesce((
        select jsonb_agg(o order by ord.pos)
        from jsonb_array_elements(i.option_order) with ordinality ord(k,pos)
        join jsonb_array_elements(q.content->'options') o on o->>'key'=ord.k#>>'{}'
      ),'[]'::jsonb),
      true
    ) end,
    'media',q.media,
    'position',i.position,
    'set_id',q.set_id,
    'item_order',q.item_order,
    'response',i.response,
    'answered',(i.answered_at is not null),
    'set',case when s.id is null then null else jsonb_build_object(
      'id',s.id,
      'title',s.title,
      'instructions',s.instructions,
      'body_text',case when q.skill='reading' then s.body_text else null end,
      'media',s.media,
      'part',s.part,
      'topic',s.topic
    ) end
  ) order by i.position),'[]'::jsonb)
  into v_questions
  from public.aptis_attempt_items i
  join public.aptis_questions q on q.id=i.question_id
  left join public.aptis_sets s on s.id=q.set_id
  where i.attempt_id=p_attempt_id;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,
    'mode','mock',
    'skill',v_attempt.skill,
    'target_level',v_attempt.target_level,
    'metadata',v_attempt.metadata,
    'question_count',v_attempt.question_count,
    'answered_count',v_attempt.answered_count,
    'completed_at',v_attempt.completed_at,
    'questions',v_questions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Safe mock submit: grades server-side but returns no correctness/answer data.
-- ---------------------------------------------------------------------------
create or replace function public.aptis_submit_mock_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_response jsonb,
  p_response_time_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.aptis_attempts%rowtype;
  v_q public.aptis_questions%rowtype;
  v_item public.aptis_attempt_items%rowtype;
  v_correct boolean;
  v_total integer;
  v_answered integer;
  v_graded integer;
  v_correct_count integer;
begin
  if not public.aptis_has_access() then
    raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501';
  end if;

  select a.* into v_attempt
  from public.aptis_attempts a
  where a.id=p_attempt_id
    and a.user_id=v_uid
    and a.mode='mock';

  if not found then
    raise exception 'MOCK_ATTEMPT_NOT_FOUND' using errcode='P0002';
  end if;
  if v_attempt.completed_at is not null then
    raise exception 'MOCK_ATTEMPT_CLOSED' using errcode='42501';
  end if;

  select i.* into v_item
  from public.aptis_attempt_items i
  where i.attempt_id=p_attempt_id
    and i.question_id=p_question_id;

  if not found then
    raise exception 'QUESTION_NOT_IN_MOCK_ATTEMPT' using errcode='42501';
  end if;

  if v_item.answered_at is not null then
    return jsonb_build_object('accepted',true,'already_answered',true,'attempt_completed',false);
  end if;

  select * into v_q from public.aptis_questions where id=p_question_id;

  if v_q.question_type in ('speaking_prompt','writing_prompt') then
    v_correct:=null;
  else
    v_correct:=(coalesce(p_response,'null'::jsonb)=coalesce(v_q.answer,'null'::jsonb));
  end if;

  update public.aptis_attempt_items
  set response=p_response,
      is_correct=v_correct,
      answered_at=now(),
      response_time_ms=p_response_time_ms
  where id=v_item.id;

  update public.aptis_questions
  set times_used=times_used+1,
      times_correct=times_correct+case when v_correct then 1 else 0 end
  where id=v_q.id;

  insert into public.aptis_activity_days(user_id,activity_date,practice_count,questions_answered)
  values(v_uid,current_date,0,1)
  on conflict(user_id,activity_date)
  do update set questions_answered=public.aptis_activity_days.questions_answered+1;

  select a.question_count,
         count(*) filter(where i.answered_at is not null),
         count(*) filter(where i.answered_at is not null and i.is_correct is not null),
         count(*) filter(where i.is_correct=true)
    into v_total,v_answered,v_graded,v_correct_count
  from public.aptis_attempts a
  left join public.aptis_attempt_items i on i.attempt_id=a.id
  where a.id=p_attempt_id
  group by a.question_count;

  update public.aptis_attempts
  set answered_count=v_answered,
      correct_count=v_correct_count,
      score_percent=case when v_graded>0 then round((100.0*v_correct_count/v_graded)::numeric,2) else null end,
      completed_at=case when v_total>0 and v_answered>=v_total then now() else completed_at end
  where id=p_attempt_id;

  return jsonb_build_object(
    'accepted',true,
    'already_answered',false,
    'attempt_completed',(v_total>0 and v_answered>=v_total)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalize a mock block and expose only block-level summary. Once finalized,
-- no more answers can be submitted to that attempt.
-- ---------------------------------------------------------------------------
create or replace function public.aptis_finalize_mock_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.aptis_attempts%rowtype;
  v_total integer;
  v_answered integer;
  v_graded integer;
  v_correct integer;
  v_score numeric;
begin
  if not public.aptis_has_access() then
    raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501';
  end if;

  select a.* into v_attempt
  from public.aptis_attempts a
  where a.id=p_attempt_id
    and a.user_id=v_uid
    and a.mode='mock';

  if not found then
    raise exception 'MOCK_ATTEMPT_NOT_FOUND' using errcode='P0002';
  end if;

  select count(*)::int,
         count(*) filter(where i.answered_at is not null)::int,
         count(*) filter(where i.answered_at is not null and i.is_correct is not null)::int,
         count(*) filter(where i.is_correct=true)::int
    into v_total,v_answered,v_graded,v_correct
  from public.aptis_attempt_items i
  where i.attempt_id=p_attempt_id;

  v_score := case when v_graded>0 then round((100.0*v_correct/v_graded)::numeric,2) else null end;

  update public.aptis_attempts
  set question_count=v_total,
      answered_count=v_answered,
      correct_count=v_correct,
      score_percent=v_score,
      completed_at=coalesce(completed_at,now())
  where id=p_attempt_id;

  return jsonb_build_object(
    'attempt_id',p_attempt_id,
    'skill',v_attempt.skill,
    'answered_count',v_answered,
    'question_count',v_total,
    'score_percent',v_score,
    'completed',true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: all privileged mock RPCs are authenticated-only.
-- ---------------------------------------------------------------------------
revoke all on function public.aptis_draw_mock_block(text,text,integer,text,text,uuid) from public;
revoke all on function public.aptis_draw_mock_block(text,text,integer,text,text,uuid) from anon;
grant execute on function public.aptis_draw_mock_block(text,text,integer,text,text,uuid) to authenticated;

revoke all on function public.aptis_get_mock_resume(uuid) from public;
revoke all on function public.aptis_get_mock_resume(uuid) from anon;
grant execute on function public.aptis_get_mock_resume(uuid) to authenticated;

revoke all on function public.aptis_submit_mock_answer(uuid,uuid,jsonb,integer) from public;
revoke all on function public.aptis_submit_mock_answer(uuid,uuid,jsonb,integer) from anon;
grant execute on function public.aptis_submit_mock_answer(uuid,uuid,jsonb,integer) to authenticated;

revoke all on function public.aptis_finalize_mock_attempt(uuid) from public;
revoke all on function public.aptis_finalize_mock_attempt(uuid) from anon;
grant execute on function public.aptis_finalize_mock_attempt(uuid) to authenticated;

comment on function public.aptis_draw_mock_block(text,text,integer,text,text,uuid) is
  'Creates a learner-owned mode=mock attempt and returns questions without answer data.';
comment on function public.aptis_get_mock_resume(uuid) is
  'Resumes a mock attempt without exposing correctness, answers, explanations or listening transcripts.';
comment on function public.aptis_submit_mock_answer(uuid,uuid,jsonb,integer) is
  'Grades a mock answer server-side while returning only acknowledgement/completion state.';
comment on function public.aptis_finalize_mock_attempt(uuid) is
  'Closes a mock block and returns block-level counts/score only.';
comment on function public.aptis_progress_breakdown_v2(integer) is
  'Returns own non-mock objective accuracy grouped by skill/part/topic without exposing question answers.';
