-- AI-CLO Aptis Lab V1 core
-- Production migration name: aptis_lab_v1_core

create table if not exists public.aptis_settings (
  id smallint primary key default 1 check (id = 1),
  default_ai_daily_limit integer not null default 10 check (default_ai_daily_limit between 0 and 100),
  allow_advanced boolean not null default false,
  speaking_record_retention_days integer not null default 30 check (speaking_record_retention_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.aptis_settings(id) values (1) on conflict (id) do nothing;

create table if not exists public.aptis_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  content_role text not null default 'learner' check (content_role in ('learner','english_teacher')),
  target_level text not null default 'B2' check (target_level in ('B1','B2')),
  ai_daily_limit_override integer check (ai_daily_limit_override is null or ai_daily_limit_override between 0 and 100),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aptis_questions (
  id uuid primary key default gen_random_uuid(),
  exam_family text not null default 'general' check (exam_family in ('general','advanced')),
  skill text not null check (skill in ('grammar','vocabulary','reading','listening','speaking','writing')),
  part text not null default 'general',
  question_type text not null default 'mcq',
  level text not null default 'B2' check (level in ('A1','A2','B1','B2','C1','C2')),
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  topic text,
  prompt text not null,
  content jsonb not null default '{}'::jsonb,
  answer jsonb not null default '{}'::jsonb,
  explanation text,
  media jsonb not null default '{}'::jsonb,
  source_type text not null default 'manual' check (source_type in ('manual','ai','import')),
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  times_used integer not null default 0,
  times_correct integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aptis_questions_pool_idx on public.aptis_questions(exam_family, skill, level, status, is_active);
create index if not exists aptis_questions_topic_idx on public.aptis_questions(topic);

create table if not exists public.aptis_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'practice' check (mode in ('practice','daily','mock')),
  exam_family text not null default 'general' check (exam_family in ('general','advanced')),
  skill text,
  target_level text not null default 'B2' check (target_level in ('B1','B2')),
  question_count integer not null default 0,
  answered_count integer not null default 0,
  correct_count integer not null default 0,
  score_percent numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists aptis_attempts_user_idx on public.aptis_attempts(user_id, started_at desc);

create table if not exists public.aptis_attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.aptis_attempts(id) on delete cascade,
  question_id uuid not null references public.aptis_questions(id),
  position integer not null,
  response jsonb,
  is_correct boolean,
  answered_at timestamptz,
  response_time_ms integer,
  unique(attempt_id, question_id),
  unique(attempt_id, position)
);
create index if not exists aptis_attempt_items_attempt_idx on public.aptis_attempt_items(attempt_id, position);

create table if not exists public.aptis_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  term text not null,
  meaning text,
  example text,
  source_question_id uuid references public.aptis_questions(id) on delete set null,
  mastery smallint not null default 0 check (mastery between 0 and 5),
  next_review_on date,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, term)
);
create index if not exists aptis_vocabulary_user_review_idx on public.aptis_vocabulary(user_id, next_review_on);

create table if not exists public.aptis_activity_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null default current_date,
  practice_count integer not null default 0,
  questions_answered integer not null default 0,
  primary key(user_id, activity_date)
);

create table if not exists public.aptis_ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  feature text not null,
  calls integer not null default 0,
  primary key(user_id, usage_date, feature)
);

create or replace function public.aptis_has_access()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.profiles p
    left join public.aptis_memberships m on m.user_id=p.id
    where p.id=auth.uid() and p.is_active=true
      and (p.role in ('admin','teacher') or (p.role='student' and coalesce(m.enabled,false)=true))
  );
$$;

create or replace function public.aptis_is_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true);
$$;

create or replace function public.aptis_is_content_editor()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.profiles p
    left join public.aptis_memberships m on m.user_id=p.id
    where p.id=auth.uid() and p.is_active=true
      and (p.role='admin' or (p.role='teacher' and m.enabled=true and m.content_role='english_teacher'))
  );
$$;

