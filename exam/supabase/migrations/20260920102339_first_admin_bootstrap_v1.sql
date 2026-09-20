create table if not exists public.admin_bootstrap_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.admin_bootstrap_tokens enable row level security;
insert into public.admin_bootstrap_tokens(token_hash, expires_at)
values ('67886b9dcb61ca7cfe567da5273065ef94fdbc846f144490db711aad190ada56', now() + interval '24 hours')
on conflict (token_hash) do nothing;
