-- ZUCA Ops — схем v2
-- Supabase → SQL Editor дээр бүтнээр нь paste хийж "Run" дарна.
-- Дахин ажиллуулахад аюулгүй. v1-ээс шилжихэд өгөгдөл устахгүй.

create extension if not exists "pgcrypto";

-- ───────────────────────── Enums ─────────────────────────
do $$ begin
  create type task_status   as enum ('todo', 'in_progress', 'review', 'done');
exception when duplicate_object then null; end $$;
do $$ begin
  create type task_priority as enum ('urgent', 'high', 'medium', 'low');
exception when duplicate_object then null; end $$;
do $$ begin
  create type camp_stage    as enum ('lead', 'contacted', 'onboarding', 'active', 'inactive');
exception when duplicate_object then null; end $$;
do $$ begin
  create type camp_season   as enum ('summer', 'autumn', 'all_year');
exception when duplicate_object then null; end $$;

-- ───────────────────────── Ажилчид (profiles) ─────────────────────────
-- Ажилтныг нэвтрэх эрхгүйгээр бүртгэж, ажил хариуцуулж болно.
-- Тухайн хүн ижил имэйлээр бүртгүүлэхэд auth.users-тэй автоматаар холбогдоно.
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  full_name   text not null default '',
  email       text not null default '',
  phone       text,
  job_title   text,
  color       text not null default '#4f46e5',
  role        text not null default 'member' check (role in ('admin', 'member')),
  active      boolean not null default true,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── v1 → v2 шилжилт (хуучин суулгац дээр л үйлчилнэ) ──
alter table public.profiles add column if not exists user_id    uuid;
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists job_title  text;
alter table public.profiles add column if not exists active     boolean not null default true;
alter table public.profiles add column if not exists note       text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles alter column id set default gen_random_uuid();

-- v1-д profiles.id нь auth.users.id байсан. Тэр хамаарлыг салгана.
do $$
declare cname text;
begin
  select con.conname into cname
    from pg_constraint con
   where con.conrelid  = 'public.profiles'::regclass
     and con.contype   = 'f'
     and con.confrelid = 'auth.users'::regclass
     and con.conkey    = array[(select attnum from pg_attribute
                                 where attrelid = 'public.profiles'::regclass
                                   and attname = 'id' and not attisdropped)];
  if cname is not null then
    execute format('alter table public.profiles drop constraint %I', cname);
  end if;
end $$;

-- Хуучин мөрүүдийн user_id-г нөхнө
update public.profiles p
   set user_id = p.id
 where p.user_id is null
   and exists (select 1 from auth.users u where u.id = p.id);

-- user_id → auth.users. Нэг auth хэрэглэгч нэг л ажилтны мөртэй.
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'profiles_user_id_fkey'
                    and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles
      add constraint profiles_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete set null;
  end if;
end $$;

-- NULL олон байж болно → нэвтрэх эрхгүй ажилчид хязгааргүй
create unique index if not exists profiles_user_id_key on public.profiles (user_id);
create index if not exists profiles_active_idx on public.profiles (active, full_name);

-- Шинэ хэрэглэгч бүртгүүлэхэд: ижил имэйлтэй ажилтан байвал холбоно, үгүй бол шинээр үүсгэнэ
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nm text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
begin
  update public.profiles
     set user_id   = new.id,
         full_name = case when full_name = '' then nm else full_name end,
         email     = new.email,
         active    = true
   where user_id is null
     and lower(email) = lower(new.email);

  if not found then
    insert into public.profiles (user_id, full_name, email)
    values (new.id, nm, new.email);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Camps ─────────────────────────
