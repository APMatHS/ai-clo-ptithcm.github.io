do $$
declare
  v_exam uuid;
  v_session uuid;
  v_admin uuid;
  v_paper uuid;
  v_pv uuid;
  v_q uuid;
  v_qv uuid;
begin
  select id into v_exam from public.exams where code='DEMO-EXAM-001';
  if v_exam is null then raise exception 'Demo exam missing'; end if;
  select s.id into v_session from public.exam_sessions s where s.exam_id=v_exam and s.name='Ca Demo 01';
  select p.id into v_admin from public.profiles p where p.system_role='admin' and p.active order by p.created_at limit 1;
  if v_session is null or v_admin is null then raise exception 'Demo session/admin missing'; end if;

  select id into v_paper from public.exam_papers where session_id=v_session;
  if v_paper is null then
    insert into public.exam_papers(session_id,title,structure_mode,shuffle_questions,shuffle_choices,created_by)
    values(v_session,'Đề Demo Giải tích 1','generic',true,true,v_admin)
    returning id into v_paper;
  end if;

  select id into v_pv from public.exam_paper_versions where paper_id=v_paper and version_no=1;
  if v_pv is null then
    insert into public.exam_paper_versions(paper_id,version_no,status,change_note,created_by)
    values(v_paper,1,'locked','Đề kiểm thử E2E ban đầu',v_admin)
    returning id into v_pv;
  else
    update public.exam_paper_versions set status='locked',change_note='Đề kiểm thử E2E ban đầu' where id=v_pv;
  end if;

  if not exists(select 1 from public.paper_version_questions where paper_version_id=v_pv) then
    insert into public.questions(paper_id,code) values(v_paper,'DEMO-Q01') returning id into v_q;
    insert into public.question_versions(question_id,version_no,body_html,choices,correct_key,points,metadata,created_by)
    values(v_q,1,'<p>Tính giới hạn <strong>lim x→0</strong> của <em>sin x / x</em>.</p>','[{"key":"A","text":"0"},{"key":"B","text":"1"},{"key":"C","text":"-1"},{"key":"D","text":"Không tồn tại"}]'::jsonb,'B',2,'{}'::jsonb,v_admin)
    returning id into v_qv;
    insert into public.paper_version_questions(paper_version_id,question_id,question_version_id,order_no) values(v_pv,v_q,v_qv,1);

    insert into public.questions(paper_id,code) values(v_paper,'DEMO-Q02') returning id into v_q;
    insert into public.question_versions(question_id,version_no,body_html,choices,correct_key,points,metadata,created_by)
    values(v_q,1,'<p>Đạo hàm của <strong>x²</strong> là:</p>','[{"key":"A","text":"x"},{"key":"B","text":"2x"},{"key":"C","text":"x²"},{"key":"D","text":"2"}]'::jsonb,'B',2,'{}'::jsonb,v_admin)
    returning id into v_qv;
    insert into public.paper_version_questions(paper_version_id,question_id,question_version_id,order_no) values(v_pv,v_q,v_qv,2);

    insert into public.questions(paper_id,code) values(v_paper,'DEMO-Q03') returning id into v_q;
    insert into public.question_versions(question_id,version_no,body_html,choices,correct_key,points,metadata,created_by)
    values(v_q,1,'<p>Nguyên hàm của <strong>2x</strong> là:</p>','[{"key":"A","text":"x² + C"},{"key":"B","text":"2x² + C"},{"key":"C","text":"x + C"},{"key":"D","text":"2 + C"}]'::jsonb,'A',2,'{}'::jsonb,v_admin)
    returning id into v_qv;
    insert into public.paper_version_questions(paper_version_id,question_id,question_version_id,order_no) values(v_pv,v_q,v_qv,3);

    insert into public.questions(paper_id,code) values(v_paper,'DEMO-Q04') returning id into v_q;
    insert into public.question_versions(question_id,version_no,body_html,choices,correct_key,points,metadata,created_by)
    values(v_q,1,'<p>Hàm số <strong>eˣ</strong> có đạo hàm bằng:</p>','[{"key":"A","text":"xe^(x-1)"},{"key":"B","text":"eˣ"},{"key":"C","text":"1/eˣ"},{"key":"D","text":"ln x"}]'::jsonb,'B',2,'{}'::jsonb,v_admin)
    returning id into v_qv;
    insert into public.paper_version_questions(paper_version_id,question_id,question_version_id,order_no) values(v_pv,v_q,v_qv,4);

    insert into public.questions(paper_id,code) values(v_paper,'DEMO-Q05') returning id into v_q;
    insert into public.question_versions(question_id,version_no,body_html,choices,correct_key,points,metadata,created_by)
    values(v_q,1,'<p>Nếu <strong>f''(x) &gt; 0</strong> trên một khoảng thì f:</p>','[{"key":"A","text":"Luôn giảm"},{"key":"B","text":"Luôn tăng"},{"key":"C","text":"Lồi trên khoảng đó"},{"key":"D","text":"Không liên tục"}]'::jsonb,'C',2,'{}'::jsonb,v_admin)
    returning id into v_qv;
    insert into public.paper_version_questions(paper_version_id,question_id,question_version_id,order_no) values(v_pv,v_q,v_qv,5);
  end if;
end $$;