-- JobLens · initial schema (run once on Postgres bootstrap)
-- V1 only persists shared_results; clean-up handled by the cron container.

create table if not exists shared_results (
  id          text primary key,
  context     jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  view_count  int not null default 0
);

create index if not exists shared_results_expires_at_idx
  on shared_results (expires_at);
