-- AI-CLO OLYMPIC: prevent cross-subject links between sections, topics and lessons.
-- Applied to production Supabase on 2026-09-18 after confirming there were no existing mismatches.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.olympic_sections'::regclass
      and conname='olympic_sections_subject_id_id_key'
  ) then
    alter table public.olympic_sections
      add constraint olympic_sections_subject_id_id_key unique (subject_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.olympic_topics'::regclass
      and conname='olympic_topics_subject_id_id_key'
  ) then
    alter table public.olympic_topics
      add constraint olympic_topics_subject_id_id_key unique (subject_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.olympic_topics'::regclass
      and conname='olympic_topics_subject_section_fk'
  ) then
    alter table public.olympic_topics
      add constraint olympic_topics_subject_section_fk
      foreign key (subject_id, section_id)
      references public.olympic_sections(subject_id, id)
      on update cascade on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.olympic_lessons'::regclass
      and conname='olympic_lessons_subject_topic_fk'
  ) then
    alter table public.olympic_lessons
      add constraint olympic_lessons_subject_topic_fk
      foreign key (subject_id, topic_id)
      references public.olympic_topics(subject_id, id)
      on update cascade on delete restrict;
  end if;
end $$;
