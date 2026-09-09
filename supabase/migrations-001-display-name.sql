-- Run this in the SQL editor if you already ran schema.sql before
-- display names existed.

alter table public.profiles add column if not exists display_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id,
          lower(new.raw_user_meta_data->>'username'),
          nullif(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;
