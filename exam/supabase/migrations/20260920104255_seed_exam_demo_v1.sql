do $$
declare
  v_admin uuid;
  v_exam uuid;
begin
  select id into v_admin from public.profiles where system_role='admin' and active=true order by created_at asc limit 1;
  if v_admin is null then raise exception 'No active admin profile found'; end if;

  select id into v_exam from public.exams where code='DEMO-EXAM-001' limit 1;
  if v_exam is null then
    insert into public.exams(code,name,subject_group,subject_name,exam_type,academic_year,semester,status,score_visibility,retention_days,created_by)
    values('DEMO-EXAM-001','Kỳ thi Demo - Giải tích 1','math','Giải tích 1','midterm','2026-2027','1','draft','hidden',30,v_admin)
    returning id into v_exam;
  end if;

  insert into public.exam_members(exam_id,user_id,exam_role,permissions)
  select v_exam,v_admin,'owner',array[]::text[]
  where not exists(select 1 from public.exam_members where exam_id=v_exam and user_id=v_admin);
end $$;
