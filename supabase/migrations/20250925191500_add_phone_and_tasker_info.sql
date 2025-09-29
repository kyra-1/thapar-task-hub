-- Add phone number to users table for communication
alter table public.users add column if not exists phone text;

-- Update the handle_new_user function to include the phone number on sign up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    nullif(new.raw_user_meta_data->>'phone',''),
    'both'
  )
  on conflict (id) do nothing; -- avoid duplicate errors
  return new;
end;
$$;

-- Re-apply the trigger to ensure it's using the latest function definition
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();