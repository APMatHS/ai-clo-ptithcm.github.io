-- AI-CLO OLYMPIC V1 permissions and student visibility.
-- Applied to production Supabase on 2026-09-18.

revoke all on public.olympic_subjects from anon;
revoke all on public.olympic_sections from anon;
revoke all on public.olympic_topics from anon;
revoke all on public.olympic_lessons from anon;
revoke all on public.olympic_teacher_subjects from anon;

grant select,insert,update,delete on public.olympic_subjects to authenticated;
grant select,insert,update,delete on public.olympic_sections to authenticated;
grant select,insert,update,delete on public.olympic_topics to authenticated;
grant select,insert,update,delete on public.olympic_lessons to authenticated;
grant select,insert,update,delete on public.olympic_teacher_subjects to authenticated;

grant execute on function public.olympic_is_admin() to authenticated;
grant execute on function public.olympic_can_manage_subject(uuid) to authenticated;

-- Students only see approved/teaching topics. Assigned teachers and Admin can still see drafts.
drop policy if exists olympic_topics_select on public.olympic_topics;
create policy olympic_topics_select on public.olympic_topics
for select to authenticated
using (
  (is_visible and status in ('approved','teaching'))
  or public.olympic_can_manage_subject(subject_id)
);
