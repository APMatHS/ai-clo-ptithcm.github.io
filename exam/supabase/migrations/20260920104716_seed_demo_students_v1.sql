do $$
declare
  v_exam uuid;
  v_session uuid;
  v_room uuid;
  v_student uuid;
begin
  select id into v_exam from public.exams where code='DEMO-EXAM-001';
  select s.id into v_session from public.exam_sessions s where s.exam_id=v_exam and s.name='Ca Demo 01';
  select r.id into v_room from public.exam_rooms r where r.session_id=v_session and r.name='P.DEMO-01';
  if v_exam is null or v_session is null or v_room is null then raise exception 'Demo exam/session/room missing'; end if;

  insert into public.exam_students(exam_id,session_id,room_id,student_code,full_name,class_name)
  values(v_exam,v_session,v_room,'DEMO-SV001','Sinh viên Demo 01','DEMO-A')
  on conflict(exam_id,student_code) do update set session_id=excluded.session_id,room_id=excluded.room_id,full_name=excluded.full_name,class_name=excluded.class_name,active=true,locked=false,locked_reason=null
  returning id into v_student;
  insert into public.exam_student_codes(exam_student_id,code_hash,code_version)
  values(v_student,'e27955ecf19d5c58ff1f9f11a414e878285170e6f24b95233cb09bdcb611095e',1)
  on conflict(exam_student_id) do update set code_hash=excluded.code_hash,code_version=excluded.code_version,code_issued_at=now();

  insert into public.exam_students(exam_id,session_id,room_id,student_code,full_name,class_name)
  values(v_exam,v_session,v_room,'DEMO-SV002','Sinh viên Demo 02','DEMO-A')
  on conflict(exam_id,student_code) do update set session_id=excluded.session_id,room_id=excluded.room_id,full_name=excluded.full_name,class_name=excluded.class_name,active=true,locked=false,locked_reason=null
  returning id into v_student;
  insert into public.exam_student_codes(exam_student_id,code_hash,code_version)
  values(v_student,'b1521779972149e947d3315c13a857cbe05d6ed86b8b14d553045a0adde676f3',1)
  on conflict(exam_student_id) do update set code_hash=excluded.code_hash,code_version=excluded.code_version,code_issued_at=now();

  insert into public.exam_students(exam_id,session_id,room_id,student_code,full_name,class_name)
  values(v_exam,v_session,v_room,'DEMO-SV003','Sinh viên Demo 03','DEMO-B')
  on conflict(exam_id,student_code) do update set session_id=excluded.session_id,room_id=excluded.room_id,full_name=excluded.full_name,class_name=excluded.class_name,active=true,locked=false,locked_reason=null
  returning id into v_student;
  insert into public.exam_student_codes(exam_student_id,code_hash,code_version)
  values(v_student,'c8d1749ede6134a406efe804ba8e45480b5b812282d3a5a16b3fe29adacd8297',1)
  on conflict(exam_student_id) do update set code_hash=excluded.code_hash,code_version=excluded.code_version,code_issued_at=now();
end $$;