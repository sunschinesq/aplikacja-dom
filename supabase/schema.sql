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

create table if not exists person_pins (
  house uuid not null references houses(id) on delete cascade,
  person text not null,
  pin_hash text not null,
  primary key (house, person)
);
alter table person_pins enable row level security;  -- brak polityk = nikt nie czyta z aplikacji

drop function if exists join_house(text, text);

-- Dołączenie telefonu do domu: kod domu + PIN osoby.
-- Pierwszy telefon z nowym kodem zakłada dom. Pierwszy telefon danej osoby ustawia jej PIN.
-- Telefon już połączony jako ta sama osoba nie musi podawać PIN-u ponownie.
-- Ochrona przed zgadywaniem: maks. 5 nieudanych prób na godzinę na telefon i 20 na dom.
create or replace function join_house(p_code text, p_person text, p_pin text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  h uuid; hash text := encode(digest(lower(trim(p_code)), 'sha256'), 'hex');
  n int; ph text; m members%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'Brak logowania'); end if;
  if p_person not in ('julia', 'franek') then return jsonb_build_object('error', 'Nieznana osoba'); end if;
  if (select count(*) from join_attempts where uid = auth.uid() and at > now() - interval '1 hour') >= 5
     or (select count(*) from join_attempts where at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('error', 'Za dużo błędnych prób. Spróbuj za godzinę.');
  end if;

  select id into h from houses where code_hash = hash;
  if h is null then
    if exists (select 1 from houses) then
      insert into join_attempts(uid) values (auth.uid());
      return jsonb_build_object('error', 'Nie ma domu z takim kodem');
    end if;
    if length(trim(p_code)) < 6 then return jsonb_build_object('error', 'Kod domu musi mieć co najmniej 6 znaków'); end if;
    insert into houses(code_hash) values (hash) returning id into h;
  end if;

  select * into m from members where uid = auth.uid();
  if found and m.house = h and m.person = p_person then
    return jsonb_build_object('house', h);            -- ten telefon jest już tą osobą
  end if;

  select pin_hash into ph from person_pins where house = h and person = p_person;
  if ph is null then
    if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
      return jsonb_build_object('error', 'Ustaw PIN: 4 do 8 cyfr', 'needPin', true);
    end if;
    insert into person_pins(house, person, pin_hash) values (h, p_person, crypt(p_pin, gen_salt('bf')));
  elsif p_pin is null or crypt(p_pin, ph) <> ph then
    insert into join_attempts(uid) values (auth.uid());
    return jsonb_build_object('error', case when p_pin is null then 'Podaj PIN' else 'Zły PIN' end, 'needPin', true);
  end if;

  select count(*) into n from members where house = h and uid <> auth.uid();
  if n >= 6 then return jsonb_build_object('error', 'Ten dom ma już komplet telefonów'); end if;
  insert into members(uid, house, person) values (auth.uid(), h, p_person)
    on conflict (uid) do update set house = excluded.house, person = excluded.person;
  return jsonb_build_object('house', h);
end $$;

grant execute on function join_house(text, text, text) to anon, authenticated;

-- Uprawnienia (nowe projekty Supabase nie nadają ich automatycznie).
-- Dostęp i tak ograniczają reguły RLS powyżej.
grant usage on schema public to anon, authenticated;
grant select, insert, update on table rows to authenticated;
grant select on table members to authenticated;
revoke all on table houses, person_pins, join_attempts from anon, authenticated;

-- Synchronizacja na żywo
do $$ begin
  alter publication supabase_realtime add table rows;
exception when duplicate_object then null; end $$;
