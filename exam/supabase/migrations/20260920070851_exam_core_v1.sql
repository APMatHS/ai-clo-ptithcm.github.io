create extension if not exists pgcrypto;

create schema if not exists private;

create type public.staff_role as enum ('admin','exam_officer','teacher','proctor');
create type public.exam_type as enum ('midterm','final','other');
create type public.exam_status as enum ('draft','ready','live','closed','archived');
create type public.exam_member_role as enum ('owner','manager','author','proctor','viewer');
create type public.session_status as enum ('draft','ready','live','closed');
create type public.paper_status as enum ('draft','locked','hotfix','retired');
create type public.attempt_status as enum ('ready','in_progress','locked','submitted','expired','reset');
create type public.score_visibility as enum ('hidden','immediate','after_close');
create type public.subject_group as enum ('math','physics','philosophy','english','other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  system_role public.staff_role not null default 'teacher',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  subject_group public.subject_group not null default 'other',
  subject_name text not null,
  exam_type public.exam_type not null default 'midterm',
  academic_year text,
  semester text,
  status public.exam_status not null default 'draft',
  score_visibility public.score_visibility not null default 'hidden',
  retention_days integer not null default 30 check (retention_days between 1 and 3650),
  retention_until timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exam_members (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_role public.exam_member_role not null default 'viewer',
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(exam_id,user_id)
);

create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 600),
  status public.session_status not null default 'draft',
  instructions_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.exam_rooms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  name text not null,
  capacity integer check (capacity is null or capacity > 0),
  location_note text,
  created_at timestamptz not null default now(),
  unique(session_id,name)
);

create table public.exam_room_staff (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.exam_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_lock boolean not null default true,
  can_reopen boolean not null default true,
  can_transfer_device boolean not null default true,
  created_at timestamptz not null default now(),
  unique(room_id,user_id)
);

create table public.exam_students (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  room_id uuid not null references public.exam_rooms(id) on delete restrict,
  student_code text not null,
  full_name text not null,
  class_name text,
  active boolean not null default true,
  locked boolean not null default false,
  locked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(exam_id,student_code)
);

create table public.exam_student_codes (
  exam_student_id uuid primary key references public.exam_students(id) on delete cascade,
  code_hash text not null,
  code_issued_at timestamptz not null default now(),
  code_version integer not null default 1
);

create table public.exam_papers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id) on delete cascade,
  title text not null,
  structure_mode text not null default 'generic' check (structure_mode in ('generic','english')),
  shuffle_questions boolean not null default true,
  shuffle_choices boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.exam_paper_versions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.exam_papers(id) on delete cascade,
  version_no integer not null,
  status public.paper_status not null default 'draft',
  change_note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(paper_id,version_no)
);

create table public.question_groups (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.exam_papers(id) on delete cascade,
  code text,
  group_type text not null default 'single' check (group_type in ('single','passage','listening','image','part')),
  shuffle_policy text not null default 'fixed' check (shuffle_policy in ('fixed','within_group')),
  created_at timestamptz not null default now()
);

create table public.question_group_versions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.question_groups(id) on delete cascade,
  version_no integer not null,
  part_label text,
  title text,
  body_html text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(group_id,version_no)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.exam_papers(id) on delete cascade,
  group_id uuid references public.question_groups(id) on delete set null,
  code text,
  created_at timestamptz not null default now()
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version_no integer not null,
  body_html text not null,
  choices jsonb not null,
  correct_key text not null,
  points numeric(8,3) not null default 1 check (points >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(question_id,version_no),
  check (jsonb_typeof(choices) = 'array')
);

create table public.paper_version_questions (
  id uuid primary key default gen_random_uuid(),
  paper_version_id uuid not null references public.exam_paper_versions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  group_version_id uuid references public.question_group_versions(id) on delete restrict,
  order_no integer not null,
  created_at timestamptz not null default now(),
  unique(paper_version_id,question_id),
  unique(paper_version_id,order_no)
);

