-- AI-CLO Aptis Lab: Learning Path V1
-- Applied to production as Supabase migration aptis_learning_path_v1_20260918.
-- Additive only: keeps existing bank and attempt data.

create table if not exists public.aptis_learning_courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  exam_family text not null default 'general' check (exam_family in ('general','advanced')),
  title text not null,
  description text,
  target_level text not null default 'B2' check (target_level in ('B1','B2')),
  position integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aptis_learning_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.aptis_learning_courses(id) on delete cascade,
  code text not null unique,
  title text not null,
  subtitle text,
  description text,
  level_from text not null default 'B1' check (level_from in ('B1','B2')),
  level_to text not null default 'B2' check (level_to in ('B1','B2')),
  position integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, position)
);

create table if not exists public.aptis_learning_lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.aptis_learning_units(id) on delete cascade,
  code text not null unique,
  title text not null,
  lesson_kind text not null default 'guided' check (lesson_kind in ('vocabulary','grammar','reading','listening','speaking','writing','review','guided')),
  skill text check (skill is null or skill in ('grammar','vocabulary','reading','listening','speaking','writing')),
  level text not null default 'B2' check (level in ('B1','B2')),
  objective text,
  intro_text text,
  estimated_minutes integer not null default 15 check (estimated_minutes between 3 and 120),
  practice_spec jsonb not null default '{}'::jsonb,
  position integer not null,
  is_available boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit_id, position)
);

create table if not exists public.aptis_lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.aptis_learning_lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  attempts_count integer not null default 0 check (attempts_count >= 0),
  best_score numeric(5,2),
  last_attempt_id uuid references public.aptis_attempts(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id, lesson_id)
);

