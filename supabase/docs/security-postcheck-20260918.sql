-- AI-CLO security post-check - 2026-09-18
-- Read-only checks. Safe to run after applying the three migrations.

-- A. No student INSERT/UPDATE policies should remain on grading tables.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('exam_attempts', 'attempt_draft_answers', 'student_answers')
order by tablename, policyname;

-- Expected:
-- attempt_draft_answers: SELECT only
-- exam_attempts: SELECT + staff UPDATE
-- student_answers: SELECT only

-- B. Sensitive assessment functions must not be executable by anon.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'start_exam_attempt',
    'save_exam_progress',
    'submit_exam_attempt',
    'finalize_exam_attempt',
    'get_attempt_result',
    'get_exam_attempt_payload',
    'populate_attempt_questions'
  )
order by p.proname;

-- Expected: anon_exec=false, auth_exec=true for all rows.

-- C. Profile guard trigger must exist.
select tgname
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal
order by tgname;

-- D. Check stored scores against server-generated answer rows.
with calc as (
  select ea.id,
         ea.score as stored_score,
         round(
           count(*) filter (where sa.is_correct) * 10.0 / nullif(count(*), 0),
           2
         ) as computed_score
  from public.exam_attempts ea
  join public.student_answers sa on sa.attempt_id = ea.id
  where ea.submitted_at is not null
  group by ea.id, ea.score
)
select count(*) as submitted_attempts_checked,
       count(*) filter (
         where stored_score is distinct from computed_score
       ) as score_mismatches
from calc;
