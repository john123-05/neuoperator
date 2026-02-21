create table if not exists public.email_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null default '',
  name text not null default '',
  firma text not null default '',
  attractionstyp text not null default '',
  frage text not null default '',
  antwort text not null default '',
  spalte_1 text not null default '',
  submitted_at timestamptz not null default now(),
  import_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_leads_submitted_at_desc
  on public.email_leads (submitted_at desc);

create or replace function public.email_leads_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_email_leads_updated on public.email_leads;
create trigger on_email_leads_updated
  before update on public.email_leads
  for each row execute function public.email_leads_set_updated_at();
