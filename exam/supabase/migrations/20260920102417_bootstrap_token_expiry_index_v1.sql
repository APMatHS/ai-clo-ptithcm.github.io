create index if not exists admin_bootstrap_tokens_active_idx on public.admin_bootstrap_tokens(expires_at) where used_at is null;
