-- Session-scoped temporary staff for AI-CLO EXAM.
-- Permanent system roles remain Admin / exam officer; teacher/proctor rights are carried
-- by exam_members.permissions as permission@session_uuid tokens.

create or replace function private.can_session(p_session_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public,auth
as $$
  select private.is_system_admin() or exists(
    select 1
    from public.exam_sessions s
    join public.exam_members m on m.exam_id=s.exam_id and m.user_id=auth.uid()
    join public.profiles p on p.id=m.user_id and p.active
    where s.id=p_session_id
      and (
        m.exam_role='owner'
        or ((p.system_role in ('admin','exam_officer')) and p_permission = any(m.permissions))
        or ((p_permission || '@' || p_session_id::text) = any(m.permissions))
        or (
          p_permission='view_exam'
          and exists(
            select 1 from unnest(m.permissions) as perm
            where split_part(perm,'@',2)=p_session_id::text
          )
        )
      )
  );
$$;

create or replace function private.can_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public,auth
as $$
  select private.is_system_admin()
    or exists(
      select 1
      from public.exam_room_staff rs
      join public.profiles p on p.id=rs.user_id and p.active
      where rs.room_id=p_room_id and rs.user_id=auth.uid()
    )
    or exists(
      select 1
      from public.exam_rooms r
      where r.id=p_room_id and private.can_session(r.session_id,'manage_live')
    );
$$;

create or replace function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value is null or p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.storage_session_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts:=string_to_array(coalesce(p_name,''),'/');
  if array_length(parts,1) >= 5 and parts[1]='exams' and parts[3]='sessions' then
    return private.try_uuid(parts[4]);
  end if;
  return null;
end;
$$;

revoke all on function private.can_session(uuid,text) from public;
revoke all on function private.can_room(uuid) from public;
revoke all on function private.try_uuid(text) from public;
revoke all on function private.storage_session_id(text) from public;
grant execute on function private.can_session(uuid,text) to authenticated,service_role;
grant execute on function private.can_room(uuid) to authenticated,service_role;
grant execute on function private.try_uuid(text) to authenticated,service_role;
grant execute on function private.storage_session_id(text) to authenticated,service_role;

-- Only Admin creates exams.
drop policy if exists exams_insert on public.exams;
create policy exams_insert on public.exams for insert to authenticated
with check (created_by=(select auth.uid()) and private.is_system_admin());

-- A member may read their own membership. Only Admin may create/update/remove
-- teacher/proctor membership; exam managers may still manage non-temporary roles.
drop policy if exists exam_members_select on public.exam_members;
create policy exam_members_select on public.exam_members for select to authenticated
using (
  user_id=(select auth.uid())
  or private.is_system_admin()
  or private.can_exam(exam_id,'manage_members')
);

drop policy if exists exam_members_insert on public.exam_members;
create policy exam_members_insert on public.exam_members for insert to authenticated
with check (
  private.is_system_admin()
  or (
    private.can_exam(exam_id,'manage_members')
    and exam_role not in ('author','proctor')
  )
);

drop policy if exists exam_members_update on public.exam_members;
create policy exam_members_update on public.exam_members for update to authenticated
using (
  private.is_system_admin()
  or (
    private.can_exam(exam_id,'manage_members')
    and exam_role not in ('author','proctor')
  )
)
with check (
  private.is_system_admin()
  or (
    private.can_exam(exam_id,'manage_members')
    and exam_role not in ('author','proctor')
  )
);

drop policy if exists exam_members_delete on public.exam_members;
create policy exam_members_delete on public.exam_members for delete to authenticated
using (
  exam_role <> 'owner'
  and (
    private.is_system_admin()
    or (
      private.can_exam(exam_id,'manage_members')
      and exam_role not in ('author','proctor')
    )
  )
);

-- Sessions: temporary staff can only see/update an assigned session. Creating a new
-- session remains an exam-wide manager operation.
drop policy if exists sessions_all_select on public.exam_sessions;
create policy sessions_all_select on public.exam_sessions for select to authenticated
using (private.can_session(id,'view_exam'));

drop policy if exists sessions_insert on public.exam_sessions;
create policy sessions_insert on public.exam_sessions for insert to authenticated
with check (private.can_exam(exam_id,'manage_sessions'));

drop policy if exists sessions_update on public.exam_sessions;
create policy sessions_update on public.exam_sessions for update to authenticated
using (private.can_session(id,'manage_sessions'))
with check (private.can_session(id,'manage_sessions'));

-- Rooms inherit the session scope.
drop policy if exists rooms_select on public.exam_rooms;
create policy rooms_select on public.exam_rooms for select to authenticated
using (private.can_session(session_id,'view_exam') or private.can_room(id));

drop policy if exists rooms_insert on public.exam_rooms;
create policy rooms_insert on public.exam_rooms for insert to authenticated
with check (private.can_session(session_id,'manage_sessions'));

drop policy if exists rooms_update on public.exam_rooms;
create policy rooms_update on public.exam_rooms for update to authenticated
using (private.can_session(session_id,'manage_sessions'))
with check (private.can_session(session_id,'manage_sessions'));

drop policy if exists rooms_delete on public.exam_rooms;
create policy rooms_delete on public.exam_rooms for delete to authenticated
using (private.can_session(session_id,'manage_sessions'));

-- Room staff remains assigned by Admin/exam managers; an assigned proctor can read own row.
drop policy if exists room_staff_select on public.exam_room_staff;
create policy room_staff_select on public.exam_room_staff for select to authenticated
using (
  user_id=(select auth.uid())
  or private.can_room(room_id)
  or exists(
    select 1 from public.exam_rooms r
    join public.exam_sessions s on s.id=r.session_id
    where r.id=room_id and private.can_exam(s.exam_id,'manage_members')
  )
);

-- Student roster and access-code operations are session-scoped.
drop policy if exists students_select on public.exam_students;
create policy students_select on public.exam_students for select to authenticated
using (private.can_session(session_id,'manage_roster') or private.can_room(room_id));

drop policy if exists students_insert on public.exam_students;
create policy students_insert on public.exam_students for insert to authenticated
with check (private.can_session(session_id,'manage_roster'));

drop policy if exists students_update on public.exam_students;
create policy students_update on public.exam_students for update to authenticated
using (private.can_session(session_id,'manage_roster'))
with check (private.can_session(session_id,'manage_roster'));

drop policy if exists students_delete on public.exam_students;
create policy students_delete on public.exam_students for delete to authenticated
using (private.can_session(session_id,'manage_roster'));

drop policy if exists codes_select on public.exam_student_codes;
create policy codes_select on public.exam_student_codes for select to authenticated
using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_session(s.session_id,'manage_roster')));

