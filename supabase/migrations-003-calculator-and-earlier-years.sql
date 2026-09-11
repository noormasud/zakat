-- ============================================================
-- 003 — Zakat calculator, and backfilling years that predate
--       the day you started using the app.
-- ============================================================

create extension if not exists pgcrypto;

-- ---- assets behind a year's figure --------------------------
create table if not exists public.zakat_assets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  year_id    uuid not null references public.zakat_years(id) on delete cascade,
  name       text not null default '',
  category   text not null default 'cash',
  value      numeric(14,2) not null default 0,
  rate       numeric(6,3)  not null default 2.5,
  deducts    boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists zakat_assets_year_idx
  on public.zakat_assets(year_id, position);

alter table public.zakat_assets enable row level security;

drop policy if exists "own assets read"   on public.zakat_assets;
drop policy if exists "own assets insert" on public.zakat_assets;
drop policy if exists "own assets write"  on public.zakat_assets;
drop policy if exists "own assets delete" on public.zakat_assets;

create policy "own assets read"   on public.zakat_assets for select using (auth.uid() = user_id);
create policy "own assets insert" on public.zakat_assets for insert with check (auth.uid() = user_id);
create policy "own assets write"  on public.zakat_assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own assets delete" on public.zakat_assets for delete using (auth.uid() = user_id);

-- ---- add a year before your earliest one --------------------
-- Year numbers shift up by one so the sequence stays in order, and the
-- amount already paid is recorded as a single opening entry.
create or replace function public.add_previous_year(p_due numeric, p_paid numeric)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  earliest  public.zakat_years%rowtype;
  new_year  public.zakat_years%rowtype;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_due < 0 or p_paid < 0 then raise exception 'Amounts cannot be negative.'; end if;

  select * into earliest
    from public.zakat_years
   where user_id = uid
   order by start_date asc
   limit 1;

  if not found then raise exception 'Set up your first Zakat year before adding earlier ones.'; end if;

  -- Shift existing numbering up by one. Postgres checks the unique
  -- constraint per row rather than at statement end, so a straight +1 would
  -- collide as it walks the rows. Park them out of range first.
  update public.zakat_years
     set year_number = year_number + 1000
   where user_id = uid;

  update public.zakat_years
     set year_number = year_number - 999
   where user_id = uid;

  insert into public.zakat_years (user_id, year_number, start_date, end_date, due_amount)
  values (uid, 1, earliest.start_date - 365, earliest.start_date - 1, p_due)
  returning * into new_year;

  if p_paid > 0 then
    insert into public.payments (user_id, year_id, amount, paid_on, description, device)
    values (uid, new_year.id, p_paid, new_year.end_date, 'Recorded from an earlier year', 'Backfilled');
  end if;

  return new_year.id;
end;
$$;

grant execute on function public.add_previous_year(numeric, numeric) to authenticated;
