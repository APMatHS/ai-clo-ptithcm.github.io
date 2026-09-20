create or replace function public.guard_exam_student_scope()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare session_exam uuid; room_session uuid;
begin
  select exam_id into session_exam from public.exam_sessions where id=new.session_id;
  if session_exam is null or session_exam <> new.exam_id then
    raise exception 'EXAM_STUDENT_SESSION_MISMATCH';
  end if;
  select session_id into room_session from public.exam_rooms where id=new.room_id;
  if room_session is null or room_session <> new.session_id then
    raise exception 'EXAM_STUDENT_ROOM_MISMATCH';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_exam_student_scope() from public, anon, authenticated;
drop trigger if exists guard_exam_student_scope on public.exam_students;
create trigger guard_exam_student_scope before insert or update of exam_id,session_id,room_id
on public.exam_students for each row execute function public.guard_exam_student_scope();

create or replace function public.guard_exam_attempt_scope()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare st public.exam_students%rowtype; exam_state public.exam_status; paper_session uuid; paper_state public.paper_status;
begin
  select * into st from public.exam_students where id=new.exam_student_id;
  if st.id is null then raise exception 'ATTEMPT_STUDENT_NOT_FOUND'; end if;
  if st.session_id <> new.session_id or st.room_id <> new.room_id then
    raise exception 'ATTEMPT_SCOPE_MISMATCH';
  end if;
  select status into exam_state from public.exams where id=st.exam_id;
  if tg_op='INSERT' and exam_state not in ('ready','live') then
    raise exception 'EXAM_NOT_OPEN';
  end if;
  select p.session_id,pv.status into paper_session,paper_state
    from public.exam_paper_versions pv
    join public.exam_papers p on p.id=pv.paper_id
   where pv.id=new.paper_version_id;
  if paper_session is null or paper_session <> new.session_id or paper_state not in ('locked','hotfix') then
    raise exception 'ATTEMPT_PAPER_NOT_READY';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_exam_attempt_scope() from public, anon, authenticated;
drop trigger if exists guard_exam_attempt_scope on public.exam_attempts;
create trigger guard_exam_attempt_scope before insert or update of exam_student_id,session_id,room_id,paper_version_id
on public.exam_attempts for each row execute function public.guard_exam_attempt_scope();