drop policy if exists codes_insert on public.exam_student_codes;
create policy codes_insert on public.exam_student_codes for insert to authenticated
with check (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_session(s.session_id,'manage_roster')));

drop policy if exists codes_update on public.exam_student_codes;
create policy codes_update on public.exam_student_codes for update to authenticated
using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_session(s.session_id,'manage_roster')))
with check (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_session(s.session_id,'manage_roster')));

drop policy if exists codes_delete on public.exam_student_codes;
create policy codes_delete on public.exam_student_codes for delete to authenticated
using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_session(s.session_id,'manage_roster')));

-- Paper/question authoring follows the paper session.
drop policy if exists papers_select on public.exam_papers;
create policy papers_select on public.exam_papers for select to authenticated
using (private.can_session(session_id,'manage_paper'));

drop policy if exists papers_insert on public.exam_papers;
create policy papers_insert on public.exam_papers for insert to authenticated
with check (private.can_session(session_id,'manage_paper'));

drop policy if exists papers_update on public.exam_papers;
create policy papers_update on public.exam_papers for update to authenticated
using (private.can_session(session_id,'manage_paper'))
with check (private.can_session(session_id,'manage_paper'));

drop policy if exists papers_delete on public.exam_papers;
create policy papers_delete on public.exam_papers for delete to authenticated
using (private.can_session(session_id,'manage_paper'));

drop policy if exists paper_versions_access on public.exam_paper_versions;
create policy paper_versions_access on public.exam_paper_versions for all to authenticated
using (exists(select 1 from public.exam_papers p where p.id=paper_id and private.can_session(p.session_id,'manage_paper')))
with check (exists(select 1 from public.exam_papers p where p.id=paper_id and private.can_session(p.session_id,'manage_paper')));

