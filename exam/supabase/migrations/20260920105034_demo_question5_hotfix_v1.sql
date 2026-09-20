do $$
declare
  v_exam uuid; v_session uuid; v_admin uuid; v_paper uuid; v_old_pv uuid; v_new_pv uuid;
  v_q uuid; v_new_qv uuid;
begin
  select id into v_exam from public.exams where code='DEMO-EXAM-001';
  select id into v_session from public.exam_sessions where exam_id=v_exam and name='Ca Demo 01';
  select id,created_by into v_paper,v_admin from public.exam_papers where session_id=v_session;
  select id into v_old_pv from public.exam_paper_versions where paper_id=v_paper and version_no=1;
  select id into v_q from public.questions where paper_id=v_paper and code='DEMO-Q05';

  select id into v_new_qv from public.question_versions where question_id=v_q and version_no=2;
  if v_new_qv is null then
    insert into public.question_versions(question_id,version_no,body_html,choices,correct_key,points,metadata,created_by)
    select question_id,2,'<p>Nếu <strong>f″(x) &gt; 0</strong> trên một khoảng thì f:</p>',choices,'C',points,metadata,v_admin
    from public.question_versions where question_id=v_q and version_no=1
    returning id into v_new_qv;
  end if;

  select id into v_new_pv from public.exam_paper_versions where paper_id=v_paper and version_no=2;
  if v_new_pv is null then
    insert into public.exam_paper_versions(paper_id,version_no,status,change_note,created_by)
    values(v_paper,2,'hotfix','Sửa nội dung DEMO-Q05: f″(x) > 0',v_admin)
    returning id into v_new_pv;
    insert into public.paper_version_questions(paper_version_id,question_id,question_version_id,group_version_id,order_no)
    select v_new_pv,pvq.question_id,case when pvq.question_id=v_q then v_new_qv else pvq.question_version_id end,pvq.group_version_id,pvq.order_no
    from public.paper_version_questions pvq where pvq.paper_version_id=v_old_pv;
  end if;

  insert into public.audit_logs(actor_user_id,exam_id,action,entity_type,entity_id,payload)
  values(v_admin,v_exam,'demo_hotfix_seed','question',v_q,jsonb_build_object('newQuestionVersionId',v_new_qv,'newPaperVersionId',v_new_pv,'reason','Correct DEMO-Q05 content without overwriting delivered snapshot'));
end $$;