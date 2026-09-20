do $$ declare v_exam uuid; begin
  select id into v_exam from public.exams where code='DEMO-EXAM-001';
  update public.exams set status='live' where id=v_exam;
  update public.exam_sessions set status='live' where exam_id=v_exam and name='Ca Demo 01';
end $$;