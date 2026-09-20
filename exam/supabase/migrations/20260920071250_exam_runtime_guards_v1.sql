create or replace function private.storage_exam_id(p_name text)
returns uuid language plpgsql immutable as $$
declare parts text[]; result uuid;
begin
  parts := storage.foldername(p_name);
  if array_length(parts,1) < 2 or parts[1] <> 'exams' then return null; end if;
  begin result := parts[2]::uuid; exception when others then return null; end;
  return result;
end; $$;
revoke all on function private.storage_exam_id(text) from public;
grant execute on function private.storage_exam_id(text) to authenticated, service_role;

create policy exam_files_select on storage.objects for select to authenticated
using (bucket_id='exam-files' and private.can_exam(private.storage_exam_id(name),'manage_assets'));
create policy exam_files_insert on storage.objects for insert to authenticated
with check (bucket_id='exam-files' and private.can_exam(private.storage_exam_id(name),'manage_assets'));
create policy exam_files_update on storage.objects for update to authenticated
using (bucket_id='exam-files' and private.can_exam(private.storage_exam_id(name),'manage_assets'))
with check (bucket_id='exam-files' and private.can_exam(private.storage_exam_id(name),'manage_assets'));
create policy exam_files_delete on storage.objects for delete to authenticated
using (bucket_id='exam-files' and private.can_exam(private.storage_exam_id(name),'manage_assets'));

create or replace function public.sync_attempt_answer_stats()
returns trigger language plpgsql security definer set search_path=public as $$
declare aid uuid; delta integer := 0;
begin
  aid := coalesce((select attempt_id from public.attempt_questions where id=coalesce(new.attempt_question_id,old.attempt_question_id)),null);
  if tg_op='INSERT' then
    if new.selected_key is not null then delta:=1; end if;
  elsif tg_op='UPDATE' then
    if old.selected_key is null and new.selected_key is not null then delta:=1;
    elsif old.selected_key is not null and new.selected_key is null then delta:=-1; end if;
  elsif tg_op='DELETE' then
    if old.selected_key is not null then delta:=-1; end if;
  end if;
  if aid is not null then
    update public.exam_attempts set answered_count=greatest(0,answered_count+delta),last_saved_at=now() where id=aid;
  end if;
  return coalesce(new,old);
end; $$;
revoke all on function public.sync_attempt_answer_stats() from public,anon,authenticated;
create trigger sync_attempt_answer_stats after insert or update or delete on public.attempt_answers
for each row execute function public.sync_attempt_answer_stats();
