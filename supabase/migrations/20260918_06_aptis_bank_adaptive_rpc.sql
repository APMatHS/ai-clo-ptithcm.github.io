-- AI-CLO Aptis Lab — duplicate scan + adaptive practice draw
-- Already applied to production rraooqedkpyhokattwdz on 2026-09-18.

create or replace function public.aptis_find_question_duplicates(p_prompt text,p_exclude_id uuid default null)
returns table(id uuid,skill text,level text,prompt text,status text,similarity_score real)
language sql
security invoker
set search_path=public,pg_temp
as $$
  select q.id,q.skill,q.level,q.prompt,q.status,public.similarity(lower(q.prompt),lower(coalesce(p_prompt,'')))::real
  from public.aptis_questions q
  where public.aptis_is_content_editor()
    and (p_exclude_id is null or q.id<>p_exclude_id)
    and (q.content_hash=public.aptis_hash_text(p_prompt) or public.similarity(lower(q.prompt),lower(coalesce(p_prompt,'')))>=0.78)
  order by 6 desc
  limit 10;
$$;

create or replace function public.aptis_draw_practice(p_skill text default null,p_level text default null,p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_attempt uuid;
  v_level text;
  v_limit integer:=greatest(1,least(coalesce(p_limit,10),50));
  v_questions jsonb;
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  if p_skill is not null and p_skill not in ('grammar','vocabulary','reading','listening','speaking','writing') then raise exception 'INVALID_SKILL' using errcode='22023'; end if;
  select coalesce(p_level,m.target_level,'B2') into v_level from public.aptis_memberships m where m.user_id=v_uid;
  if v_level is null then v_level:=coalesce(p_level,'B2'); end if;
  if v_level not in ('B1','B2') then raise exception 'INVALID_LEVEL' using errcode='22023'; end if;

  insert into public.aptis_attempts(user_id,mode,exam_family,skill,target_level)
  values(v_uid,'practice','general',p_skill,v_level) returning id into v_attempt;

  with candidates as (
    select q.id,
      coalesce(h.seen,0) as seen,
      coalesce(h.wrong_seen,false) as wrong_seen,
      h.last_seen,
      coalesce(h.correct_seen,0) as correct_seen
    from public.aptis_questions q
    left join public.aptis_sets s on s.id=q.set_id
    left join lateral (
      select count(*)::int as seen,
             bool_or(ai.is_correct=false) as wrong_seen,
             max(ai.answered_at) as last_seen,
             count(*) filter(where ai.is_correct=true)::int as correct_seen
      from public.aptis_attempt_items ai
      join public.aptis_attempts aa on aa.id=ai.attempt_id
      where aa.user_id=v_uid and ai.question_id=q.id and ai.answered_at is not null
    ) h on true
    where q.exam_family='general' and q.status='published' and q.is_active=true
      and (q.set_id is null or (s.status='published' and s.is_active=true))
      and (p_skill is null or q.skill=p_skill)
      and q.level=v_level
  ), picked as (
    select c.id,row_number() over(order by
      case when c.seen=0 then 0 when c.wrong_seen then 1 when c.last_seen < now()-interval '14 days' then 2 else 3 end,
      c.correct_seen asc,random())::int as pos
    from candidates c
    order by case when c.seen=0 then 0 when c.wrong_seen then 1 when c.last_seen < now()-interval '14 days' then 2 else 3 end,
             c.correct_seen asc,random()
    limit v_limit
  ), ins as (
    insert into public.aptis_attempt_items(attempt_id,question_id,position)
    select v_attempt,id,pos from picked
    returning question_id,position
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'skill',q.skill,'part',q.part,'question_type',q.question_type,
    'level',q.level,'difficulty',q.difficulty,'topic',q.topic,'prompt',q.prompt,
    'content',q.content,'media',q.media,'position',i.position,'set_id',q.set_id,'item_order',q.item_order,
    'set_context',case when s.id is null then null else jsonb_build_object(
      'id',s.id,'title',s.title,'instructions',s.instructions,
      'body_text',case when q.skill='reading' then s.body_text else null end,
      'media',s.media,'part',s.part,'topic',s.topic
    ) end
  ) order by i.position),'[]'::jsonb)
  into v_questions
  from ins i
  join public.aptis_questions q on q.id=i.question_id
  left join public.aptis_sets s on s.id=q.set_id;

  update public.aptis_attempts set question_count=jsonb_array_length(v_questions) where id=v_attempt;
  if jsonb_array_length(v_questions)=0 then
    delete from public.aptis_attempts where id=v_attempt;
    return jsonb_build_object('attempt_id',null,'questions','[]'::jsonb);
  end if;
  return jsonb_build_object('attempt_id',v_attempt,'questions',v_questions);
end;
$$;

revoke execute on function public.aptis_find_question_duplicates(text,uuid) from public,anon;
grant execute on function public.aptis_find_question_duplicates(text,uuid) to authenticated;
revoke execute on function public.aptis_draw_practice(text,text,integer) from public,anon;
grant execute on function public.aptis_draw_practice(text,text,integer) to authenticated;