drop policy if exists groups_access on public.question_groups;
create policy groups_access on public.question_groups for all to authenticated
using (exists(select 1 from public.exam_papers p where p.id=paper_id and private.can_session(p.session_id,'manage_paper')))
with check (exists(select 1 from public.exam_papers p where p.id=paper_id and private.can_session(p.session_id,'manage_paper')));

drop policy if exists group_versions_access on public.question_group_versions;
create policy group_versions_access on public.question_group_versions for all to authenticated
using (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id where g.id=group_id and private.can_session(p.session_id,'manage_paper')))
with check (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id where g.id=group_id and private.can_session(p.session_id,'manage_paper')));

drop policy if exists questions_access on public.questions;
create policy questions_access on public.questions for all to authenticated
using (exists(select 1 from public.exam_papers p where p.id=paper_id and private.can_session(p.session_id,'manage_paper')))
with check (exists(select 1 from public.exam_papers p where p.id=paper_id and private.can_session(p.session_id,'manage_paper')));

drop policy if exists question_versions_access on public.question_versions;
create policy question_versions_select on public.question_versions for select to authenticated
using (exists(
  select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id
  where q.id=question_id and (
    private.can_session(p.session_id,'manage_paper')
    or private.can_session(p.session_id,'view_correct_answers')
  )
));
create policy question_versions_insert on public.question_versions for insert to authenticated
with check (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id where q.id=question_id and private.can_session(p.session_id,'manage_paper')));
create policy question_versions_update on public.question_versions for update to authenticated
using (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id where q.id=question_id and private.can_session(p.session_id,'manage_paper')))
with check (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id where q.id=question_id and private.can_session(p.session_id,'manage_paper')));
create policy question_versions_delete on public.question_versions for delete to authenticated
using (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id where q.id=question_id and private.can_session(p.session_id,'manage_paper')));

drop policy if exists pvq_access on public.paper_version_questions;
create policy pvq_access on public.paper_version_questions for all to authenticated
using (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id where pv.id=paper_version_id and private.can_session(p.session_id,'manage_paper')))
with check (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id where pv.id=paper_version_id and private.can_session(p.session_id,'manage_paper')));

-- Source/image/audio rows carry metadata.session_id when uploaded by a temporary author.
drop policy if exists assets_access on public.exam_assets;
create policy assets_select on public.exam_assets for select to authenticated
using (
  private.can_exam(exam_id,'manage_assets')
  or private.can_session(private.try_uuid(metadata->>'session_id'),'manage_assets')
);
create policy assets_insert on public.exam_assets for insert to authenticated
with check (
  private.can_exam(exam_id,'manage_assets')
  or private.can_session(private.try_uuid(metadata->>'session_id'),'manage_assets')
);
create policy assets_update on public.exam_assets for update to authenticated
using (
  private.can_exam(exam_id,'manage_assets')
  or private.can_session(private.try_uuid(metadata->>'session_id'),'manage_assets')
)
with check (
  private.can_exam(exam_id,'manage_assets')
  or private.can_session(private.try_uuid(metadata->>'session_id'),'manage_assets')
);
create policy assets_delete on public.exam_assets for delete to authenticated
using (
  private.can_exam(exam_id,'manage_assets')
  or private.can_session(private.try_uuid(metadata->>'session_id'),'manage_assets')
);

-- LIVE and result tables are session-scoped.
drop policy if exists attempts_select on public.exam_attempts;
create policy attempts_select on public.exam_attempts for select to authenticated
using (
  private.can_room(room_id)
  or private.can_session(session_id,'manage_live')
  or private.can_session(session_id,'view_results')
);

drop policy if exists attempts_update_live on public.exam_attempts;
create policy attempts_update_live on public.exam_attempts for update to authenticated
using (private.can_room(room_id) or private.can_session(session_id,'manage_live'))
with check (private.can_room(room_id) or private.can_session(session_id,'manage_live'));

