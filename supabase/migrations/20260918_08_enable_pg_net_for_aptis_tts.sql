-- AI-CLO Aptis Lab
-- Dependency used for one-time/internal asynchronous calls to Edge Functions.
-- Production already has this extension enabled.
-- This migration is idempotent and does not enqueue or regenerate any audio.

create extension if not exists pg_net with schema extensions;