create table if not exists public.aptis_learning_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active_attempt_id uuid references public.aptis_attempts(id) on delete set null,
  active_lesson_id uuid references public.aptis_learning_lessons(id) on delete set null,
  practice_tab text not null default 'route' check (practice_tab in ('route','skills','review')),
  question_index integer not null default 0 check (question_index >= 0),
  draft_response jsonb not null default '{}'::jsonb,
  ui_state jsonb not null default '{}'::jsonb,
  scroll_position integer not null default 0 check (scroll_position >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists aptis_units_course_idx on public.aptis_learning_units(course_id, position);
create index if not exists aptis_lessons_unit_idx on public.aptis_learning_lessons(unit_id, position);
create index if not exists aptis_lesson_progress_lesson_idx on public.aptis_lesson_progress(lesson_id);
create index if not exists aptis_lesson_progress_attempt_idx on public.aptis_lesson_progress(last_attempt_id) where last_attempt_id is not null;
create index if not exists aptis_learning_state_attempt_idx on public.aptis_learning_state(active_attempt_id) where active_attempt_id is not null;

alter table public.aptis_learning_courses enable row level security;
alter table public.aptis_learning_units enable row level security;
alter table public.aptis_learning_lessons enable row level security;
alter table public.aptis_lesson_progress enable row level security;
alter table public.aptis_learning_state enable row level security;

drop policy if exists aptis_courses_read on public.aptis_learning_courses;
create policy aptis_courses_read on public.aptis_learning_courses for select to authenticated using (public.aptis_has_access());
drop policy if exists aptis_courses_editor_all on public.aptis_learning_courses;
create policy aptis_courses_editor_all on public.aptis_learning_courses for all to authenticated using (public.aptis_is_content_editor()) with check (public.aptis_is_content_editor());
drop policy if exists aptis_units_read on public.aptis_learning_units;
create policy aptis_units_read on public.aptis_learning_units for select to authenticated using (public.aptis_has_access());
drop policy if exists aptis_units_editor_all on public.aptis_learning_units;
create policy aptis_units_editor_all on public.aptis_learning_units for all to authenticated using (public.aptis_is_content_editor()) with check (public.aptis_is_content_editor());
drop policy if exists aptis_lessons_read on public.aptis_learning_lessons;
create policy aptis_lessons_read on public.aptis_learning_lessons for select to authenticated using (public.aptis_has_access());
drop policy if exists aptis_lessons_editor_all on public.aptis_learning_lessons;
create policy aptis_lessons_editor_all on public.aptis_learning_lessons for all to authenticated using (public.aptis_is_content_editor()) with check (public.aptis_is_content_editor());
drop policy if exists aptis_lesson_progress_own_select on public.aptis_lesson_progress;
create policy aptis_lesson_progress_own_select on public.aptis_lesson_progress for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists aptis_lesson_progress_own_insert on public.aptis_lesson_progress;
create policy aptis_lesson_progress_own_insert on public.aptis_lesson_progress for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists aptis_lesson_progress_own_update on public.aptis_lesson_progress;
create policy aptis_lesson_progress_own_update on public.aptis_lesson_progress for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists aptis_learning_state_own_select on public.aptis_learning_state;
create policy aptis_learning_state_own_select on public.aptis_learning_state for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists aptis_learning_state_own_insert on public.aptis_learning_state;
create policy aptis_learning_state_own_insert on public.aptis_learning_state for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists aptis_learning_state_own_update on public.aptis_learning_state;
create policy aptis_learning_state_own_update on public.aptis_learning_state for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists aptis_learning_state_own_delete on public.aptis_learning_state;
create policy aptis_learning_state_own_delete on public.aptis_learning_state for delete to authenticated using ((select auth.uid())=user_id);

revoke all on public.aptis_learning_courses from anon;
revoke all on public.aptis_learning_units from anon;
revoke all on public.aptis_learning_lessons from anon;
revoke all on public.aptis_lesson_progress from anon;
revoke all on public.aptis_learning_state from anon;
grant select,insert,update,delete on public.aptis_learning_courses to authenticated;
grant select,insert,update,delete on public.aptis_learning_units to authenticated;
grant select,insert,update,delete on public.aptis_learning_lessons to authenticated;
grant select,insert,update on public.aptis_lesson_progress to authenticated;
grant select,insert,update,delete on public.aptis_learning_state to authenticated;

create or replace function public.aptis_get_attempt_resume(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_attempt public.aptis_attempts%rowtype; v_questions jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select a.* into v_attempt from public.aptis_attempts a where a.id=p_attempt_id and a.user_id=v_uid;
  if not found then raise exception 'ATTEMPT_NOT_FOUND' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'skill',q.skill,'part',q.part,'question_type',q.question_type,'level',q.level,'difficulty',q.difficulty,'topic',q.topic,'prompt',q.prompt,'content',q.content,'media',q.media,'position',i.position,
    'response',i.response,'answered',(i.answered_at is not null),'is_correct',i.is_correct,
    'correct_answer',case when i.answered_at is not null and q.question_type not in ('speaking_prompt','writing_prompt') then q.answer else null end,
    'explanation',case when i.answered_at is not null then q.explanation else null end,
    'set',case when s.id is null then null else jsonb_build_object('id',s.id,'title',s.title,'instructions',s.instructions,'body_text',s.body_text,'media',s.media,'transcript',case when i.answered_at is not null then s.transcript else null end) end
  ) order by i.position),'[]'::jsonb) into v_questions
  from public.aptis_attempt_items i join public.aptis_questions q on q.id=i.question_id left join public.aptis_sets s on s.id=q.set_id where i.attempt_id=p_attempt_id;
  return jsonb_build_object('attempt_id',v_attempt.id,'mode',v_attempt.mode,'skill',v_attempt.skill,'target_level',v_attempt.target_level,'metadata',v_attempt.metadata,'question_count',v_attempt.question_count,'answered_count',v_attempt.answered_count,'score_percent',v_attempt.score_percent,'completed_at',v_attempt.completed_at,'questions',v_questions);
end; $$;

