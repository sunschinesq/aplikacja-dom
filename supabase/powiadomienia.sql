-- Nasz dom: powiadomienia. Uruchom po schema.sql (SQL Editor → Run).
-- Potem ustaw adres funkcji (patrz INSTRUKCJA.md):
--   update push_config set fn_url = 'https://TWOJ-PROJEKT.supabase.co/functions/v1/notify';

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists push_config (
  id int primary key default 1 check (id = 1),
  fn_url text,
  hook_secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  vapid jsonb                                   -- klucze VAPID, generuje je funkcja przy pierwszym uruchomieniu
);
insert into push_config (id) values (1) on conflict do nothing;

create table if not exists push_subs (
  endpoint text primary key,
  uid uuid not null,
  house uuid not null references houses(id) on delete cascade,
  person text not null,
  sub jsonb not null,
  created_at timestamptz default now()
);
create table if not exists push_throttle (key text primary key, at timestamptz not null);

alter table push_config enable row level security;
alter table push_subs enable row level security;
alter table push_throttle enable row level security;

drop policy if exists "subs own" on push_subs;
create policy "subs own" on push_subs for all using (uid = auth.uid())
  with check (uid = auth.uid() and house = my_house() and person = my_person());
grant select, insert, update, delete on table push_subs to authenticated;
revoke all on table push_config, push_throttle from anon, authenticated;

-- Wywołanie funkcji „notify” z bazy (z sekretem, którego aplikacja nie zna)
create or replace function notify_call(p_body jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare c push_config;
begin
  select * into c from push_config where id = 1;
  if c.fn_url is null then return; end if;
  perform net.http_post(url := c.fn_url, body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook', c.hook_secret),
    timeout_milliseconds := 8000);
end $$;
revoke execute on function notify_call(jsonb) from public, anon, authenticated;

create or replace function rows_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_call(jsonb_build_object('action', 'row', 'row', to_jsonb(new)));
  return null;
end $$;

drop trigger if exists rows_notify on rows;
create trigger rows_notify after insert on rows for each row
  when (new.coll in ('notes', 'expenses', 'shopping')) execute function rows_notify();

-- Harmonogram (czas UTC): rano ok. 8:30, wieczorem ok. 19:30 czasu polskiego (zimą)
select cron.schedule('naszdom-rano', '30 7 * * *', $$ select notify_call('{"action":"daily"}'::jsonb) $$);
select cron.schedule('naszdom-wieczor', '30 18 * * *', $$ select notify_call('{"action":"evening"}'::jsonb) $$);
