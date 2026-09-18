-- AI-CLO Aptis Lab V1 permission refinement + suggestions
-- Production migration name: aptis_lab_v1_permissions_and_suggestions

drop policy if exists aptis_questions_editor_all on public.aptis_questions;
drop policy if exists aptis_questions_editor_select on public.aptis_questions;
drop policy if exists aptis_questions_editor_insert on public.aptis_questions;
drop policy if exists aptis_questions_editor_update on public.aptis_questions;
drop policy if exists aptis_questions_admin_delete on public.aptis_questions;
create policy aptis_questions_editor_select on public.aptis_questions for select to authenticated using(public.aptis_is_content_editor());
create policy aptis_questions_editor_insert on public.aptis_questions for insert to authenticated with check(public.aptis_is_content_editor());
create policy aptis_questions_editor_update on public.aptis_questions for update to authenticated using(public.aptis_is_content_editor()) with check(public.aptis_is_content_editor());
create policy aptis_questions_admin_delete on public.aptis_questions for delete to authenticated using(public.aptis_is_admin());

create table if not exists public.aptis_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'content' check(kind in ('content','question_feedback','feature')),
  message text not null check(char_length(trim(message)) between 3 and 5000),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check(status in ('new','reviewing','accepted','declined','done')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists aptis_suggestions_status_idx on public.aptis_suggestions(status,created_at desc);
alter table public.aptis_suggestions enable row level security;
drop policy if exists aptis_suggestions_own_select on public.aptis_suggestions;
drop policy if exists aptis_suggestions_own_insert on public.aptis_suggestions;
drop policy if exists aptis_suggestions_editor_select on public.aptis_suggestions;
drop policy if exists aptis_suggestions_editor_update on public.aptis_suggestions;
create policy aptis_suggestions_own_select on public.aptis_suggestions for select to authenticated using(user_id=auth.uid() and public.aptis_has_access());
create policy aptis_suggestions_own_insert on public.aptis_suggestions for insert to authenticated with check(user_id=auth.uid() and public.aptis_has_access());
create policy aptis_suggestions_editor_select on public.aptis_suggestions for select to authenticated using(public.aptis_is_content_editor());
create policy aptis_suggestions_editor_update on public.aptis_suggestions for update to authenticated using(public.aptis_is_content_editor()) with check(public.aptis_is_content_editor());
grant select,insert,update on public.aptis_suggestions to authenticated;
revoke all on public.aptis_suggestions from anon;
