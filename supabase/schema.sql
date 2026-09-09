-- ============================================================
-- Zakat Tracker — Supabase schema
-- Run this once in the Supabase SQL editor.
-- ============================================================

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users on delete cascade,
  username           citext not null unique,
  default_due_amount numeric(14,2) not null default 0,
  year_start         date,
  sheet_id           text,
  created_at         timestamptz not null default now()
);

-- username rules: 3-24 chars, lowercase letters/numbers/underscore
alter table public.profiles
  drop constraint if exists username_format;
alter table public.profiles
  add constraint username_format check (username ~ '^[a-z0-9_]{3,24}$');

-- ------------------------------------------------------------
-- zakat_years
-- ------------------------------------------------------------
create table if not exists public.zakat_years (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  year_number int  not null,
  start_date  date not null,
  end_date    date not null,
  due_amount  numeric(14,2) not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, year_number)
);

create index if not exists zakat_years_user_idx on public.zakat_years(user_id, start_date desc);

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  year_id     uuid not null references public.zakat_years(id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  paid_on     date not null default current_date,
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists payments_year_idx on public.payments(year_id, paid_on desc);
create index if not exists payments_user_idx on public.payments(user_id);

-- ============================================================
-- Triggers
-- ============================================================

-- Create the profile automatically when a user signs up.
-- The username comes from sign-up metadata. If it is taken, the unique
-- constraint fails and the whole sign-up is rolled back — no orphan accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usernames are permanent.
create or replace function public.lock_username()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    raise exception 'Usernames cannot be changed once created.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_username on public.profiles;
create trigger profiles_lock_username
  before update on public.profiles
  for each row execute function public.lock_username();

-- Keep payments.user_id honest.
create or replace function public.stamp_payment_owner()
returns trigger
language plpgsql
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists payments_stamp_owner on public.payments;
create trigger payments_stamp_owner
  before insert on public.payments
  for each row execute function public.stamp_payment_owner();

-- ============================================================
-- RPCs
-- ============================================================

-- Is a username free? Used for live feedback on the sign-up form.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer set search_path = public
as $$
  select not exists (select 1 from public.profiles where username = lower(candidate));
$$;

-- Start the very first Zakat year.
create or replace function public.start_tracking(p_start date, p_due numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;

  update public.profiles
     set year_start = p_start,
         default_due_amount = p_due
   where id = uid;

  insert into public.zakat_years (user_id, year_number, start_date, end_date, due_amount)
  values (uid, 1, p_start, p_start + 364, p_due)
  on conflict (user_id, year_number) do nothing;
end;
$$;

-- Roll forward to today. Creates any missing years, each 365 days long,
-- carrying the user's current due amount. Returns how many were created —
-- the app uses that to announce "a new Zakat year has started".
create or replace function public.ensure_current_year()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  last_year public.zakat_years%rowtype;
  due       numeric(14,2);
  created   int := 0;
begin
  if uid is null then raise exception 'Not signed in.'; end if;

  select default_due_amount into due from public.profiles where id = uid;

  select * into last_year
    from public.zakat_years
   where user_id = uid
   order by year_number desc
   limit 1;

  if not found then return 0; end if;

  while last_year.end_date < current_date loop
    insert into public.zakat_years (user_id, year_number, start_date, end_date, due_amount)
    values (uid,
            last_year.year_number + 1,
            last_year.end_date + 1,
            last_year.end_date + 365,
            coalesce(due, 0))
    returning * into last_year;
    created := created + 1;
  end loop;

  return created;
end;
$$;

-- Change the amount owed. Applies to the year in progress and every year
-- after it. Years that have already closed keep the figure they closed on.
create or replace function public.set_due_amount(p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_amount < 0 then raise exception 'Amount cannot be negative.'; end if;

  update public.profiles set default_due_amount = p_amount where id = uid;

  update public.zakat_years
     set due_amount = p_amount
   where user_id = uid
     and end_date >= current_date;
end;
$$;

-- ============================================================
-- Row level security — every user sees only their own rows
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.zakat_years enable row level security;
alter table public.payments    enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile write"  on public.profiles;
create policy "own profile read"  on public.profiles for select using (auth.uid() = id);
create policy "own profile write" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own years read"   on public.zakat_years;
drop policy if exists "own years write"  on public.zakat_years;
drop policy if exists "own years insert" on public.zakat_years;
create policy "own years read"   on public.zakat_years for select using (auth.uid() = user_id);
create policy "own years insert" on public.zakat_years for insert with check (auth.uid() = user_id);
create policy "own years write"  on public.zakat_years for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own payments read"   on public.payments;
drop policy if exists "own payments insert" on public.payments;
drop policy if exists "own payments write"  on public.payments;
drop policy if exists "own payments delete" on public.payments;
create policy "own payments read"   on public.payments for select using (auth.uid() = user_id);
create policy "own payments insert" on public.payments for insert with check (auth.uid() = user_id);
create policy "own payments write"  on public.payments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own payments delete" on public.payments for delete using (auth.uid() = user_id);

-- ============================================================
-- Grants
-- ============================================================
grant execute on function public.username_available(text)  to anon, authenticated;
grant execute on function public.start_tracking(date, numeric) to authenticated;
grant execute on function public.ensure_current_year()     to authenticated;
grant execute on function public.set_due_amount(numeric)   to authenticated;
