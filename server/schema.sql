-- Scooter-Nav API — Postgres-schema. Draai dit één keer op je database.
-- (Geen RLS nodig: de API is de poortwachter, niet de browser direct.)

create extension if not exists pgcrypto;  -- voor gen_random_uuid() op oudere Postgres

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in
    ('politie','rollerbank','hulpdienst','gevaarlijk_wegdek','wegafsluiting')),
  lng double precision not null,
  lat double precision not null,
  path jsonb,                       -- alleen bij wegafsluiting: [[lng,lat], ...]
  created_at timestamptz not null default now()
);

create index if not exists reports_bbox_idx on reports (lng, lat);

-- Gebruikers (via "Inloggen met Google"). We slaan GEEN wachtwoorden op — alleen de
-- stabiele Google-account-id + e-mail (voor contact/verwijderrecht).
create table if not exists users (
  sub text primary key,             -- Google "sub" (account-id)
  email text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists report_votes (
  report_id uuid not null references reports(id) on delete cascade,
  voter_id text not null,           -- anoniem apparaat-id
  still_there boolean not null,
  created_at timestamptz not null default now(),
  primary key (report_id, voter_id) -- één stem per gebruiker per melding
);

-- Automatisch verwijderen na 5 verschillende "weg"-stemmen.
create or replace function delete_if_reopened() returns trigger
language plpgsql as $$
begin
  if (select count(*) from report_votes
      where report_id = new.report_id and still_there = false) >= 5 then
    delete from reports where id = new.report_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_delete_if_reopened on report_votes;
create trigger trg_delete_if_reopened
  after insert or update on report_votes
  for each row execute function delete_if_reopened();