create or replace function public.aptis_start_lesson(p_lesson_id uuid,p_limit integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_lesson public.aptis_learning_lessons%rowtype; v_attempt uuid; v_count integer; v_topic text;
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  select l.* into v_lesson from public.aptis_learning_lessons l join public.aptis_learning_units u on u.id=l.unit_id join public.aptis_learning_courses c on c.id=u.course_id where l.id=p_lesson_id and l.is_active=true and l.is_available=true and u.is_active=true and c.is_active=true limit 1;
  if not found then raise exception 'LESSON_NOT_AVAILABLE' using errcode='P0002'; end if;
  if v_lesson.skill is null then raise exception 'LESSON_HAS_NO_PRACTICE_SKILL' using errcode='22023'; end if;
  v_count:=greatest(1,least(coalesce(p_limit,nullif(v_lesson.practice_spec->>'count','')::integer,8),30));
  v_topic:=nullif(v_lesson.practice_spec->>'topic','');
  insert into public.aptis_attempts(user_id,mode,exam_family,skill,target_level,metadata) values(v_uid,'practice','general',v_lesson.skill,v_lesson.level,jsonb_build_object('learning_kind','lesson','lesson_id',v_lesson.id,'lesson_code',v_lesson.code)) returning id into v_attempt;
  with hist as (
    select i.question_id,count(*) filter(where i.answered_at is not null) seen_count,count(*) filter(where i.is_correct=false) wrong_count,max(i.answered_at) last_seen
    from public.aptis_attempt_items i join public.aptis_attempts a on a.id=i.attempt_id where a.user_id=v_uid group by i.question_id
  ),picked as (
    select q.id,row_number() over(order by case when coalesce(h.seen_count,0)=0 then 0 when coalesce(h.wrong_count,0)>0 then 1 else 2 end,case when v_topic is not null and q.topic=v_topic then 0 else 1 end,h.last_seen nulls first,random())::int pos
    from public.aptis_questions q left join hist h on h.question_id=q.id
    where q.exam_family='general' and q.status='published' and q.is_active=true and q.skill=v_lesson.skill and q.level=v_lesson.level
    order by case when coalesce(h.seen_count,0)=0 then 0 when coalesce(h.wrong_count,0)>0 then 1 else 2 end,case when v_topic is not null and q.topic=v_topic then 0 else 1 end,h.last_seen nulls first,random() limit v_count
  ),ins as (
    insert into public.aptis_attempt_items(attempt_id,question_id,position) select v_attempt,p.id,p.pos from picked p returning question_id
  ) select count(*) into v_count from ins;
  update public.aptis_attempts set question_count=v_count where id=v_attempt;
  if v_count=0 then delete from public.aptis_attempts where id=v_attempt; raise exception 'NO_QUESTIONS_FOR_LESSON' using errcode='P0002'; end if;
  insert into public.aptis_lesson_progress(user_id,lesson_id,status,progress_percent,attempts_count,last_attempt_id,started_at,updated_at) values(v_uid,v_lesson.id,'in_progress',0,1,v_attempt,now(),now())
  on conflict(user_id,lesson_id) do update set status=case when public.aptis_lesson_progress.status='completed' then public.aptis_lesson_progress.status else 'in_progress' end,attempts_count=public.aptis_lesson_progress.attempts_count+1,last_attempt_id=excluded.last_attempt_id,started_at=coalesce(public.aptis_lesson_progress.started_at,excluded.started_at),updated_at=now();
  insert into public.aptis_learning_state(user_id,active_attempt_id,active_lesson_id,practice_tab,question_index,draft_response,ui_state,scroll_position,updated_at) values(v_uid,v_attempt,v_lesson.id,'route',0,'{}'::jsonb,jsonb_build_object('lesson_code',v_lesson.code),0,now())
  on conflict(user_id) do update set active_attempt_id=excluded.active_attempt_id,active_lesson_id=excluded.active_lesson_id,practice_tab='route',question_index=0,draft_response='{}'::jsonb,ui_state=excluded.ui_state,scroll_position=0,updated_at=now();
  return public.aptis_get_attempt_resume(v_attempt);
end; $$;

create or replace function public.aptis_draw_review(p_limit integer default 15)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_level text; v_attempt uuid; v_count integer:=greatest(5,least(coalesce(p_limit,15),30));
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  select coalesce(m.target_level,'B2') into v_level from public.aptis_memberships m where m.user_id=v_uid; v_level:=coalesce(v_level,'B2');
  insert into public.aptis_attempts(user_id,mode,exam_family,skill,target_level,metadata) values(v_uid,'daily','general',null,v_level,jsonb_build_object('learning_kind','smart_review')) returning id into v_attempt;
  with hist as (
    select i.question_id,count(*) filter(where i.answered_at is not null) seen_count,count(*) filter(where i.is_correct=false) wrong_count,count(*) filter(where i.is_correct=true) correct_count,max(i.answered_at) last_seen
    from public.aptis_attempt_items i join public.aptis_attempts a on a.id=i.attempt_id where a.user_id=v_uid group by i.question_id
  ),picked as (
    select q.id,row_number() over(order by case when coalesce(h.wrong_count,0)>0 then 0 when coalesce(h.seen_count,0)=0 then 1 else 2 end,h.last_seen nulls first,coalesce(h.correct_count,0),random())::int pos
    from public.aptis_questions q left join hist h on h.question_id=q.id
    where q.exam_family='general' and q.status='published' and q.is_active=true and q.level=v_level and q.question_type not in ('speaking_prompt','writing_prompt')
    order by case when coalesce(h.wrong_count,0)>0 then 0 when coalesce(h.seen_count,0)=0 then 1 else 2 end,h.last_seen nulls first,coalesce(h.correct_count,0),random() limit v_count
  ),ins as (
    insert into public.aptis_attempt_items(attempt_id,question_id,position) select v_attempt,p.id,p.pos from picked p returning question_id
  ) select count(*) into v_count from ins;
  update public.aptis_attempts set question_count=v_count where id=v_attempt;
  if v_count=0 then delete from public.aptis_attempts where id=v_attempt; raise exception 'NO_REVIEW_QUESTIONS' using errcode='P0002'; end if;
  insert into public.aptis_learning_state(user_id,active_attempt_id,active_lesson_id,practice_tab,question_index,draft_response,ui_state,scroll_position,updated_at) values(v_uid,v_attempt,null,'review',0,'{}'::jsonb,'{}'::jsonb,0,now())
  on conflict(user_id) do update set active_attempt_id=excluded.active_attempt_id,active_lesson_id=null,practice_tab='review',question_index=0,draft_response='{}'::jsonb,ui_state='{}'::jsonb,scroll_position=0,updated_at=now();
  return public.aptis_get_attempt_resume(v_attempt);
end; $$;

create or replace function public.aptis_mark_lesson_complete(p_lesson_id uuid,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_score numeric(5,2); v_answered integer; v_total integer;
begin
  if not exists(select 1 from public.aptis_attempts a where a.id=p_attempt_id and a.user_id=v_uid and (a.metadata->>'lesson_id')::uuid=p_lesson_id) then raise exception 'LESSON_ATTEMPT_NOT_FOUND' using errcode='P0002'; end if;
  select a.score_percent,a.answered_count,a.question_count into v_score,v_answered,v_total from public.aptis_attempts a where a.id=p_attempt_id;
  insert into public.aptis_lesson_progress(user_id,lesson_id,status,progress_percent,attempts_count,best_score,last_attempt_id,started_at,completed_at,updated_at) values(v_uid,p_lesson_id,'completed',100,1,v_score,p_attempt_id,now(),now(),now())
  on conflict(user_id,lesson_id) do update set status='completed',progress_percent=100,best_score=case when public.aptis_lesson_progress.best_score is null then excluded.best_score when excluded.best_score is null then public.aptis_lesson_progress.best_score else greatest(public.aptis_lesson_progress.best_score,excluded.best_score) end,last_attempt_id=excluded.last_attempt_id,completed_at=coalesce(public.aptis_lesson_progress.completed_at,now()),updated_at=now();
  update public.aptis_learning_state set active_attempt_id=null,active_lesson_id=null,question_index=0,draft_response='{}'::jsonb,scroll_position=0,updated_at=now() where user_id=v_uid and active_attempt_id=p_attempt_id;
  return jsonb_build_object('lesson_id',p_lesson_id,'status','completed','score_percent',v_score,'answered_count',v_answered,'question_count',v_total);
end; $$;

create or replace function public.aptis_get_learning_path()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_course public.aptis_learning_courses%rowtype; v_units jsonb;
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  select c.* into v_course from public.aptis_learning_courses c where c.exam_family='general' and c.is_active=true order by c.position,c.created_at limit 1;
  if not found then return jsonb_build_object('course',null,'units','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'code',u.code,'title',u.title,'subtitle',u.subtitle,'description',u.description,'level_from',u.level_from,'level_to',u.level_to,'position',u.position,'lessons',(
    select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'code',l.code,'title',l.title,'lesson_kind',l.lesson_kind,'skill',l.skill,'level',l.level,'objective',l.objective,'intro_text',l.intro_text,'estimated_minutes',l.estimated_minutes,'practice_spec',l.practice_spec,'position',l.position,'is_available',l.is_available,'status',coalesce(p.status,'not_started'),'progress_percent',coalesce(p.progress_percent,0),'attempts_count',coalesce(p.attempts_count,0),'best_score',p.best_score,'last_attempt_id',p.last_attempt_id) order by l.position),'[]'::jsonb)
    from public.aptis_learning_lessons l left join public.aptis_lesson_progress p on p.lesson_id=l.id and p.user_id=v_uid where l.unit_id=u.id and l.is_active=true
  )) order by u.position),'[]'::jsonb) into v_units from public.aptis_learning_units u where u.course_id=v_course.id and u.is_active=true;
  return jsonb_build_object('course',jsonb_build_object('id',v_course.id,'code',v_course.code,'title',v_course.title,'description',v_course.description,'target_level',v_course.target_level),'units',v_units);
