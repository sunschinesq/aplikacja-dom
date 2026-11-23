-- Nasz dom: baza danych. Wklej całość w Supabase → SQL Editor → Run.

create extension if not exists pgcrypto;

create table if not exists houses (
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null,
  created_at timestamptz default now()
);

create table if not exists members (
  uid uuid primary key,              -- anonimowy użytkownik (jeden telefon)
  house uuid not null references houses(id) on delete cascade,
  person text not null check (person in ('julia', 'franek')),
  joined_at timestamptz default now()
);

create table if not exists join_attempts (uid uuid, at timestamptz default now());

create table if not exists rows (
  house uuid not null references houses(id) on delete cascade,
  coll text not null,
  id text not null,
  data jsonb not null,
  ts bigint not null,
  owner text,                         -- ustawione = prywatne (widzi tylko ta osoba)
  primary key (house, coll, id)
);

alter table houses enable row level security;
alter table members enable row level security;
alter table join_attempts enable row level security;
alter table rows enable row level security;

create or replace function my_house() returns uuid language sql stable security definer set search_path = public as
  $$ select house from members where uid = auth.uid() $$;
create or replace function my_person() returns text language sql stable security definer set search_path = public as
  $$ select person from members where uid = auth.uid() $$;

drop policy if exists "rows read" on rows;
drop policy if exists "rows insert" on rows;
drop policy if exists "rows update" on rows;
create policy "rows read" on rows for select using (house = my_house() and (owner is null or owner = my_person()));
create policy "rows insert" on rows for insert with check (house = my_house() and (owner is null or owner = my_person()));
create policy "rows update" on rows for update using (house = my_house() and (owner is null or owner = my_person()))
  with check (house = my_house() and (owner is null or owner = my_person()));

drop policy if exists "members self" on members;
create policy "members self" on members for select using (uid = auth.uid());

-- Dołączenie do domu kodem. Pierwszy telefon z nowym kodem zakłada dom.
-- Ochrona przed zgadywaniem: maks. 5 nieudanych prób na godzinę i maks. 6 telefonów w domu.
create or replace function join_house(p_code text, p_person text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare h uuid; hash text := encode(digest(lower(trim(p_code)), 'sha256'), 'hex'); n int;
begin
  if auth.uid() is null then raise exception 'Brak logowania'; end if;
  if length(trim(p_code)) < 4 then raise exception 'Kod musi mieć co najmniej 4 znaki'; end if;
  if (select count(*) from join_attempts where at > now() - interval '1 hour') > 30 then
    raise exception 'Za dużo prób. Spróbuj za godzinę.'; end if;
  select id into h from houses where code_hash = hash;
  if h is null then
    if exists (select 1 from houses) then
      insert into join_attempts(uid) values (auth.uid());
      return null;  -- zły kod (bez wyjątku, żeby próba została zapisana)
    end if;
    insert into houses(code_hash) values (hash) returning id into h;   -- pierwszy i jedyny dom
  end if;
  select count(*) into n from members where house = h and uid <> auth.uid();
  if n >= 6 then raise exception 'Ten dom ma już komplet telefonów'; end if;
  insert into members(uid, house, person) values (auth.uid(), h, coalesce(p_person, 'julia'))
    on conflict (uid) do update set house = excluded.house, person = excluded.person;
  return h;
end $$;

grant execute on function join_house(text, text) to anon, authenticated;

-- Synchronizacja na żywo
do $$ begin
  alter publication supabase_realtime add table rows;
exception when duplicate_object then null; end $$;
