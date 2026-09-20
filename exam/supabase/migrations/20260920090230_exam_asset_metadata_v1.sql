alter table public.exam_assets
  add column if not exists original_name text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists exam_assets_exam_kind_created_idx
  on public.exam_assets(exam_id,kind,created_at desc)
  where deleted_at is null;
