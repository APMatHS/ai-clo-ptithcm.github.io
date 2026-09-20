create unique index if not exists admin_bootstrap_tokens_single_active_idx on public.admin_bootstrap_tokens((used_at is null)) where used_at is null;