end; $$;

revoke all on function public.aptis_get_attempt_resume(uuid) from public,anon;
revoke all on function public.aptis_start_lesson(uuid,integer) from public,anon;
revoke all on function public.aptis_draw_review(integer) from public,anon;
revoke all on function public.aptis_mark_lesson_complete(uuid,uuid) from public,anon;
revoke all on function public.aptis_get_learning_path() from public,anon;
grant execute on function public.aptis_get_attempt_resume(uuid) to authenticated;
grant execute on function public.aptis_start_lesson(uuid,integer) to authenticated;
grant execute on function public.aptis_draw_review(integer) to authenticated;
grant execute on function public.aptis_mark_lesson_complete(uuid,uuid) to authenticated;
grant execute on function public.aptis_get_learning_path() to authenticated;

insert into public.aptis_learning_courses(code,exam_family,title,description,target_level,position,is_active)
values('APTIS-GENERAL-B1-B2','general','Aptis General · Lộ trình B1 → B2','Lộ trình học chung theo chủ đề, từ nền tảng B1 đến củng cố B2 và kỹ năng Aptis General.','B2',1,true)
on conflict(code) do update set title=excluded.title,description=excluded.description,target_level=excluded.target_level,position=excluded.position,is_active=true,updated_at=now();

with c as (select id from public.aptis_learning_courses where code='APTIS-GENERAL-B1-B2'),
seed(code,title,subtitle,description,level_from,level_to,position) as (values
('APT-U01','Everyday English Foundation','Nền tảng giao tiếp hằng ngày','Củng cố từ vựng cơ bản, thì hiện tại và đọc thông tin ngắn.','B1','B1',1),
('APT-U02','People, Family & Daily Life','Con người và đời sống','Mở rộng collocation, articles và đọc chủ đề giáo dục/đời sống.','B1','B1',2),
('APT-U03','Travel, Places & Services','Du lịch và dịch vụ','Từ vựng du lịch, quá khứ và ngôn ngữ sử dụng trong tình huống dịch vụ.','B1','B1',3),
('APT-U04','Work & Study','Công việc và học tập','Từ vựng học tập/công việc và modal verbs; bắt đầu đọc B2 ngắn.','B1','B2',4),
('APT-U05','Health & Lifestyle','Sức khỏe và lối sống','Từ vựng sức khỏe, present perfect và luyện tổng hợp có hướng dẫn.','B1','B1',5),
('APT-U06','Technology & Media','Công nghệ và truyền thông','Chuyển dần lên B2 qua chủ đề công nghệ, future forms và word use.','B1','B2',6),
('APT-U07','Society & Environment','Xã hội và môi trường','Điều kiện, từ vựng môi trường và đọc hiểu B2.','B1','B2',7),
('APT-U08','B2 Vocabulary Builder','Từ vựng B2','Academic language, collocations, phrasal verbs và sắc thái từ.','B2','B2',8),
('APT-U09','B2 Grammar Builder','Ngữ pháp B2','Mixed conditionals, modal perfect, relative clauses và cấu trúc nâng cao.','B2','B2',9),
('APT-U10','Reading & Listening Strategies','Chiến lược tiếp nhận','Luyện đọc B2; Listening được mở khi ngân hàng audio sẵn sàng.','B2','B2',10),
('APT-U11','Speaking & Writing for Aptis','Kỹ năng sản sinh','Chuẩn bị Speaking/Writing; lesson được mở khi prompt/rubric hoàn chỉnh.','B2','B2',11),
('APT-U12','Aptis General Consolidation','Củng cố trước thi thử','Ôn tập tổng hợp B2 trước Mini Mock và Full Mock.','B2','B2',12))
insert into public.aptis_learning_units(course_id,code,title,subtitle,description,level_from,level_to,position,is_active)
select c.id,s.code,s.title,s.subtitle,s.description,s.level_from,s.level_to,s.position,true from c cross join seed s
on conflict(code) do update set title=excluded.title,subtitle=excluded.subtitle,description=excluded.description,level_from=excluded.level_from,level_to=excluded.level_to,position=excluded.position,is_active=true,updated_at=now();

