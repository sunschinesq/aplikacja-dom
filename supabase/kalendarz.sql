-- Nasz dom: automatyczne pobieranie kalendarzy (ICS): praca → grafik, studia → zajęcia.
-- Uruchom po powiadomienia.sql (SQL Editor → Run).
create table if not exists calendar_feeds (
  house uuid not null references houses(id) on delete cascade,
  person text not null,
  kind text not null default 'praca' check (kind in ('praca', 'studia')),
  url text not null,
  place text,
  last_sync timestamptz,
  last_info text,
  primary key (house, person, kind)
);
alter table calendar_feeds enable row level security;   -- linki widzi tylko serwer
revoke all on table calendar_feeds from anon, authenticated;
grant all on table calendar_feeds to service_role;

-- co 3 godziny (minuta 17)
select cron.schedule('naszdom-kalendarz', '17 */3 * * *', $$ select notify_call('{"action":"feeds"}'::jsonb) $$);
