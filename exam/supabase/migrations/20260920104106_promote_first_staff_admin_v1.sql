do $$
declare
  v_user_id uuid;
  v_user_count integer;
begin
  select count(*) into v_user_count from auth.users;
  if v_user_count <> 1 then
    raise exception 'Expected exactly one auth user for first-admin promotion, found %', v_user_count;
  end if;

  select id into v_user_id from auth.users order by created_at asc limit 1;

  update public.profiles
     set system_role = 'admin', active = true
   where id = v_user_id;

  if not found then
    raise exception 'Profile for first auth user was not found';
  end if;

  update public.admin_bootstrap_tokens
     set used_at = coalesce(used_at, now())
   where used_at is null;
end $$;
