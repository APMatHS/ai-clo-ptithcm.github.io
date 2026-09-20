do $$
declare v_exam uuid; v_session uuid;
begin
  select id into v_exam from public.exams where code='DEMO-EXAM-001';
  select id into v_session from public.exam_sessions where exam_id=v_exam and name='Ca Demo 01';
  update public.exam_sessions set starts_at=now()-interval '5 minutes', ends_at=now()+interval '120 minutes', duration_minutes=60, status='ready' where id=v_session;
  update public.exams set status='ready' where id=v_exam;
end $$;