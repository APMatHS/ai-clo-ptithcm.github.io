-- Remove remaining anonymous access to SECURITY DEFINER helpers.
-- All public-table RLS policies in this project target authenticated users.

-- RLS helper functions are needed only by authenticated policies.
revoke execute on function public.can_teacher_view_student(uuid) from public, anon;
grant execute on function public.can_teacher_view_student(uuid) to authenticated;

revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.is_subject_student(uuid) from public, anon;
grant execute on function public.is_subject_student(uuid) to authenticated;

revoke execute on function public.is_subject_teacher(uuid) from public, anon;
grant execute on function public.is_subject_teacher(uuid) to authenticated;

revoke execute on function public.question_subject_id(uuid) from public, anon;
grant execute on function public.question_subject_id(uuid) to authenticated;

-- Trigger/event-trigger helpers are never client RPC endpoints.
revoke execute on function public.guard_exam_blueprint_update()
  from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
