do $$ declare v_exam uuid; begin
  select id into v_exam from public.exams where code='DEMO-EXAM-001';
  update public.exam_sessions set status='closed' where exam_id=v_exam and name='Ca Demo 01';
  update public.exams set status='closed', retention_until=coalesce(retention_until,now()+retention_days*interval '1 day') where id=v_exam;
end $$;