-- AI-CLO Aptis Lab: fix PL/pgSQL output-column ambiguity in aptis_initialize_me()
-- Production migration name: aptis_fix_initialize_user_id_ambiguous_20260918

create or replace function public.aptis_initialize_me()
returns table(
  user_id uuid,
  full_name text,
  system_role text,
  aptis_role text,
  target_level text,
  ai_daily_limit integer,
  can_manage_content boolean,
  can_manage_access boolean,
  enabled boolean
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_member public.aptis_memberships%rowtype;
  v_default_limit integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.id = v_uid;

  if not found or not v_profile.is_active then
    raise exception 'ACCOUNT_INACTIVE' using errcode='42501';
  end if;

  if v_profile.role in ('admin','teacher') then
    insert into public.aptis_memberships(
      user_id, enabled, content_role, target_level, created_by
    ) values (
      v_uid, true, 'learner', 'B2', v_uid
    )
    on conflict on constraint aptis_memberships_pkey do nothing;
  end if;

  select m.*
  into v_member
  from public.aptis_memberships m
  where m.user_id = v_uid;

  if v_profile.role = 'student'
     and (not found or not coalesce(v_member.enabled,false)) then
    raise exception 'APTIS_ACCESS_NOT_GRANTED' using errcode='42501';
  end if;

  select s.default_ai_daily_limit
  into v_default_limit
  from public.aptis_settings s
  where s.id = 1;

  return query
  select
    v_uid,
    v_profile.full_name,
    v_profile.role,
    case
      when v_profile.role = 'admin' then 'admin'
      when v_profile.role = 'teacher'
       and coalesce(v_member.content_role,'learner') = 'english_teacher'
       and coalesce(v_member.enabled,true)
      then 'english_teacher'
      else 'learner'
    end,
    coalesce(v_member.target_level,'B2'),
    coalesce(v_member.ai_daily_limit_override, v_default_limit, 10),
    (
      v_profile.role='admin'
      or (
        v_profile.role='teacher'
        and coalesce(v_member.content_role,'learner')='english_teacher'
        and coalesce(v_member.enabled,true)
      )
    ),
    (v_profile.role='admin'),
    case
      when v_profile.role in ('admin','teacher') then true
      else coalesce(v_member.enabled,false)
    end;
end;
$$;

revoke all on function public.aptis_initialize_me() from public, anon;
grant execute on function public.aptis_initialize_me() to authenticated;
