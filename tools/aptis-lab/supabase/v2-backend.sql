-- AI-CLO Aptis Lab V2 backend patch
-- Apply only to the intended production project after review.
-- This file is intentionally kept outside canonical migration history until production Supabase is connected.

create table if not exists public.aptis_ai_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null references public.aptis_attempts(id) on delete cascade,
  question_id uuid not null references public.aptis_questions(id) on delete cascade,
  assessment_type text not null check (assessment_type in ('speaking','writing')),
  status text not null default 'completed' check (status in ('completed','insufficient_evidence','failed')),
  estimated_level text,
  total_score numeric(5,2),
  rubric jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, attempt_id, question_id, assessment_type)
);

create index if not exists aptis_ai_assessments_user_idx
  on public.aptis_ai_assessments(user_id, created_at desc);

alter table public.aptis_ai_assessments enable row level security;

revoke all on table public.aptis_ai_assessments from anon;
revoke insert, update, delete on table public.aptis_ai_assessments from authenticated;
grant select on table public.aptis_ai_assessments to authenticated;

drop policy if exists aptis_ai_assessments_select_own on public.aptis_ai_assessments;
create policy aptis_ai_assessments_select_own
on public.aptis_ai_assessments
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and public.aptis_has_access()
);

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
    and a.user_id = auth.uid()
    and i.answered_at is not null
    and i.answered_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
    and i.is_correct is not null
  group by q.skill, q.part, q.topic
  order by q.skill, accuracy_percent asc nulls last, answered_count desc, q.part, q.topic;
$$;

revoke all on function public.aptis_progress_breakdown_v2(integer) from public;
revoke all on function public.aptis_progress_breakdown_v2(integer) from anon;
grant execute on function public.aptis_progress_breakdown_v2(integer) to authenticated;

comment on table public.aptis_ai_assessments is
  'Cached AI feedback for Aptis Speaking/Writing. Learners can only read their own rows; Edge Functions write via service role.';

comment on function public.aptis_progress_breakdown_v2(integer) is
  'Returns the current learner own objective-question accuracy grouped by skill/part/topic without exposing question answers.';
