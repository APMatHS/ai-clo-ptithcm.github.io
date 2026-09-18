-- AI-CLO PTITHCM auxiliary security hardening - 2026-09-18

-- Fix mutable search_path warnings on utility functions.
alter function public.set_updated_at()
  set search_path = 'public', 'pg_temp';

alter function public.normalize_question_text(text)
  set search_path = 'public', 'pg_temp';

-- Trigger functions are not API endpoints. Remove direct EXECUTE from client roles.
revoke execute on function public.assign_content_question_bank()
  from public, anon, authenticated;
revoke execute on function public.assign_question_display_code()
  from public, anon, authenticated;
revoke execute on function public.assign_topic_question_bank()
  from public, anon, authenticated;
revoke execute on function public.guard_exam_question_changes()
  from public, anon, authenticated;
revoke execute on function public.guard_exam_structure_update()
  from public, anon, authenticated;
revoke execute on function public.guard_official_question_option()
  from public, anon, authenticated;
revoke execute on function public.guard_question_option_owner()
  from public, anon, authenticated;
revoke execute on function public.guard_question_origin()
  from public, anon, authenticated;
revoke execute on function public.guard_question_owner()
  from public, anon, authenticated;
revoke execute on function public.normalize_final_exam_package()
  from public, anon, authenticated;
revoke execute on function public.normalize_question_legacy_subject()
  from public, anon, authenticated;
revoke execute on function public.touch_last_login_from_log()
  from public, anon, authenticated;

-- Logged-in assessment RPCs must not be anonymously callable.
revoke execute on function public.assessment_schema_version() from public, anon;
grant execute on function public.assessment_schema_version() to authenticated;

revoke execute on function public.get_exam_attempt_count(uuid) from public, anon;
grant execute on function public.get_exam_attempt_count(uuid) to authenticated;

revoke execute on function public.get_exam_live_snapshot(uuid) from public, anon;
grant execute on function public.get_exam_live_snapshot(uuid) to authenticated;

revoke execute on function public.get_exam_monitor_events(uuid) from public, anon;
grant execute on function public.get_exam_monitor_events(uuid) to authenticated;

revoke execute on function public.start_attempt_monitor_event(uuid, text) from public, anon;
grant execute on function public.start_attempt_monitor_event(uuid, text) to authenticated;

revoke execute on function public.finish_attempt_monitor_event(uuid) from public, anon;
grant execute on function public.finish_attempt_monitor_event(uuid) to authenticated;

revoke execute on function public.update_attempt_live_state(
  uuid, integer, jsonb, integer, boolean, boolean
) from public, anon;
grant execute on function public.update_attempt_live_state(
  uuid, integer, jsonb, integer, boolean, boolean
) to authenticated;

revoke execute on function public.replace_exam_design(
  uuid, text, jsonb, uuid[], uuid[], jsonb, integer, jsonb, jsonb
) from public, anon;
grant execute on function public.replace_exam_design(
  uuid, text, jsonb, uuid[], uuid[], jsonb, integer, jsonb, jsonb
) to authenticated;

revoke execute on function public.save_final_exam_package(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, text
) from public, anon;
grant execute on function public.save_final_exam_package(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, text
) to authenticated;
