-- Production migration name: aptis_lab_v1_trigger_privileges
-- Trigger helper must not be directly callable from the Data API.
revoke all on function public.aptis_stamp_question_actor() from public,anon,authenticated;
