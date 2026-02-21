create table if not exists public.website_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  company text not null default '',
  country text not null default '',
  project_type text not null default '',
  referral_source text not null default '',
  message text not null default '',
  submitted_at timestamptz not null default now(),
  source text not null default '',
  user_agent text not null default '',
  url text not null default '',
  import_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_website_requests_submitted_at_desc
  on public.website_requests (submitted_at desc);

create or replace function public.website_requests_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_website_requests_updated on public.website_requests;
create trigger on_website_requests_updated
  before update on public.website_requests
  for each row execute function public.website_requests_set_updated_at();