with seed(unit_code,code,title,lesson_kind,skill,level,objective,intro_text,minutes,topic,cnt,pos,available) as (values
('APT-U01','APT-L0101','Everyday words & communication','vocabulary','vocabulary','B1','Nhận biết và dùng từ/cụm từ giao tiếp thường gặp.','Học từ theo ngữ cảnh trước khi làm bài kiểm tra ngắn.',12,'Communication',6,1,true),
('APT-U01','APT-L0102','Present tenses review','grammar','grammar','B1','Phân biệt hiện tại đơn và hiện tại tiếp diễn trong ngữ cảnh.','Ôn cấu trúc cốt lõi trước khi chuyển sang dạng khó hơn.',12,'Present tenses',6,2,true),
('APT-U01','APT-L0103','Reading: community information','reading','reading','B1','Tìm ý chính và chi tiết trong văn bản ngắn.','Đọc passage ngắn và trả lời câu hỏi theo set.',15,'Community',4,3,true),
('APT-U02','APT-L0201','Core collocations','vocabulary','vocabulary','B1','Nhận diện các kết hợp từ thường dùng.','Tập trung vào cụm từ thay vì học từng từ rời.',12,'Collocations',6,1,true),
('APT-U02','APT-L0202','Articles in context','grammar','grammar','B1','Dùng a/an/the và zero article phù hợp.','Học qua ví dụ ngắn rồi kiểm tra lại.',12,'Articles',6,2,true),
('APT-U02','APT-L0203','Reading: education','reading','reading','B1','Đọc hiểu ý chính và chi tiết chủ đề giáo dục.','Một passage chung với nhiều câu con.',15,'Education',4,3,true),
('APT-U03','APT-L0301','Travel vocabulary','vocabulary','vocabulary','B1','Dùng từ vựng du lịch và dịch vụ trong ngữ cảnh.','Học từ theo tình huống thực tế.',12,'Travel',6,1,true),
('APT-U03','APT-L0302','Past tenses','grammar','grammar','B1','Phân biệt past simple, continuous và perfect cơ bản.','Ôn diễn tiến và trình tự sự kiện.',12,'Past tenses',6,2,true),
('APT-U03','APT-L0303','Useful phrasal verbs','review','vocabulary','B1','Củng cố phrasal verbs B1 dùng thường xuyên.','Ôn theo câu và cụm từ.',12,'Phrasal verbs',6,3,true),
('APT-U04','APT-L0401','Work & study vocabulary','vocabulary','vocabulary','B1','Mở rộng từ vựng công việc và học tập.','Chuẩn bị vốn từ cho Reading và Speaking sau này.',12,'Work',6,1,true),
('APT-U04','APT-L0402','Modal verbs','grammar','grammar','B1','Dùng modal verbs cho obligation, advice và possibility.','Luyện chọn modal phù hợp theo ngữ cảnh.',12,'Modals',6,2,true),
('APT-U04','APT-L0403','Reading: work at B2','reading','reading','B2','Đọc văn bản B2 về công việc và suy luận chi tiết.','Bài chuyển tiếp từ B1 sang B2.',16,'Work',4,3,true),
('APT-U05','APT-L0501','Health vocabulary','vocabulary','vocabulary','B1','Dùng từ sức khỏe và lối sống thường gặp.','Học theo cụm từ và ví dụ.',12,'Health',6,1,true),
('APT-U05','APT-L0502','Present perfect','grammar','grammar','B1','Dùng present perfect cho trải nghiệm và khoảng thời gian.','So sánh với past simple trong ngữ cảnh.',12,'Present perfect',6,2,true),
('APT-U05','APT-L0503','B1 synonyms review','review','vocabulary','B1','Củng cố từ đồng nghĩa và lựa chọn từ phù hợp.','Ôn lại từ theo sắc thái đơn giản.',12,'Synonyms',6,3,true),
('APT-U06','APT-L0601','Technology vocabulary','vocabulary','vocabulary','B1','Tăng vốn từ công nghệ phổ thông.','Từ vựng theo ngữ cảnh học tập và đời sống số.',12,'Technology',6,1,true),
('APT-U06','APT-L0602','Future forms','grammar','grammar','B1','Phân biệt will, be going to và present continuous cho tương lai.','Luyện dự định, dự đoán và kế hoạch.',12,'Future forms',6,2,true),
('APT-U06','APT-L0603','Word use review','review','vocabulary','B1','Chọn từ đúng theo ngữ cảnh và collocation.','Chuẩn bị cho Vocabulary Aptis.',12,'Word use',6,3,true),
('APT-U07','APT-L0701','Environment vocabulary','vocabulary','vocabulary','B2','Mở rộng vốn từ môi trường ở mức B2.','Học từ và cụm từ dùng trong thảo luận.',14,'Environment',6,1,true),
('APT-U07','APT-L0702','Conditionals bridge','grammar','grammar','B1','Củng cố first/second conditionals trước khi học mixed conditionals.','Bài nối từ B1 lên B2.',14,'Second conditional',6,2,true),
('APT-U07','APT-L0703','Reading: environment B2','reading','reading','B2','Đọc hiểu văn bản B2 về môi trường.','Chú ý quan điểm và chi tiết hỗ trợ.',16,'Environment',4,3,true),
('APT-U08','APT-L0801','Academic language','vocabulary','vocabulary','B2','Nhận biết từ/cụm từ học thuật thường gặp.','Tập trung vào cách dùng trong câu.',14,'Academic language',6,1,true),
('APT-U08','APT-L0802','B2 collocations','vocabulary','vocabulary','B2','Dùng collocation B2 tự nhiên hơn.','Ưu tiên cụm từ có khả năng xuất hiện trong Reading/Writing.',14,'Collocations',6,2,true),
('APT-U08','APT-L0803','B2 phrasal verbs','vocabulary','vocabulary','B2','Hiểu và dùng phrasal verbs B2 theo ngữ cảnh.','Học theo nghĩa trong câu, không học danh sách rời.',14,'Phrasal verbs',6,3,true),
('APT-U09','APT-L0901','Mixed conditionals','grammar','grammar','B2','Phân biệt và dùng mixed conditionals.','Tập trung quan hệ thời gian giữa điều kiện và kết quả.',15,'Mixed conditionals',6,1,true),
('APT-U09','APT-L0902','Modal perfect','grammar','grammar','B2','Dùng modal perfect để suy đoán và đánh giá quá khứ.','Luyện should have, might have, must have...',15,'Modal perfect',6,2,true),
('APT-U09','APT-L0903','Relative clauses B2','grammar','grammar','B2','Củng cố relative clauses ở mức B2.','Chú ý defining/non-defining và rút gọn khi phù hợp.',15,'Relative clauses',6,3,true),
('APT-U10','APT-L1001','Reading: work B2','reading','reading','B2','Luyện đọc dài hơn và suy luận thông tin.','Tập trung vào cohesion và inference.',16,'Work',4,1,true),
('APT-U10','APT-L1002','Reading: environment B2','reading','reading','B2','Luyện xác định quan điểm và chi tiết hỗ trợ.','Ôn chiến lược đọc trước khi thi thử.',16,'Environment',4,2,true),
('APT-U10','APT-L1003','Listening strategy lab','listening','listening','B2','Luyện nghe theo part khi kho audio sẵn sàng.','Lesson này đã có vị trí trong lộ trình nhưng chưa mở để tránh bài rỗng.',15,null,6,3,false),
('APT-U11','APT-L1101','Speaking task practice','speaking','speaking','B2','Luyện trả lời có cấu trúc và ghi âm.','Sẽ mở khi prompt bank và rubric hoàn chỉnh.',15,null,4,1,false),
('APT-U11','APT-L1102','Writing task practice','writing','writing','B2','Luyện viết có mục tiêu, word count và autosave.','Sẽ mở khi prompt bank và rubric hoàn chỉnh.',20,null,4,2,false),
('APT-U11','APT-L1103','Communication vocabulary B2','vocabulary','vocabulary','B2','Củng cố từ vựng diễn đạt ý kiến và giao tiếp.','Bài khả dụng trong khi Speaking/Writing đang hoàn thiện.',14,'Communication',6,3,true),
('APT-U12','APT-L1201','B2 vocabulary consolidation','review','vocabulary','B2','Ôn từ vựng B2 hỗn hợp trước Mini Mock.','Hệ thống ưu tiên câu chưa gặp và câu từng sai.',15,null,10,1,true),
('APT-U12','APT-L1202','B2 grammar consolidation','review','grammar','B2','Ôn ngữ pháp B2 hỗn hợp trước Mini Mock.','Hệ thống ưu tiên điểm yếu cá nhân.',15,null,10,2,true),
('APT-U12','APT-L1203','B2 reading consolidation','review','reading','B2','Ôn Reading B2 theo các passage đã duyệt.','Bài tổng kết phần Reading trước thi thử.',16,null,8,3,true)),
u as (select id,code from public.aptis_learning_units)
insert into public.aptis_learning_lessons(unit_id,code,title,lesson_kind,skill,level,objective,intro_text,estimated_minutes,practice_spec,position,is_available,is_active)
select u.id,s.code,s.title,s.lesson_kind,s.skill,s.level,s.objective,s.intro_text,s.minutes,jsonb_strip_nulls(jsonb_build_object('topic',s.topic,'count',s.cnt)),s.pos,s.available,true from seed s join u on u.code=s.unit_code
on conflict(code) do update set title=excluded.title,lesson_kind=excluded.lesson_kind,skill=excluded.skill,level=excluded.level,objective=excluded.objective,intro_text=excluded.intro_text,estimated_minutes=excluded.estimated_minutes,practice_spec=excluded.practice_spec,position=excluded.position,is_available=excluded.is_available,is_active=true,updated_at=now();