create table public.exam_assets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  provider text not null default 'supabase' check (provider in ('supabase','r2')),
  bucket text not null,
  object_path text not null,
  kind text not null check (kind in ('source','image','audio','archive','other')),
  mime_type text,
  size_bytes bigint,
  sha256 text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(provider,bucket,object_path)
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_student_id uuid not null references public.exam_students(id) on delete restrict,
  session_id uuid not null references public.exam_sessions(id) on delete restrict,
  room_id uuid not null references public.exam_rooms(id) on delete restrict,
  paper_version_id uuid not null references public.exam_paper_versions(id) on delete restrict,
  status public.attempt_status not null default 'ready',
  started_at timestamptz,
  deadline_at timestamptz,
  submitted_at timestamptz,
  locked_at timestamptz,
  locked_reason text,
  score numeric(8,3),
  correct_count integer,
  answered_count integer not null default 0,
  last_saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_active_attempt_per_student on public.exam_attempts(exam_student_id)
  where status in ('ready','in_progress','locked','submitted','expired');

create table public.attempt_sessions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  token_hash text not null unique,
  device_id text,
  user_agent text,
  issued_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  group_version_id uuid references public.question_group_versions(id) on delete restrict,
  display_no integer not null,
  choice_order jsonb not null,
  first_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(attempt_id,question_id),
  unique(attempt_id,display_no),
  check (jsonb_typeof(choice_order) = 'array')
);

create table public.attempt_answers (
  attempt_question_id uuid primary key references public.attempt_questions(id) on delete cascade,
  selected_key text,
  client_seq integer not null default 0,
  saved_at timestamptz not null default now()
);

create table public.attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  exam_id uuid references public.exams(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index exam_members_user_idx on public.exam_members(user_id,exam_id);
create index exam_sessions_exam_idx on public.exam_sessions(exam_id,starts_at);
create index exam_rooms_session_idx on public.exam_rooms(session_id);
create index exam_room_staff_user_idx on public.exam_room_staff(user_id,room_id);
create index exam_students_session_idx on public.exam_students(session_id,room_id);
create index exam_students_code_idx on public.exam_students(student_code);
create index paper_versions_paper_idx on public.exam_paper_versions(paper_id,version_no desc);
create index questions_paper_idx on public.questions(paper_id,group_id);
create index paper_version_questions_idx on public.paper_version_questions(paper_version_id,order_no);
create index attempts_room_idx on public.exam_attempts(room_id,status);
create index attempts_student_idx on public.exam_attempts(exam_student_id,created_at desc);
create index attempt_events_attempt_idx on public.attempt_events(attempt_id,created_at desc);
create index audit_exam_idx on public.audit_logs(exam_id,created_at desc);

create or replace function private.is_active_staff()
returns boolean language sql stable security definer set search_path = public,auth as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.active);
$$;
create or replace function private.is_system_admin()
returns boolean language sql stable security definer set search_path = public,auth as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.active and p.system_role='admin');
$$;
create or replace function private.can_exam(p_exam_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public,auth as $$
  select private.is_system_admin() or exists(
    select 1 from public.exam_members m
    join public.profiles p on p.id=m.user_id and p.active
    where m.exam_id=p_exam_id and m.user_id=auth.uid()
      and (m.exam_role='owner' or p_permission = any(m.permissions))
  );
$$;
create or replace function private.can_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public,auth as $$
  select private.is_system_admin() or exists(
    select 1 from public.exam_room_staff rs
    join public.profiles p on p.id=rs.user_id and p.active
    where rs.room_id=p_room_id and rs.user_id=auth.uid()
  ) or exists(
    select 1 from public.exam_rooms r
    join public.exam_sessions s on s.id=r.session_id
    where r.id=p_room_id and private.can_exam(s.exam_id,'manage_live')
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
revoke all on function private.is_active_staff() from public;
revoke all on function private.is_system_admin() from public;
revoke all on function private.can_exam(uuid,text) from public;
revoke all on function private.can_room(uuid) from public;
grant execute on function private.is_active_staff() to authenticated, service_role;
grant execute on function private.is_system_admin() to authenticated, service_role;
grant execute on function private.can_exam(uuid,text) to authenticated, service_role;
grant execute on function private.can_room(uuid) to authenticated, service_role;

create or replace function public.handle_new_staff_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name,system_role,active)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'teacher',false)
  on conflict (id) do nothing;
  return new;
