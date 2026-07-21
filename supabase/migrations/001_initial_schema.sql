-- 诗三百：用户、诗篇与收藏
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname varchar(40) not null,
  avatar_url text,
  bio varchar(200),
  status smallint not null default 1 check (status in (0, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.poems (
  id smallint primary key check (id between 1 and 305),
  slug varchar(100) not null unique,
  title varchar(100) not null,
  chapter varchar(20) not null,
  section varchar(50) not null,
  content jsonb not null check (jsonb_typeof(content) = 'array'),
  annotation text,
  translation text,
  sort_order smallint not null unique,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  poem_id smallint not null references public.poems(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_poem_unique unique (user_id, poem_id)
);

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);
create index if not exists favorites_poem_idx
  on public.favorites (poem_id);
create index if not exists poems_chapter_section_idx
  on public.poems (chapter, section, sort_order);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, nickname)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nickname', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger poems_updated_at
before update on public.poems
for each row execute function public.set_updated_at();

-- 新用户注册后自动创建业务资料
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.user_profiles enable row level security;
alter table public.poems enable row level security;
alter table public.favorites enable row level security;

create policy "read published poems"
on public.poems for select
to anon, authenticated
using (is_published = true);

create policy "users read own profile"
on public.user_profiles for select
to authenticated
using (auth.uid() = id);

create policy "users update own profile"
on public.user_profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users read own favorites"
on public.favorites for select
to authenticated
using (auth.uid() = user_id);

create policy "users insert own favorites"
on public.favorites for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users delete own favorites"
on public.favorites for delete
to authenticated
using (auth.uid() = user_id);

-- API 角色权限；实际数据访问仍受 RLS 限制
grant select on public.poems to anon, authenticated;
grant select, update on public.user_profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant usage, select on sequence public.favorites_id_seq to authenticated;
