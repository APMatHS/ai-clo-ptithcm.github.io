-- AI-CLO Aptis Lab V2 backend patch
-- Production-compatible patch for project rraooqedkpyhokattwdz.
-- The production database already contains aptis_ai_assessments using
-- attempt_item_id + feature ('speaking'|'writing'), so V2 reuses that table.

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
    and i.answered_at is not null
    and i.answered_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
    and i.is_correct is not null
  group by q.skill, q.part, q.topic
  order by q.skill, accuracy_percent asc nulls last, answered_count desc, q.part, q.topic;
$$;

revoke all on function public.aptis_progress_breakdown_v2(integer) from public;
revoke all on function public.aptis_progress_breakdown_v2(integer) from anon;
grant execute on function public.aptis_progress_breakdown_v2(integer) to authenticated;

comment on function public.aptis_progress_breakdown_v2(integer) is
  'Returns the current Aptis learner own objective-question accuracy grouped by skill/part/topic without exposing question answers.';
