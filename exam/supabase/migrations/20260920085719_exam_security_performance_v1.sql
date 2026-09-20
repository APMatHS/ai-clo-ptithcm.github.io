create or replace function private.storage_exam_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = storage, public, pg_catalog
as $$
declare parts text[]; result uuid;
begin
  parts := storage.foldername(p_name);
  if array_length(parts,1) < 2 or parts[1] <> 'exams' then return null; end if;
  begin result := parts[2]::uuid; exception when others then return null; end;
  return result;
end; $$;

drop policy if exists exams_insert on public.exams;
create policy exams_insert on public.exams for insert to authenticated
with check (created_by=(select auth.uid()) and private.is_active_staff());

drop policy if exists room_staff_select on public.exam_room_staff;
create policy room_staff_select on public.exam_room_staff for select to authenticated
using (user_id=(select auth.uid()) or private.can_room(room_id));

drop policy if exists rooms_write on public.exam_rooms;
create policy rooms_insert on public.exam_rooms for insert to authenticated
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions')));
create policy rooms_update on public.exam_rooms for update to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions')))
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions')));
create policy rooms_delete on public.exam_rooms for delete to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions')));

drop policy if exists room_staff_write on public.exam_room_staff;
create policy room_staff_insert on public.exam_room_staff for insert to authenticated
with check (exists(select 1 from public.exam_rooms r join public.exam_sessions s on s.id=r.session_id where r.id=room_id and private.can_exam(s.exam_id,'manage_members')));
create policy room_staff_update on public.exam_room_staff for update to authenticated
using (exists(select 1 from public.exam_rooms r join public.exam_sessions s on s.id=r.session_id where r.id=room_id and private.can_exam(s.exam_id,'manage_members')))
with check (exists(select 1 from public.exam_rooms r join public.exam_sessions s on s.id=r.session_id where r.id=room_id and private.can_exam(s.exam_id,'manage_members')));
create policy room_staff_delete on public.exam_room_staff for delete to authenticated
using (exists(select 1 from public.exam_rooms r join public.exam_sessions s on s.id=r.session_id where r.id=room_id and private.can_exam(s.exam_id,'manage_members')));

drop policy if exists students_write on public.exam_students;
create policy students_insert on public.exam_students for insert to authenticated with check (private.can_exam(exam_id,'manage_roster'));
create policy students_update on public.exam_students for update to authenticated using (private.can_exam(exam_id,'manage_roster')) with check (private.can_exam(exam_id,'manage_roster'));
create policy students_delete on public.exam_students for delete to authenticated using (private.can_exam(exam_id,'manage_roster'));

drop policy if exists codes_write on public.exam_student_codes;
create policy codes_insert on public.exam_student_codes for insert to authenticated
with check (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster')));
create policy codes_update on public.exam_student_codes for update to authenticated
using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster')))
with check (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster')));
create policy codes_delete on public.exam_student_codes for delete to authenticated
using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster')));

drop policy if exists papers_write on public.exam_papers;
create policy papers_insert on public.exam_papers for insert to authenticated
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper')));
create policy papers_update on public.exam_papers for update to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper')))
with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper')));
create policy papers_delete on public.exam_papers for delete to authenticated
using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper')));

create index if not exists attempt_questions_group_version_idx on public.attempt_questions(group_version_id);
create index if not exists attempt_questions_question_idx on public.attempt_questions(question_id);
create index if not exists attempt_questions_question_version_idx on public.attempt_questions(question_version_id);
create index if not exists attempt_sessions_attempt_idx on public.attempt_sessions(attempt_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id);
create index if not exists exam_assets_created_by_idx on public.exam_assets(created_by);
create index if not exists exam_assets_exam_idx on public.exam_assets(exam_id);
create index if not exists exam_attempts_paper_version_idx on public.exam_attempts(paper_version_id);
create index if not exists exam_attempts_session_idx on public.exam_attempts(session_id);
create index if not exists exam_paper_versions_created_by_idx on public.exam_paper_versions(created_by);
create index if not exists exam_papers_created_by_idx on public.exam_papers(created_by);
create index if not exists exam_students_room_idx on public.exam_students(room_id);
create index if not exists exams_created_by_idx on public.exams(created_by);
create index if not exists pvq_group_version_idx on public.paper_version_questions(group_version_id);
create index if not exists pvq_question_idx on public.paper_version_questions(question_id);
create index if not exists pvq_question_version_idx on public.paper_version_questions(question_version_id);
create index if not exists question_group_versions_created_by_idx on public.question_group_versions(created_by);
create index if not exists question_groups_paper_idx on public.question_groups(paper_id);
create index if not exists question_versions_created_by_idx on public.question_versions(created_by);
create index if not exists questions_group_idx on public.questions(group_id);
