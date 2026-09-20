create index if not exists student_login_failures_created_idx
  on public.student_login_failures(created_at);

create or replace function public.cleanup_student_login_failures()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from public.student_login_failures
   where key_hash = new.key_hash
     and created_at < now() - interval '10 minutes';

  if mod(new.id,100) = 0 then
    delete from public.student_login_failures
     where created_at < now() - interval '24 hours';
  end if;
  return new;
end;
$$;

revoke all on function public.cleanup_student_login_failures() from public, anon, authenticated;

drop trigger if exists cleanup_student_login_failures_after_insert on public.student_login_failures;
create trigger cleanup_student_login_failures_after_insert
after insert on public.student_login_failures
for each row execute function public.cleanup_student_login_failures();