create table if not exists public.camps (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  stage              camp_stage not null default 'lead',
  season             camp_season not null default 'summer',
  aimag              text,
  soum               text,
  address            text,
  lat                double precision,
  lng                double precision,
  contact_person     text,
  phone              text,
  email              text,
  website            text,
  facebook           text,
  age_min            int check (age_min is null or age_min between 0 and 25),
  age_max            int check (age_max is null or age_max between 0 and 25),
  capacity           int check (capacity is null or capacity >= 0),
  price_from         int check (price_from is null or price_from >= 0),
  description        text,
  photos_count       int not null default 0,
  has_contract       boolean not null default false,
  notes              text,
  position           double precision not null default 0,
  owner_id           uuid references public.profiles (id) on delete set null,
  zuca_id            int,
  zuca_slug          text,
  last_contacted_at  timestamptz,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Зуслан бүр хариуцагчтай байж болно
alter table public.camps add column if not exists owner_id uuid references public.profiles (id) on delete set null;

-- zuca.mn дээрх жагсаалттай холбох (давхар импорт хийхээс сэргийлнэ)
alter table public.camps add column if not exists zuca_id   int;
alter table public.camps add column if not exists zuca_slug text;
create unique index if not exists camps_zuca_slug_key on public.camps (zuca_slug);

-- v2: МҮЗХ жагсаалтын талбарууд (хуучин схем дээр дахин ажиллуулахад нэмэгдэнэ)
alter table public.camps add column if not exists ownership text
  check (ownership is null or ownership in ('state', 'local', 'private', 'labor', 'org'));
alter table public.camps add column if not exists register_no text;
alter table public.camps add column if not exists founded_year int;
alter table public.camps add column if not exists distance_km double precision;

create index if not exists camps_stage_idx on public.camps (stage, position);
create index if not exists camps_aimag_idx on public.camps (aimag);
create index if not exists camps_owner_idx on public.camps (owner_id);

-- ───────────────────────── Tasks ─────────────────────────
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        task_status not null default 'todo',
  priority      task_priority not null default 'medium',
  position      double precision not null default 0,
  assignee_id   uuid references public.profiles (id) on delete set null,
  camp_id       uuid references public.camps (id) on delete set null,
  due_date      date,
  tags          text[] not null default '{}',
  completed_at  timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- v3: сар/улирал/жилийн төлөвлөгөө
alter table public.tasks add column if not exists planned_month text
  check (planned_month is null or planned_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
create index if not exists tasks_planned_month_idx on public.tasks (planned_month);
-- Хугацаатай хуучин ажлуудыг тэр сарын төлөвлөгөөнд оруулна
update public.tasks set planned_month = to_char(due_date, 'YYYY-MM')
 where planned_month is null and due_date is not null;

create index if not exists tasks_status_idx   on public.tasks (status, position);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_camp_idx     on public.tasks (camp_id);

-- ───────────────────────── Triggers ─────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists camps_touch on public.camps;
create trigger camps_touch before update on public.camps
  for each row execute function public.touch_updated_at();

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Task "done" болоход completed_at автоматаар тавигдана
create or replace function public.task_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists tasks_completed on public.tasks;
create trigger tasks_completed before insert or update of status on public.tasks
  for each row execute function public.task_completed_at();

-- created_by-г нэвтэрсэн хэрэглэгчийн ажилтны мөрөөр бөглөнө
-- (auth.uid() нь auth.users.id тул profiles.id руу хөрвүүлнэ)
create or replace function public.set_created_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    select p.id into new.created_by from public.profiles p where p.user_id = auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists camps_created_by on public.camps;
create trigger camps_created_by before insert on public.camps
  for each row execute function public.set_created_by();

drop trigger if exists tasks_created_by on public.tasks;
create trigger tasks_created_by before insert on public.tasks
  for each row execute function public.set_created_by();

-- ───────────────────────── RLS ─────────────────────────
-- Дотоод багийн хэрэгсэл: нэвтэрсэн бүх гишүүн бүгдийг харж, засна (CRUD).
alter table public.profiles enable row level security;
alter table public.camps    enable row level security;
alter table public.tasks    enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
drop policy if exists "profiles all"    on public.profiles;
create policy "profiles all" on public.profiles for all to authenticated using (true) with check (true);

drop policy if exists "camps all" on public.camps;
create policy "camps all" on public.camps for all to authenticated using (true) with check (true);

drop policy if exists "tasks all" on public.tasks;
create policy "tasks all" on public.tasks for all to authenticated using (true) with check (true);

-- ───────────────────────── Realtime ─────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.camps;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when others then null; end $$;
