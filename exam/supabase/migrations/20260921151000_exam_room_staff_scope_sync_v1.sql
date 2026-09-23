create or replace function private.sync_exam_member_room_scope()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if tg_op='DELETE' then
    delete from public.exam_room_staff rs
    using public.exam_rooms r, public.exam_sessions s
    where rs.room_id=r.id
      and r.session_id=s.id
      and s.exam_id=old.exam_id
      and rs.user_id=old.user_id;
    return old;
  end if;

  delete from public.exam_room_staff rs
  using public.exam_rooms r, public.exam_sessions s
  where rs.room_id=r.id
    and r.session_id=s.id
    and s.exam_id=new.exam_id
    and rs.user_id=new.user_id
    and not (
      new.exam_role='owner'
      or 'manage_live'=any(new.permissions)
      or (('manage_live@' || s.id::text)=any(new.permissions))
    );
  return new;
end;
$$;

revoke all on function private.sync_exam_member_room_scope() from public;

drop trigger if exists trg_exam_member_room_scope on public.exam_members;
create trigger trg_exam_member_room_scope
after update of permissions,exam_role or delete on public.exam_members
for each row execute function private.sync_exam_member_room_scope();
