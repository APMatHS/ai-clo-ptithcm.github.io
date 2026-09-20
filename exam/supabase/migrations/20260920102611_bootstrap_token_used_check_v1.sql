alter table public.admin_bootstrap_tokens drop constraint if exists admin_bootstrap_tokens_used_after_created_chk;
alter table public.admin_bootstrap_tokens add constraint admin_bootstrap_tokens_used_after_created_chk check (used_at is null or used_at >= created_at);
