-- A stale room assignment must never extend a temporary account beyond its current session scope.
create or replace function private.can_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public,auth
as $$
  select private.is_system_admin()
    or exists(
      select 1
      from public.exam_rooms r
      where r.id=p_room_id and private.can_session(r.session_id,'manage_live')
    )
    or exists(
      select 1
      from public.exam_room_staff rs
      join public.exam_rooms r on r.id=rs.room_id
      join public.exam_sessions s on s.id=r.session_id
      join public.exam_members m on m.exam_id=s.exam_id and m.user_id=rs.user_id
      join public.profiles p on p.id=rs.user_id and p.active
      where rs.room_id=p_room_id
        and rs.user_id=auth.uid()
        and (
          m.exam_role='owner'
          or ((p.system_role in ('admin','exam_officer')) and 'manage_live'=any(m.permissions))
          or (('manage_live@' || s.id::text)=any(m.permissions))
        )
    );
$$;

revoke all on function private.can_room(uuid) from public;
grant execute on function private.can_room(uuid) to authenticated,service_role;
