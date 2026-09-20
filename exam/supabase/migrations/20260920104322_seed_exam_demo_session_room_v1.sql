do $$
declare
  v_exam uuid;
  v_session uuid;
begin
  select id into v_exam from public.exams where code='DEMO-EXAM-001' limit 1;
  if v_exam is null then raise exception 'Demo exam not found'; end if;

  select id into v_session from public.exam_sessions where exam_id=v_exam and name='Ca Demo 01' limit 1;
  if v_session is null then
    insert into public.exam_sessions(exam_id,name,starts_at,ends_at,duration_minutes,status,instructions_html)
    values(v_exam,'Ca Demo 01',now()-interval '5 minutes',now()+interval '2 hours',60,'draft','<p>Ca thi dùng để kiểm thử E2E hệ thống AI-CLO EXAM.</p>')
    returning id into v_session;
  end if;

  insert into public.exam_rooms(session_id,name,capacity,location_note)
  select v_session,'P.DEMO-01',30,'Phòng kiểm thử E2E'
  where not exists(select 1 from public.exam_rooms where session_id=v_session and name='P.DEMO-01');
end $$;
