create table public.student_login_failures (
  id bigint generated always as identity primary key,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index student_login_failures_key_idx on public.student_login_failures(key_hash,created_at desc);
alter table public.student_login_failures enable row level security;
-- No client policies: only service-role Edge Functions can read/write this table.