drop policy if exists attempt_questions_results on public.attempt_questions;
create policy attempt_questions_results on public.attempt_questions for select to authenticated
using (exists(
  select 1 from public.exam_attempts a
  where a.id=attempt_id and (
    private.can_session(a.session_id,'view_results')
    or private.can_session(a.session_id,'manage_paper')
  )
));

drop policy if exists attempt_answers_results on public.attempt_answers;
create policy attempt_answers_results on public.attempt_answers for select to authenticated
using (exists(
  select 1 from public.attempt_questions aq
  join public.exam_attempts a on a.id=aq.attempt_id
  where aq.id=attempt_question_id and private.can_session(a.session_id,'view_results')
));

drop policy if exists attempt_events_live on public.attempt_events;
create policy attempt_events_live on public.attempt_events for select to authenticated
using (exists(
  select 1 from public.exam_attempts a
  where a.id=attempt_id and (
    private.can_room(a.room_id)
    or private.can_session(a.session_id,'manage_live')
  )
));

-- Private Storage: old exam-wide paths still require exam-wide manage_assets;
-- new session paths can be used by temporary authors in their assigned session.
drop policy if exists exam_files_select on storage.objects;
create policy exam_files_select on storage.objects for select to authenticated
using (
  bucket_id='exam-files'
  and (
    private.can_exam(private.storage_exam_id(name),'manage_assets')
    or private.can_session(private.storage_session_id(name),'manage_assets')
  )
);

drop policy if exists exam_files_insert on storage.objects;
create policy exam_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id='exam-files'
  and (
    private.can_exam(private.storage_exam_id(name),'manage_assets')
    or private.can_session(private.storage_session_id(name),'manage_assets')
  )
);

drop policy if exists exam_files_update on storage.objects;
create policy exam_files_update on storage.objects for update to authenticated
using (
  bucket_id='exam-files'
  and (
    private.can_exam(private.storage_exam_id(name),'manage_assets')
    or private.can_session(private.storage_session_id(name),'manage_assets')
  )
)
with check (
  bucket_id='exam-files'
  and (
    private.can_exam(private.storage_exam_id(name),'manage_assets')
    or private.can_session(private.storage_session_id(name),'manage_assets')
  )
);

drop policy if exists exam_files_delete on storage.objects;
create policy exam_files_delete on storage.objects for delete to authenticated
using (
  bucket_id='exam-files'
  and (
    private.can_exam(private.storage_exam_id(name),'manage_assets')
    or private.can_session(private.storage_session_id(name),'manage_assets')
  )
);

-- Convert legacy teacher managers on active exams to the new temporary model,
-- preserving access to every existing session of that exam but removing system-wide
-- exam management/member-management authority.
with teacher_members as (
  select m.id,m.exam_id,e.exam_type
  from public.exam_members m
  join public.profiles p on p.id=m.user_id
  join public.exams e on e.id=m.exam_id
  where p.system_role='teacher' and e.status in ('draft','ready','live')
), rebuilt as (
  select tm.id,
    array_prepend(
      'view_exam',
      coalesce(array_agg(distinct (perm || '@' || s.id::text)) filter (where s.id is not null),'{}'::text[])
    ) as permissions
  from teacher_members tm
  left join public.exam_sessions s on s.exam_id=tm.exam_id
  left join lateral unnest(
    case when tm.exam_type='midterm' then array['manage_sessions','manage_roster','manage_paper','manage_live','view_results','export_results','view_correct_answers','manage_assets']::text[]
         else array['manage_paper','view_results','export_results','view_correct_answers','manage_assets']::text[] end
  ) perm on true
  group by tm.id
)
update public.exam_members m
set exam_role='author',permissions=r.permissions
from rebuilt r
where m.id=r.id;

insert into public.exam_room_staff(room_id,user_id,can_lock,can_reopen,can_transfer_device)
select r.id,m.user_id,true,true,true
from public.exam_members m
join public.profiles p on p.id=m.user_id and p.system_role='teacher'
join public.exams e on e.id=m.exam_id and e.exam_type='midterm' and e.status in ('draft','ready','live')
join public.exam_sessions s on s.exam_id=e.id
join public.exam_rooms r on r.session_id=s.id
on conflict (room_id,user_id) do nothing;
