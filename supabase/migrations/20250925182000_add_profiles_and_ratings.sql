-- Add new columns to users table for profile information
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists avatar_url text;

-- Change price column in tasks from int to numeric for decimal values
alter table public.tasks alter column price type numeric;

-- Create a view to easily query user ratings
create or replace view public.user_ratings as
select
  reviewee_id as user_id,
  avg(rating) as average_rating,
  count(id) as review_count
from
  public.reviews
group by
  reviewee_id;

-- RLS policy for the new view
drop policy if exists "Users can view all ratings" on public.user_ratings;
create policy "Users can view all ratings" on public.user_ratings for
select using (true);
alter table public.user_ratings enable row level security;
