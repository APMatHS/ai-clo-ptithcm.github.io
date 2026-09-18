-- AI-CLO Aptis Lab — bank sets, versioning and RLS
-- Already applied to production rraooqedkpyhokattwdz on 2026-09-18.

create table if not exists public.aptis_sets (
  id uuid primary key default gen_random_uuid(),
  exam_family text not null default 'general' check (exam_family in ('general','advanced')),
  skill text not null check (skill in ('reading','listening','speaking','writing')),
  part text not null default 'general',
  level text not null default 'B2' check (level in ('A1','A2','B1','B2','C1','C2')),
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  topic text,
  title text not null,
  instructions text,
  body_text text,
  transcript text,
  media jsonb not null default '{}'::jsonb,
  source_type text not null default 'manual' check (source_type in ('manual','ai','import')),
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  is_active boolean not null default true,
  revision integer not null default 1 check (revision >= 1),
  content_hash text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aptis_sets_pool_idx on public.aptis_sets(exam_family,skill,level,status,is_active);
create index if not exists aptis_sets_topic_idx on public.aptis_sets(topic);
create index if not exists aptis_sets_hash_idx on public.aptis_sets(content_hash);

alter table public.aptis_questions add column if not exists set_id uuid references public.aptis_sets(id) on delete set null;
alter table public.aptis_questions add column if not exists item_order integer;
alter table public.aptis_questions add column if not exists revision integer not null default 1;
alter table public.aptis_questions add column if not exists content_hash text;
create index if not exists aptis_questions_set_idx on public.aptis_questions(set_id,item_order);
create index if not exists aptis_questions_hash_idx on public.aptis_questions(content_hash);
create unique index if not exists aptis_questions_set_order_uidx on public.aptis_questions(set_id,item_order) where set_id is not null and item_order is not null;

create table if not exists public.aptis_question_revisions (
  id bigint generated always as identity primary key,
  question_id uuid not null,
  revision integer not null,
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index if not exists aptis_question_revisions_q_idx on public.aptis_question_revisions(question_id,revision desc);

create table if not exists public.aptis_set_revisions (
  id bigint generated always as identity primary key,
  set_id uuid not null,
  revision integer not null,
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index if not exists aptis_set_revisions_s_idx on public.aptis_set_revisions(set_id,revision desc);

create or replace function public.aptis_hash_text(p_text text)
returns text language sql immutable set search_path='' as $$
  select md5(regexp_replace(lower(coalesce(p_text,'')), '\s+', ' ', 'g'));
$$;

create or replace function public.aptis_stamp_set_actor()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.created_by:=auth.uid(); new.updated_by:=auth.uid(); new.created_at:=coalesce(new.created_at,now());
  else
    new.created_by:=old.created_by; new.updated_by:=auth.uid();
  end if;
  new.updated_at:=now();
  new.content_hash:=public.aptis_hash_text(coalesce(new.title,'')||' '||coalesce(new.body_text,'')||' '||coalesce(new.transcript,''));
  return new;
end; $$;

create or replace function public.aptis_stamp_question_bank_fields()
returns trigger language plpgsql set search_path='' as $$
begin
  new.content_hash:=public.aptis_hash_text(new.prompt);
  if new.set_id is not null and new.item_order is null then new.item_order:=1; end if;
  return new;
end; $$;

create or replace function public.aptis_archive_question_revision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (
    old.exam_family is distinct from new.exam_family or old.skill is distinct from new.skill or old.part is distinct from new.part or
    old.question_type is distinct from new.question_type or old.level is distinct from new.level or old.difficulty is distinct from new.difficulty or
    old.topic is distinct from new.topic or old.prompt is distinct from new.prompt or old.content is distinct from new.content or
    old.answer is distinct from new.answer or old.explanation is distinct from new.explanation or old.media is distinct from new.media or
    old.source_type is distinct from new.source_type or old.status is distinct from new.status or old.is_active is distinct from new.is_active or
    old.set_id is distinct from new.set_id or old.item_order is distinct from new.item_order
  ) then
    insert into public.aptis_question_revisions(question_id,revision,snapshot,changed_by)
    values(old.id,old.revision,to_jsonb(old),auth.uid());
    new.revision:=old.revision+1;
  else new.revision:=old.revision; end if;
  return new;
end; $$;

create or replace function public.aptis_archive_set_revision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (
    old.exam_family is distinct from new.exam_family or old.skill is distinct from new.skill or old.part is distinct from new.part or
    old.level is distinct from new.level or old.difficulty is distinct from new.difficulty or old.topic is distinct from new.topic or
    old.title is distinct from new.title or old.instructions is distinct from new.instructions or old.body_text is distinct from new.body_text or
    old.transcript is distinct from new.transcript or old.media is distinct from new.media or old.source_type is distinct from new.source_type or
    old.status is distinct from new.status or old.is_active is distinct from new.is_active
  ) then
    insert into public.aptis_set_revisions(set_id,revision,snapshot,changed_by)
    values(old.id,old.revision,to_jsonb(old),auth.uid());
    new.revision:=old.revision+1;
  else new.revision:=old.revision; end if;
  return new;
end; $$;

drop trigger if exists trg_aptis_stamp_set_actor on public.aptis_sets;
create trigger trg_aptis_stamp_set_actor before insert or update on public.aptis_sets for each row execute function public.aptis_stamp_set_actor();
drop trigger if exists trg_aptis_archive_set_revision on public.aptis_sets;
create trigger trg_aptis_archive_set_revision before update on public.aptis_sets for each row execute function public.aptis_archive_set_revision();
drop trigger if exists trg_aptis_question_bank_fields on public.aptis_questions;
create trigger trg_aptis_question_bank_fields before insert or update on public.aptis_questions for each row execute function public.aptis_stamp_question_bank_fields();
drop trigger if exists trg_aptis_archive_question_revision on public.aptis_questions;
create trigger trg_aptis_archive_question_revision before update on public.aptis_questions for each row execute function public.aptis_archive_question_revision();
update public.aptis_questions q set content_hash=public.aptis_hash_text(q.prompt) where q.content_hash is null;

alter table public.aptis_sets enable row level security;
alter table public.aptis_question_revisions enable row level security;
alter table public.aptis_set_revisions enable row level security;
revoke all on public.aptis_sets from anon;
revoke all on public.aptis_question_revisions from anon;
revoke all on public.aptis_set_revisions from anon;
grant select,insert,update,delete on public.aptis_sets to authenticated;
grant select on public.aptis_question_revisions to authenticated;
grant select on public.aptis_set_revisions to authenticated;

drop policy if exists aptis_sets_editor_select on public.aptis_sets;
create policy aptis_sets_editor_select on public.aptis_sets for select to authenticated using ((select public.aptis_is_content_editor()));
drop policy if exists aptis_sets_editor_insert on public.aptis_sets;
create policy aptis_sets_editor_insert on public.aptis_sets for insert to authenticated with check ((select public.aptis_is_content_editor()));
drop policy if exists aptis_sets_editor_update on public.aptis_sets;
create policy aptis_sets_editor_update on public.aptis_sets for update to authenticated using ((select public.aptis_is_content_editor())) with check ((select public.aptis_is_content_editor()));
drop policy if exists aptis_sets_admin_delete on public.aptis_sets;
create policy aptis_sets_admin_delete on public.aptis_sets for delete to authenticated using ((select public.aptis_is_admin()));
drop policy if exists aptis_qrev_editor_select on public.aptis_question_revisions;
create policy aptis_qrev_editor_select on public.aptis_question_revisions for select to authenticated using ((select public.aptis_is_content_editor()));
drop policy if exists aptis_srev_editor_select on public.aptis_set_revisions;
create policy aptis_srev_editor_select on public.aptis_set_revisions for select to authenticated using ((select public.aptis_is_content_editor()));

revoke execute on function public.aptis_stamp_set_actor() from public,anon,authenticated;
revoke execute on function public.aptis_stamp_question_bank_fields() from public,anon,authenticated;
revoke execute on function public.aptis_archive_question_revision() from public,anon,authenticated;
revoke execute on function public.aptis_archive_set_revision() from public,anon,authenticated;
revoke execute on function public.aptis_hash_text(text) from public,anon;
grant execute on function public.aptis_hash_text(text) to authenticated;
