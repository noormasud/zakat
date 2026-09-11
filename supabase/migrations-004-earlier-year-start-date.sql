-- ============================================================
-- 004 — Choose which year you are backfilling.
--
-- Replaces add_previous_year(numeric, numeric) with a version that
-- takes the start date, so the year is explicit rather than assumed to
-- be exactly 365 days before your earliest one.
--
-- Safe to run even if 003 already succeeded.
-- ============================================================

drop function if exists public.add_previous_year(numeric, numeric);
drop function if exists public.add_previous_year(date, numeric, numeric);

create function public.add_previous_year(
  p_start date,
  p_due   numeric,
  p_paid  numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  earliest date;
  new_year public.zakat_years%rowtype;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_due < 0 or p_paid < 0 then raise exception 'Amounts cannot be negative.'; end if;

  select min(start_date) into earliest
    from public.zakat_years where user_id = uid;

  if earliest is null then
    raise exception 'Set up your first Zakat year before adding earlier ones.';
  end if;

  if p_start >= earliest then
    raise exception 'An earlier year has to start before %.', earliest;
  end if;

  if p_start + 364 >= earliest then
    raise exception 'That year would run into the one starting %. Choose an earlier date.', earliest;
  end if;

  -- Park the existing numbering out of range. Postgres checks the unique
  -- constraint per row, so renumbering in place would collide mid-statement.
  update public.zakat_years
     set year_number = year_number + 10000
   where user_id = uid;

  insert into public.zakat_years (user_id, year_number, start_date, end_date, due_amount)
  values (uid, 20000, p_start, p_start + 364, p_due)
  returning * into new_year;

  -- Renumber everything by date, so the sequence always reads in order
  -- however many years get slotted in later.
  with ordered as (
    select id, row_number() over (order by start_date) as rn
      from public.zakat_years
     where user_id = uid
  )
  update public.zakat_years z
     set year_number = o.rn
    from ordered o
   where z.id = o.id;

  if p_paid > 0 then
    insert into public.payments (user_id, year_id, amount, paid_on, description, device)
    values (uid, new_year.id, p_paid, p_start + 364, 'Recorded from an earlier year', 'Backfilled');
  end if;

  return new_year.id;
end;
$$;

grant execute on function public.add_previous_year(date, numeric, numeric) to authenticated;

-- Make PostgREST pick up the new signature immediately.
notify pgrst, 'reload schema';