create or replace function public.aptis_initialize_me()
returns table(user_id uuid,full_name text,system_role text,aptis_role text,target_level text,ai_daily_limit integer,can_manage_content boolean,can_manage_access boolean,enabled boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_profile public.profiles%rowtype; v_member public.aptis_memberships%rowtype; v_default_limit integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_profile from public.profiles where id=v_uid;
  if not found or not v_profile.is_active then raise exception 'ACCOUNT_INACTIVE' using errcode='42501'; end if;
  if v_profile.role in ('admin','teacher') then
    insert into public.aptis_memberships(user_id,enabled,content_role,target_level,created_by)
    values(v_uid,true,'learner','B2',v_uid) on conflict(user_id) do nothing;
  end if;
  select * into v_member from public.aptis_memberships where user_id=v_uid;
  if v_profile.role='student' and (not found or not coalesce(v_member.enabled,false)) then
    raise exception 'APTIS_ACCESS_NOT_GRANTED' using errcode='42501';
  end if;
  select default_ai_daily_limit into v_default_limit from public.aptis_settings where id=1;
  return query select v_uid,v_profile.full_name,v_profile.role,
    case when v_profile.role='admin' then 'admin'
         when v_profile.role='teacher' and coalesce(v_member.content_role,'learner')='english_teacher' and coalesce(v_member.enabled,true) then 'english_teacher'
         else 'learner' end,
    coalesce(v_member.target_level,'B2'),coalesce(v_member.ai_daily_limit_override,v_default_limit,10),
    (v_profile.role='admin' or (v_profile.role='teacher' and coalesce(v_member.content_role,'learner')='english_teacher' and coalesce(v_member.enabled,true))),
    (v_profile.role='admin'),case when v_profile.role in ('admin','teacher') then true else coalesce(v_member.enabled,false) end;
end;
$$;

create or replace function public.aptis_set_target_level(p_level text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  if p_level not in ('B1','B2') then raise exception 'INVALID_LEVEL' using errcode='22023'; end if;
  insert into public.aptis_memberships(user_id,enabled,target_level,created_by)
  values(auth.uid(),true,p_level,auth.uid())
  on conflict(user_id) do update set target_level=excluded.target_level,updated_at=now();
  return p_level;
end;
$$;

create or replace function public.aptis_admin_set_member_by_email(p_email text,p_enabled boolean default true,p_content_role text default 'learner',p_ai_daily_limit_override integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile public.profiles%rowtype;
begin
  if not public.aptis_is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_content_role not in ('learner','english_teacher') then raise exception 'INVALID_APTIS_ROLE' using errcode='22023'; end if;
  if p_ai_daily_limit_override is not null and (p_ai_daily_limit_override<0 or p_ai_daily_limit_override>100) then raise exception 'INVALID_AI_LIMIT' using errcode='22023'; end if;
  select * into v_profile from public.profiles where lower(email)=lower(trim(p_email)) limit 1;
  if not found then raise exception 'USER_NOT_FOUND' using errcode='P0002'; end if;
  if p_content_role='english_teacher' and v_profile.role not in ('teacher','admin') then raise exception 'ENGLISH_TEACHER_MUST_BE_TEACHER' using errcode='22023'; end if;
  insert into public.aptis_memberships(user_id,enabled,content_role,target_level,ai_daily_limit_override,created_by)
  values(v_profile.id,p_enabled,p_content_role,'B2',p_ai_daily_limit_override,auth.uid())
  on conflict(user_id) do update set enabled=excluded.enabled,content_role=excluded.content_role,ai_daily_limit_override=excluded.ai_daily_limit_override,updated_at=now();
  return jsonb_build_object('user_id',v_profile.id,'full_name',v_profile.full_name,'email',v_profile.email,'system_role',v_profile.role,'enabled',p_enabled,'content_role',p_content_role,'ai_daily_limit_override',p_ai_daily_limit_override);
end;
$$;

create or replace function public.aptis_admin_list_members()
returns table(user_id uuid,full_name text,email text,system_role text,enabled boolean,content_role text,target_level text,ai_daily_limit_override integer)
language sql security definer set search_path=public,pg_temp as $$
  select p.id,p.full_name,p.email,p.role,coalesce(m.enabled,p.role in ('admin','teacher')),
         case when p.role='admin' then 'admin' else coalesce(m.content_role,'learner') end,
         coalesce(m.target_level,'B2'),m.ai_daily_limit_override
  from public.profiles p left join public.aptis_memberships m on m.user_id=p.id
  where public.aptis_is_admin() and (p.role in ('admin','teacher') or m.user_id is not null)
  order by p.role,p.full_name;
$$;

create or replace function public.aptis_admin_update_settings(p_ai_daily_limit integer,p_allow_advanced boolean,p_retention_days integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.aptis_is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_ai_daily_limit<0 or p_ai_daily_limit>100 then raise exception 'INVALID_AI_LIMIT' using errcode='22023'; end if;
  if p_retention_days<1 or p_retention_days>3650 then raise exception 'INVALID_RETENTION' using errcode='22023'; end if;
  update public.aptis_settings set default_ai_daily_limit=p_ai_daily_limit,allow_advanced=p_allow_advanced,speaking_record_retention_days=p_retention_days,updated_at=now(),updated_by=auth.uid() where id=1;
  return jsonb_build_object('default_ai_daily_limit',p_ai_daily_limit,'allow_advanced',p_allow_advanced,'speaking_record_retention_days',p_retention_days);
end;
$$;

create or replace function public.aptis_stamp_question_actor()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then new.created_by:=auth.uid(); new.updated_by:=auth.uid(); new.created_at:=coalesce(new.created_at,now());
  else new.created_by:=old.created_by; new.updated_by:=auth.uid(); end if;
  new.updated_at:=now(); return new;
end;
$$;
drop trigger if exists trg_aptis_question_actor on public.aptis_questions;
create trigger trg_aptis_question_actor before insert or update on public.aptis_questions for each row execute function public.aptis_stamp_question_actor();

create or replace function public.aptis_draw_practice(p_skill text default null,p_level text default null,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_attempt uuid; v_level text; v_limit integer:=greatest(1,least(coalesce(p_limit,10),50)); v_questions jsonb;
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  if p_skill is not null and p_skill not in ('grammar','vocabulary','reading','listening','speaking','writing') then raise exception 'INVALID_SKILL' using errcode='22023'; end if;
  select coalesce(p_level,m.target_level,'B2') into v_level from public.aptis_memberships m where m.user_id=v_uid;
  if v_level is null then v_level:=coalesce(p_level,'B2'); end if;
  if v_level not in ('B1','B2') then raise exception 'INVALID_LEVEL' using errcode='22023'; end if;
  insert into public.aptis_attempts(user_id,mode,exam_family,skill,target_level) values(v_uid,'practice','general',p_skill,v_level) returning id into v_attempt;
  with picked as (
    select q.id,row_number() over(order by random())::int as pos from public.aptis_questions q
    where q.exam_family='general' and q.status='published' and q.is_active=true and (p_skill is null or q.skill=p_skill) and q.level=v_level
    order by random() limit v_limit
  ), ins as (
    insert into public.aptis_attempt_items(attempt_id,question_id,position) select v_attempt,id,pos from picked returning question_id,position
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'skill',q.skill,'part',q.part,'question_type',q.question_type,'level',q.level,'difficulty',q.difficulty,'topic',q.topic,'prompt',q.prompt,'content',q.content,'media',q.media,'position',i.position) order by i.position),'[]'::jsonb)
  into v_questions from ins i join public.aptis_questions q on q.id=i.question_id;
  update public.aptis_attempts set question_count=jsonb_array_length(v_questions) where id=v_attempt;
  if jsonb_array_length(v_questions)=0 then delete from public.aptis_attempts where id=v_attempt; return jsonb_build_object('attempt_id',null,'questions','[]'::jsonb); end if;
  return jsonb_build_object('attempt_id',v_attempt,'questions',v_questions);
end;
$$;

create or replace function public.aptis_submit_answer(p_attempt_id uuid,p_question_id uuid,p_response jsonb,p_response_time_ms integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_q public.aptis_questions%rowtype; v_item public.aptis_attempt_items%rowtype; v_correct boolean; v_total integer; v_answered integer; v_correct_count integer;
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  select i.* into v_item from public.aptis_attempt_items i join public.aptis_attempts a on a.id=i.attempt_id where i.attempt_id=p_attempt_id and i.question_id=p_question_id and a.user_id=v_uid;
  if not found then raise exception 'QUESTION_NOT_IN_ATTEMPT' using errcode='42501'; end if;
  select * into v_q from public.aptis_questions where id=p_question_id;
  if v_item.answered_at is not null then return jsonb_build_object('is_correct',v_item.is_correct,'correct_answer',case when v_q.question_type in ('speaking_prompt','writing_prompt') then null else v_q.answer end,'explanation',v_q.explanation,'already_answered',true); end if;
  if v_q.question_type in ('speaking_prompt','writing_prompt') then v_correct:=null; else v_correct:=(coalesce(p_response,'null'::jsonb)=coalesce(v_q.answer,'null'::jsonb)); end if;
  update public.aptis_attempt_items set response=p_response,is_correct=v_correct,answered_at=now(),response_time_ms=p_response_time_ms where id=v_item.id;
  update public.aptis_questions set times_used=times_used+1,times_correct=times_correct+case when v_correct then 1 else 0 end where id=v_q.id;
  insert into public.aptis_activity_days(user_id,activity_date,practice_count,questions_answered) values(v_uid,current_date,0,1)
  on conflict(user_id,activity_date) do update set questions_answered=public.aptis_activity_days.questions_answered+1;
  select question_count,count(*) filter(where answered_at is not null),count(*) filter(where is_correct=true) into v_total,v_answered,v_correct_count
  from public.aptis_attempts a left join public.aptis_attempt_items i on i.attempt_id=a.id where a.id=p_attempt_id group by a.question_count;
  update public.aptis_attempts set answered_count=v_answered,correct_count=v_correct_count,
    score_percent=case when v_answered>0 then round((100.0*v_correct_count/v_answered)::numeric,2) else null end,
    completed_at=case when v_total>0 and v_answered>=v_total then now() else completed_at end where id=p_attempt_id;
  if v_total>0 and v_answered>=v_total then update public.aptis_activity_days set practice_count=practice_count+1 where user_id=v_uid and activity_date=current_date; end if;
  return jsonb_build_object('is_correct',v_correct,'correct_answer',case when v_q.question_type in ('speaking_prompt','writing_prompt') then null else v_q.answer end,'explanation',v_q.explanation,'already_answered',false);
end;
$$;

create or replace function public.aptis_take_ai_credit(p_feature text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_limit integer; v_used integer;
begin
  if not public.aptis_has_access() then raise exception 'APTIS_ACCESS_REQUIRED' using errcode='42501'; end if;
  select coalesce(m.ai_daily_limit_override,s.default_ai_daily_limit,10) into v_limit from public.aptis_settings s left join public.aptis_memberships m on m.user_id=v_uid where s.id=1;
  select coalesce(sum(calls),0) into v_used from public.aptis_ai_usage where user_id=v_uid and usage_date=current_date;
  if v_used>=v_limit then return jsonb_build_object('allowed',false,'limit',v_limit,'used',v_used,'remaining',0); end if;
  insert into public.aptis_ai_usage(user_id,usage_date,feature,calls) values(v_uid,current_date,coalesce(nullif(trim(p_feature),''),'general'),1)
  on conflict(user_id,usage_date,feature) do update set calls=public.aptis_ai_usage.calls+1;
  v_used:=v_used+1;
  return jsonb_build_object('allowed',true,'limit',v_limit,'used',v_used,'remaining',greatest(v_limit-v_used,0));
end;
$$;

alter table public.aptis_settings enable row level security;
alter table public.aptis_memberships enable row level security;
alter table public.aptis_questions enable row level security;
alter table public.aptis_attempts enable row level security;
alter table public.aptis_attempt_items enable row level security;
alter table public.aptis_vocabulary enable row level security;
alter table public.aptis_activity_days enable row level security;
alter table public.aptis_ai_usage enable row level security;

drop policy if exists aptis_settings_read on public.aptis_settings;
create policy aptis_settings_read on public.aptis_settings for select to authenticated using(public.aptis_has_access());
drop policy if exists aptis_membership_own_or_admin_read on public.aptis_memberships;
create policy aptis_membership_own_or_admin_read on public.aptis_memberships for select to authenticated using(user_id=auth.uid() or public.aptis_is_admin());
-- Question write policies are refined in aptis-lab-v1-permissions-and-suggestions.sql
drop policy if exists aptis_questions_editor_all on public.aptis_questions;
create policy aptis_questions_editor_all on public.aptis_questions for all to authenticated using(public.aptis_is_content_editor()) with check(public.aptis_is_content_editor());
drop policy if exists aptis_attempts_own_read on public.aptis_attempts;
create policy aptis_attempts_own_read on public.aptis_attempts for select to authenticated using(user_id=auth.uid() and public.aptis_has_access());
drop policy if exists aptis_attempt_items_own_read on public.aptis_attempt_items;
create policy aptis_attempt_items_own_read on public.aptis_attempt_items for select to authenticated using(exists(select 1 from public.aptis_attempts a where a.id=attempt_id and a.user_id=auth.uid()) and public.aptis_has_access());
drop policy if exists aptis_vocabulary_own_all on public.aptis_vocabulary;
create policy aptis_vocabulary_own_all on public.aptis_vocabulary for all to authenticated using(user_id=auth.uid() and public.aptis_has_access()) with check(user_id=auth.uid() and public.aptis_has_access());
drop policy if exists aptis_activity_own_read on public.aptis_activity_days;
create policy aptis_activity_own_read on public.aptis_activity_days for select to authenticated using(user_id=auth.uid() and public.aptis_has_access());
drop policy if exists aptis_ai_usage_own_read on public.aptis_ai_usage;
create policy aptis_ai_usage_own_read on public.aptis_ai_usage for select to authenticated using(user_id=auth.uid() and public.aptis_has_access());

grant select on public.aptis_settings,public.aptis_memberships,public.aptis_attempts,public.aptis_attempt_items,public.aptis_activity_days,public.aptis_ai_usage to authenticated;
grant select,insert,update,delete on public.aptis_questions,public.aptis_vocabulary to authenticated;
revoke all on public.aptis_settings,public.aptis_memberships,public.aptis_questions,public.aptis_attempts,public.aptis_attempt_items,public.aptis_vocabulary,public.aptis_activity_days,public.aptis_ai_usage from anon;

revoke all on function public.aptis_has_access() from public,anon;
revoke all on function public.aptis_is_admin() from public,anon;
revoke all on function public.aptis_is_content_editor() from public,anon;
revoke all on function public.aptis_initialize_me() from public,anon;
revoke all on function public.aptis_set_target_level(text) from public,anon;
revoke all on function public.aptis_admin_set_member_by_email(text,boolean,text,integer) from public,anon;
revoke all on function public.aptis_admin_list_members() from public,anon;
revoke all on function public.aptis_admin_update_settings(integer,boolean,integer) from public,anon;
revoke all on function public.aptis_draw_practice(text,text,integer) from public,anon;
revoke all on function public.aptis_submit_answer(uuid,uuid,jsonb,integer) from public,anon;
revoke all on function public.aptis_take_ai_credit(text) from public,anon;
grant execute on function public.aptis_has_access(),public.aptis_is_admin(),public.aptis_is_content_editor(),public.aptis_initialize_me(),public.aptis_set_target_level(text),public.aptis_admin_set_member_by_email(text,boolean,text,integer),public.aptis_admin_list_members(),public.aptis_admin_update_settings(integer,boolean,integer),public.aptis_draw_practice(text,text,integer),public.aptis_submit_answer(uuid,uuid,jsonb,integer),public.aptis_take_ai_credit(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('aptis-content','aptis-content',false,26214400,array['audio/mpeg','audio/mp4','audio/webm','audio/wav','image/jpeg','image/png','image/webp']),
('aptis-recordings','aptis-recordings',false,10485760,array['audio/mpeg','audio/mp4','audio/webm','audio/wav'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists aptis_content_read on storage.objects;
create policy aptis_content_read on storage.objects for select to authenticated using(bucket_id='aptis-content' and public.aptis_has_access());
drop policy if exists aptis_content_editor_insert on storage.objects;
create policy aptis_content_editor_insert on storage.objects for insert to authenticated with check(bucket_id='aptis-content' and public.aptis_is_content_editor());
drop policy if exists aptis_content_editor_update on storage.objects;
create policy aptis_content_editor_update on storage.objects for update to authenticated using(bucket_id='aptis-content' and public.aptis_is_content_editor()) with check(bucket_id='aptis-content' and public.aptis_is_content_editor());
drop policy if exists aptis_content_editor_delete on storage.objects;
create policy aptis_content_editor_delete on storage.objects for delete to authenticated using(bucket_id='aptis-content' and public.aptis_is_content_editor());
drop policy if exists aptis_recordings_own_read on storage.objects;
create policy aptis_recordings_own_read on storage.objects for select to authenticated using(bucket_id='aptis-recordings' and ((storage.foldername(name))[1]=auth.uid()::text or public.aptis_is_admin()));
drop policy if exists aptis_recordings_own_insert on storage.objects;
create policy aptis_recordings_own_insert on storage.objects for insert to authenticated with check(bucket_id='aptis-recordings' and public.aptis_has_access() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists aptis_recordings_own_update on storage.objects;
create policy aptis_recordings_own_update on storage.objects for update to authenticated using(bucket_id='aptis-recordings' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='aptis-recordings' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists aptis_recordings_own_delete on storage.objects;
create policy aptis_recordings_own_delete on storage.objects for delete to authenticated using(bucket_id='aptis-recordings' and ((storage.foldername(name))[1]=auth.uid()::text or public.aptis_is_admin()));
