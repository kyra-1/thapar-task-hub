-- USERS TABLE (extends Supabase Auth users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text check (role in ('poster','tasker','both')) default 'both',
  created_at timestamp with time zone default now()
);

-- TASKS TABLE
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  price int not null check (price >= 0),
  status text check (status in ('open','accepted','completed')) default 'open',
  deadline timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- TASK ASSIGNMENTS TABLE (links tasker to task)
create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  tasker_id uuid not null references public.users(id) on delete cascade,
  accepted_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- REVIEWS TABLE (ratings + comments)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete cascade,
  reviewee_id uuid not null references public.users(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamp with time zone default now()
);

-- WALLET / TRANSACTIONS TABLE (optional for MVP)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount int not null,
  description text,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.reviews enable row level security;
alter table public.transactions enable row level security;

-- RLS POLICIES for USERS
create policy "Users can view all profiles" on public.users for select using (true);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.users for insert with check (auth.uid() = id);

-- RLS POLICIES for TASKS
create policy "Anyone can view open tasks" on public.tasks for select using (true);
create policy "Posters can create tasks" on public.tasks for insert with check (auth.uid() = poster_id);
create policy "Posters can update own tasks" on public.tasks for update using (auth.uid() = poster_id);
create policy "Posters can delete own tasks" on public.tasks for delete using (auth.uid() = poster_id);

-- RLS POLICIES for TASK_ASSIGNMENTS
create policy "Users can view assignments for their tasks or assignments" on public.task_assignments 
for select using (
  auth.uid() = tasker_id or 
  auth.uid() in (select poster_id from public.tasks where id = task_id)
);
create policy "Taskers can create assignments" on public.task_assignments 
for insert with check (auth.uid() = tasker_id);
create policy "Taskers can update their assignments" on public.task_assignments 
for update using (auth.uid() = tasker_id);

-- RLS POLICIES for REVIEWS
create policy "Users can view all reviews" on public.reviews for select using (true);
create policy "Users can create reviews for completed tasks" on public.reviews 
for insert with check (
  auth.uid() = reviewer_id and
  exists (
    select 1 from public.task_assignments ta
    join public.tasks t on ta.task_id = t.id
    where ta.task_id = task_id and ta.completed_at is not null
    and (auth.uid() = t.poster_id or auth.uid() = ta.tasker_id)
  )
);

-- RLS POLICIES for TRANSACTIONS
create policy "Users can view own transactions" on public.transactions 
for select using (auth.uid() = user_id);
create policy "Users can create own transactions" on public.transactions 
for insert with check (auth.uid() = user_id);

-- Function to handle new user registration
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'both'
  );
  return new;
end;
$$;

-- Trigger to automatically create user profile
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();