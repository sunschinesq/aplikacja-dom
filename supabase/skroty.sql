-- Nasz dom: klucze do skrótów Siri. Uruchom po kalendarz.sql (SQL Editor → Run).
create table if not exists shortcut_tokens (
  token_hash text primary key,
  house uuid not null references houses(id) on delete cascade,
  person text not null,
  created_at timestamptz default now()
);
alter table shortcut_tokens enable row level security;   -- tylko serwer
revoke all on table shortcut_tokens from anon, authenticated;
grant all on table shortcut_tokens to service_role;
