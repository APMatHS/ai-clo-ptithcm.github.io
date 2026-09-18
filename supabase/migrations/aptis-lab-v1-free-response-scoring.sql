-- Production migration name: aptis_lab_v1_free_response_scoring
-- Free-response Speaking/Writing is stored but not scored until AI grading is connected.

create or replace function public.aptis_submit_answer(p_attempt_id uuid,p_question_id uuid,p_response jsonb,p_response_time_ms integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid();
  v_q public.aptis_questions%rowtype;
  v_item public.aptis_attempt_items%rowtype;
  v_correct boolean;
  v_total integer;
  v_answered integer;
  v_graded integer;
  v_correct_count integer;
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  select i.* into v_item
  from public.aptis_attempt_items i join public.aptis_attempts a on a.id=i.attempt_id
  where i.attempt_id=p_attempt_id and i.question_id=p_question_id and a.user_id=v_uid;
  if not found then raise exception 'QUESTION_NOT_IN_ATTEMPT' using errcode='42501'; end if;
  select * into v_q from public.aptis_questions where id=p_question_id;
  if v_item.answered_at is not null then
    return jsonb_build_object('is_correct',v_item.is_correct,'correct_answer',case when v_q.question_type in ('speaking_prompt','writing_prompt') then null else v_q.answer end,'explanation',v_q.explanation,'already_answered',true);
  end if;
  if v_q.question_type in ('speaking_prompt','writing_prompt') then v_correct:=null;
  else v_correct:=(coalesce(p_response,'null'::jsonb)=coalesce(v_q.answer,'null'::jsonb)); end if;
  update public.aptis_attempt_items set response=p_response,is_correct=v_correct,answered_at=now(),response_time_ms=p_response_time_ms where id=v_item.id;
  update public.aptis_questions set times_used=times_used+1,times_correct=times_correct+case when v_correct then 1 else 0 end where id=v_q.id;
  insert into public.aptis_activity_days(user_id,activity_date,practice_count,questions_answered)
  values(v_uid,current_date,0,1)
  on conflict(user_id,activity_date) do update set questions_answered=public.aptis_activity_days.questions_answered+1;
  select a.question_count,
         count(*) filter(where i.answered_at is not null),
         count(*) filter(where i.answered_at is not null and i.is_correct is not null),
         count(*) filter(where i.is_correct=true)
    into v_total,v_answered,v_graded,v_correct_count
  from public.aptis_attempts a left join public.aptis_attempt_items i on i.attempt_id=a.id
  where a.id=p_attempt_id group by a.question_count;
  update public.aptis_attempts set
    answered_count=v_answered,
    correct_count=v_correct_count,
    score_percent=case when v_graded>0 then round((100.0*v_correct_count/v_graded)::numeric,2) else null end,
    completed_at=case when v_total>0 and v_answered>=v_total then now() else completed_at end
  where id=p_attempt_id;
  if v_total>0 and v_answered>=v_total then
    update public.aptis_activity_days set practice_count=practice_count+1 where user_id=v_uid and activity_date=current_date;
  end if;
  return jsonb_build_object('is_correct',v_correct,'correct_answer',case when v_q.question_type in ('speaking_prompt','writing_prompt') then null else v_q.answer end,'explanation',v_q.explanation,'already_answered',false);
end;
$$;
revoke all on function public.aptis_submit_answer(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.aptis_submit_answer(uuid,uuid,jsonb,integer) to authenticated;