end; $$;
revoke all on function public.handle_new_staff_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_exam on auth.users;
create trigger on_auth_user_created_exam after insert on auth.users
for each row execute function public.handle_new_staff_profile();

create or replace function public.handle_exam_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.exam_members(exam_id,user_id,exam_role,permissions)
  values(new.id,new.created_by,'owner',array['manage_exam','manage_members','manage_sessions','manage_roster','manage_paper','manage_live','view_results','export_results','view_correct_answers','manage_assets'])
  on conflict (exam_id,user_id) do nothing;
  return new;
end; $$;
revoke all on function public.handle_exam_owner() from public, anon, authenticated;
drop trigger if exists on_exam_created_owner on public.exams;
create trigger on_exam_created_owner after insert on public.exams
for each row execute function public.handle_exam_owner();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end; $$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_exams before update on public.exams for each row execute function public.touch_updated_at();
create trigger touch_exam_sessions before update on public.exam_sessions for each row execute function public.touch_updated_at();
create trigger touch_exam_students before update on public.exam_students for each row execute function public.touch_updated_at();
create trigger touch_attempts before update on public.exam_attempts for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.exam_members enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_rooms enable row level security;
alter table public.exam_room_staff enable row level security;
alter table public.exam_students enable row level security;
alter table public.exam_student_codes enable row level security;
alter table public.exam_papers enable row level security;
alter table public.exam_paper_versions enable row level security;
alter table public.question_groups enable row level security;
alter table public.question_group_versions enable row level security;
alter table public.questions enable row level security;
alter table public.question_versions enable row level security;
alter table public.paper_version_questions enable row level security;
alter table public.exam_assets enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.attempt_sessions enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.attempt_events enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_staff on public.profiles for select to authenticated using (private.is_active_staff());
create policy profiles_update_admin on public.profiles for update to authenticated using (private.is_system_admin()) with check (private.is_system_admin());
create policy exams_select on public.exams for select to authenticated using (private.can_exam(id,'view_exam'));
create policy exams_insert on public.exams for insert to authenticated with check (created_by=auth.uid() and private.is_active_staff());
create policy exams_update on public.exams for update to authenticated using (private.can_exam(id,'manage_exam')) with check (private.can_exam(id,'manage_exam'));
create policy exam_members_select on public.exam_members for select to authenticated using (private.can_exam(exam_id,'view_exam'));
create policy exam_members_insert on public.exam_members for insert to authenticated with check (private.can_exam(exam_id,'manage_members'));
create policy exam_members_update on public.exam_members for update to authenticated using (private.can_exam(exam_id,'manage_members')) with check (private.can_exam(exam_id,'manage_members'));
create policy exam_members_delete on public.exam_members for delete to authenticated using (private.can_exam(exam_id,'manage_members') and exam_role <> 'owner');
create policy sessions_all_select on public.exam_sessions for select to authenticated using (private.can_exam(exam_id,'view_exam'));
create policy sessions_insert on public.exam_sessions for insert to authenticated with check (private.can_exam(exam_id,'manage_sessions'));
create policy sessions_update on public.exam_sessions for update to authenticated using (private.can_exam(exam_id,'manage_sessions')) with check (private.can_exam(exam_id,'manage_sessions'));
create policy rooms_select on public.exam_rooms for select to authenticated using (private.can_room(id) or exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'view_exam')));
create policy rooms_write on public.exam_rooms for all to authenticated using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions'))) with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_sessions')));
create policy room_staff_select on public.exam_room_staff for select to authenticated using (user_id=auth.uid() or private.can_room(room_id));
create policy room_staff_write on public.exam_room_staff for all to authenticated using (exists(select 1 from public.exam_rooms r join public.exam_sessions s on s.id=r.session_id where r.id=room_id and private.can_exam(s.exam_id,'manage_members'))) with check (exists(select 1 from public.exam_rooms r join public.exam_sessions s on s.id=r.session_id where r.id=room_id and private.can_exam(s.exam_id,'manage_members')));
create policy students_select on public.exam_students for select to authenticated using (private.can_exam(exam_id,'manage_roster') or private.can_room(room_id));
create policy students_write on public.exam_students for all to authenticated using (private.can_exam(exam_id,'manage_roster')) with check (private.can_exam(exam_id,'manage_roster'));
create policy codes_select on public.exam_student_codes for select to authenticated using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster')));
create policy codes_write on public.exam_student_codes for all to authenticated using (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster'))) with check (exists(select 1 from public.exam_students s where s.id=exam_student_id and private.can_exam(s.exam_id,'manage_roster')));
create policy papers_select on public.exam_papers for select to authenticated using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper')));
create policy papers_write on public.exam_papers for all to authenticated using (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper'))) with check (exists(select 1 from public.exam_sessions s where s.id=session_id and private.can_exam(s.exam_id,'manage_paper')));
create policy paper_versions_access on public.exam_paper_versions for all to authenticated using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper'))) with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper')));
create policy groups_access on public.question_groups for all to authenticated using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper'))) with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper')));
create policy group_versions_access on public.question_group_versions for all to authenticated using (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id join public.exam_sessions s on s.id=p.session_id where g.id=group_id and private.can_exam(s.exam_id,'manage_paper'))) with check (exists(select 1 from public.question_groups g join public.exam_papers p on p.id=g.paper_id join public.exam_sessions s on s.id=p.session_id where g.id=group_id and private.can_exam(s.exam_id,'manage_paper')));
create policy questions_access on public.questions for all to authenticated using (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper'))) with check (exists(select 1 from public.exam_papers p join public.exam_sessions s on s.id=p.session_id where p.id=paper_id and private.can_exam(s.exam_id,'manage_paper')));
create policy question_versions_access on public.question_versions for all to authenticated using (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id join public.exam_sessions s on s.id=p.session_id where q.id=question_id and (private.can_exam(s.exam_id,'manage_paper') or private.can_exam(s.exam_id,'view_correct_answers')))) with check (exists(select 1 from public.questions q join public.exam_papers p on p.id=q.paper_id join public.exam_sessions s on s.id=p.session_id where q.id=question_id and private.can_exam(s.exam_id,'manage_paper')));
create policy pvq_access on public.paper_version_questions for all to authenticated using (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id join public.exam_sessions s on s.id=p.session_id where pv.id=paper_version_id and private.can_exam(s.exam_id,'manage_paper'))) with check (exists(select 1 from public.exam_paper_versions pv join public.exam_papers p on p.id=pv.paper_id join public.exam_sessions s on s.id=p.session_id where pv.id=paper_version_id and private.can_exam(s.exam_id,'manage_paper')));
create policy assets_access on public.exam_assets for all to authenticated using (private.can_exam(exam_id,'manage_assets')) with check (private.can_exam(exam_id,'manage_assets'));
create policy attempts_select on public.exam_attempts for select to authenticated using (private.can_room(room_id) or exists(select 1 from public.exam_students st where st.id=exam_student_id and private.can_exam(st.exam_id,'view_results')));
create policy attempts_update_live on public.exam_attempts for update to authenticated using (private.can_room(room_id)) with check (private.can_room(room_id));
create policy attempt_sessions_none on public.attempt_sessions for select to authenticated using (false);
create policy attempt_questions_results on public.attempt_questions for select to authenticated using (exists(select 1 from public.exam_attempts a join public.exam_students st on st.id=a.exam_student_id where a.id=attempt_id and (private.can_exam(st.exam_id,'view_results') or private.can_exam(st.exam_id,'manage_paper'))));
create policy attempt_answers_results on public.attempt_answers for select to authenticated using (exists(select 1 from public.attempt_questions aq join public.exam_attempts a on a.id=aq.attempt_id join public.exam_students st on st.id=a.exam_student_id where aq.id=attempt_question_id and private.can_exam(st.exam_id,'view_results')));
create policy attempt_events_live on public.attempt_events for select to authenticated using (exists(select 1 from public.exam_attempts a where a.id=attempt_id and private.can_room(a.room_id)));
create policy audit_select on public.audit_logs for select to authenticated using (private.is_system_admin() or (exam_id is not null and private.can_exam(exam_id,'manage_exam')));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exam-files','exam-files',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip'])
on conflict (id) do nothing;
