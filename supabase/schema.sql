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

-- ═════════════════════════ v4: Байгууллага (хэлтэс, эрх, хүсэлт, өдрийн тайлан, AI агент) ═════════════════════════

-- ── Эрхийн түвшин: admin · director (удирдлага) · manager (хэлтсийн дарга) · member ──
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'director', 'manager', 'member'));

-- ── Хэлтэс ──
create table if not exists public.departments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  code         text,
  color        text not null default '#4f46e5',
  description  text,
  head_id      uuid references public.profiles (id) on delete set null,
  parent_id    uuid references public.departments (id) on delete set null,
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles add column if not exists department_id    uuid references public.departments (id) on delete set null;
alter table public.profiles add column if not exists telegram_chat_id text;
alter table public.profiles add column if not exists notify_email     boolean not null default true;
alter table public.profiles add column if not exists notify_telegram  boolean not null default true;
create unique index if not exists profiles_telegram_key on public.profiles (telegram_chat_id);
create index if not exists profiles_department_idx on public.profiles (department_id);

-- Ажил аль хэлтэст хамаарах, аль хэлтсээс хүсэлтээр ирсэн
alter table public.tasks add column if not exists department_id      uuid references public.departments (id) on delete set null;
alter table public.tasks add column if not exists from_department_id uuid references public.departments (id) on delete set null;
create index if not exists tasks_department_idx on public.tasks (department_id);

-- ── Батлуулах хүсэлт ──
create table if not exists public.approvals (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null default 'general' check (kind in ('leave', 'purchase', 'expense', 'trip', 'general')),
  title          text not null,
  description    text,
  amount         bigint check (amount is null or amount >= 0),
  start_date     date,
  end_date       date,
  requester_id   uuid not null references public.profiles (id) on delete cascade,
  department_id  uuid references public.departments (id) on delete set null,
  approver_id    uuid references public.profiles (id) on delete set null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note  text,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists approvals_approver_idx on public.approvals (approver_id, status);
create index if not exists approvals_requester_idx on public.approvals (requester_id);

-- ── Өдөр тутмын тайлан ──
create table if not exists public.daily_reports (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  date        date not null,
  done        text not null default '',
  plan        text,
  blockers    text,
  hours       numeric(4, 1) check (hours is null or hours between 0 and 24),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, date)
);
create index if not exists daily_reports_date_idx on public.daily_reports (date);

-- ── AI агентын илгээлтийн түүх ──
create table if not exists public.agent_runs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles (id) on delete set null,
  kind        text not null check (kind in ('digest', 'organize')),
  channel     text not null check (channel in ('email', 'telegram', 'preview')),
  ok          boolean not null default true,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists agent_runs_created_idx on public.agent_runs (created_at desc);

drop trigger if exists departments_touch on public.departments;
create trigger departments_touch before update on public.departments
  for each row execute function public.touch_updated_at();
drop trigger if exists approvals_touch on public.approvals;
create trigger approvals_touch before update on public.approvals
  for each row execute function public.touch_updated_at();
drop trigger if exists daily_reports_touch on public.daily_reports;
create trigger daily_reports_touch before update on public.daily_reports
  for each row execute function public.touch_updated_at();

-- ── Эрхийн туслах функцүүд (security definer → RLS дотроос profiles-ийг рекурсгүй уншина) ──
create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where user_id = auth.uid()), 'member')
$$;

create or replace function public.is_leader()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'director')
$$;

/** Тухайн хэлтсийн дарга эсвэл удирдлага мөн эсэх */
create or replace function public.manages_dept(dept uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_leader() or exists (
    select 1 from public.departments d
     where d.id = dept
       and (d.head_id = public.my_profile_id()
            or (public.my_role() = 'manager'
                and d.id = (select department_id from public.profiles where user_id = auth.uid())))
  )
$$;

-- Эрх нэмэгдүүлэхээс хамгаална: role-ийг зөвхөн admin (эсвэл director — өөрөөсөө доош) өөрчилнө.
-- Анхны суулгацад admin огт байхгүй бол нэвтэрсэн хүн өөрийгөө admin болгож болно.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor text := public.my_role();
begin
  if auth.uid() is null then return new; end if;                -- service role (cron, webhook)
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then return new; end if;
  if not exists (select 1 from public.profiles where role = 'admin') then return new; end if;
  if actor = 'admin' then return new; end if;
  if actor = 'director' and new.role in ('manager', 'member')
     and (tg_op = 'INSERT' or old.role in ('manager', 'member')) then return new; end if;
  if tg_op = 'INSERT' then
    new.role := 'member';                                        -- өөрийгөө өндөр эрхтэй үүсгэхгүй
    return new;
  end if;
  raise exception 'Эрхийн түвшин өөрчлөх эрхгүй байна';
end $$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before insert or update of role on public.profiles
  for each row execute function public.guard_profile_role();

-- Хүсэлтийг зөвхөн батлагч (эсвэл admin/director) батална; хүсэгч зөвхөн цуцална
create or replace function public.guard_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_profile_id();
begin
  if auth.uid() is null or new.status is not distinct from old.status then return new; end if;
  if new.status = 'cancelled' and old.requester_id = me and old.status = 'pending' then return new; end if;
  if new.status in ('approved', 'rejected') and old.status = 'pending' and old.requester_id is distinct from me
     and (old.approver_id = me or public.is_leader()) then
    new.decided_at := now();
    return new;
  end if;
  raise exception 'Энэ хүсэлтийн төлөвийг өөрчлөх эрхгүй';
end $$;

drop trigger if exists approvals_guard on public.approvals;
create trigger approvals_guard before update on public.approvals
  for each row execute function public.guard_approval();

-- ── RLS ──
alter table public.departments   enable row level security;
alter table public.approvals     enable row level security;
alter table public.daily_reports enable row level security;
alter table public.agent_runs    enable row level security;

-- Ажилчид: бүгд харна. Нэмэх/устгах — дарга ба түүнээс дээш. Засах — өөрийгөө, хэлтсийн дарга, удирдлага.
drop policy if exists "profiles all"    on public.profiles;
drop policy if exists "profiles select" on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
drop policy if exists "profiles delete" on public.profiles;
create policy "profiles select" on public.profiles for select to authenticated using (true);
create policy "profiles insert" on public.profiles for insert to authenticated
  with check (public.my_role() in ('admin', 'director', 'manager') or user_id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated
  using (user_id = auth.uid() or public.is_leader() or public.manages_dept(department_id)
         or (user_id is null and email <> '' and lower(email) = lower(auth.jwt() ->> 'email')));
create policy "profiles delete" on public.profiles for delete to authenticated
  using (public.is_leader() or public.manages_dept(department_id));

drop policy if exists "departments select" on public.departments;
drop policy if exists "departments write"  on public.departments;
drop policy if exists "departments head"   on public.departments;
create policy "departments select" on public.departments for select to authenticated using (true);
create policy "departments write" on public.departments for all to authenticated
  using (public.is_leader()) with check (public.is_leader());
-- Хэлтсийн дарга өөрийн хэлтсийн тайлбар, өнгийг засна
create policy "departments head" on public.departments for update to authenticated
  using (head_id = public.my_profile_id()) with check (head_id = public.my_profile_id());

drop policy if exists "approvals select" on public.approvals;
drop policy if exists "approvals insert" on public.approvals;
drop policy if exists "approvals update" on public.approvals;
drop policy if exists "approvals delete" on public.approvals;
create policy "approvals select" on public.approvals for select to authenticated
  using (requester_id = public.my_profile_id() or approver_id = public.my_profile_id() or public.manages_dept(department_id));
create policy "approvals insert" on public.approvals for insert to authenticated
  with check (requester_id = public.my_profile_id());
create policy "approvals update" on public.approvals for update to authenticated
  using (requester_id = public.my_profile_id() or approver_id = public.my_profile_id() or public.is_leader());
create policy "approvals delete" on public.approvals for delete to authenticated
  using ((requester_id = public.my_profile_id() and status <> 'approved') or public.my_role() = 'admin');

drop policy if exists "daily select" on public.daily_reports;
drop policy if exists "daily write"  on public.daily_reports;
create policy "daily select" on public.daily_reports for select to authenticated
  using (profile_id = public.my_profile_id()
         or public.manages_dept((select department_id from public.profiles p where p.id = profile_id)));
create policy "daily write" on public.daily_reports for all to authenticated
  using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());

drop policy if exists "agent_runs select" on public.agent_runs;
drop policy if exists "agent_runs insert" on public.agent_runs;
create policy "agent_runs select" on public.agent_runs for select to authenticated
  using (profile_id = public.my_profile_id() or public.is_leader());
create policy "agent_runs insert" on public.agent_runs for insert to authenticated with check (true);

do $$ begin
  alter publication supabase_realtime add table public.departments;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.approvals;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.daily_reports;
exception when others then null; end $$;

-- ── Анхны хэлтсүүд (хоосон үед л) ──
insert into public.departments (name, code, color, description, position)
select * from (values
  ('Удирдлага',  'EXEC', '#4f46e5', 'Гүйцэтгэх удирдлага, стратеги',            1000::double precision),
  ('Партнершип', 'PART', '#0891b2', 'Зуслангуудтай хамтын ажиллагаа, гэрээ',    2000),
  ('Маркетинг',  'MKT',  '#ea580c', 'Сурталчилгаа, сошиал, контент',            3000),
  ('Санхүү',     'FIN',  '#16a34a', 'Төлбөр, тооцоо, зардал',                   4000),
  ('Хүний нөөц', 'HR',   '#db2777', 'Ажилтан, цалин, сургалт',                  5000)
) v(name, code, color, description, position)
where not exists (select 1 from public.departments);

-- ═════════════════════════ v5: Чат + AI агент (ажлыг автоматаар барих) ═════════════════════════
-- Slack шиг сувгууд. Мессеж бүрийг AI уншиж, ажил байвал tasks-д автоматаар үүсгэнэ.
-- Имэйл, zuca.mn, Facebook зэрэг гадаад эх үүсвэр /api/intake-ээр «Ирсэн хүсэлт» суваг руу орно.

create table if not exists public.channels (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null,
  description    text,
  kind           text not null default 'team' check (kind in ('team', 'inbox')),
  department_id  uuid references public.departments (id) on delete set null,
  -- auto: ажлыг шууд үүсгэнэ · suggest: санал болгоод хүн батална · mention: зөвхөн @ai · off: унтраалттай
  ai_mode        text not null default 'auto' check (ai_mode in ('auto', 'suggest', 'mention', 'off')),
  position       double precision not null default 0,
  archived       boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists channels_slug_key on public.channels (slug);

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.channels (id) on delete cascade,
  -- user: ажилтан · ai: AI туслах (author_id = түүнийг дуудсан хүн) · system: cron · external: имэйл, zuca.mn гэх мэт
  author_id    uuid references public.profiles (id) on delete set null,
  author_kind  text not null default 'user' check (author_kind in ('user', 'ai', 'system', 'external')),
  author_name  text,
  body         text not null default '',
  reply_to     uuid references public.messages (id) on delete set null,
  source       text not null default 'app',
  source_ref   text,
  ai_state     text check (ai_state is null or ai_state in ('pending', 'done', 'skipped', 'error')),
  task_ids     uuid[] not null default '{}',
  proposals    jsonb,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);
create index if not exists messages_channel_idx on public.messages (channel_id, created_at desc);
-- Гадаад эх үүсвэрээс нэг мессеж хоёр удаа орохгүй
create unique index if not exists messages_source_ref_key on public.messages (source, source_ref) where source_ref is not null;

-- Ажил хаанаас үүссэн: manual · chat · intake · auto (cron) — мөн аль мессежээс
alter table public.tasks add column if not exists source text;
alter table public.tasks add column if not exists source_message_id uuid references public.messages (id) on delete set null;

drop trigger if exists channels_touch on public.channels;
create trigger channels_touch before update on public.channels
  for each row execute function public.touch_updated_at();
drop trigger if exists channels_created_by on public.channels;
create trigger channels_created_by before insert on public.channels
  for each row execute function public.set_created_by();

alter table public.channels enable row level security;
alter table public.messages enable row level security;

drop policy if exists "channels select" on public.channels;
drop policy if exists "channels insert" on public.channels;
drop policy if exists "channels update" on public.channels;
drop policy if exists "channels delete" on public.channels;
create policy "channels select" on public.channels for select to authenticated using (true);
create policy "channels insert" on public.channels for insert to authenticated with check (true);
create policy "channels update" on public.channels for update to authenticated
  using (created_by = public.my_profile_id() or public.is_leader() or public.manages_dept(department_id));
create policy "channels delete" on public.channels for delete to authenticated using (public.is_leader());

drop policy if exists "messages select" on public.messages;
drop policy if exists "messages insert" on public.messages;
drop policy if exists "messages update" on public.messages;
drop policy if exists "messages delete" on public.messages;
create policy "messages select" on public.messages for select to authenticated using (true);
-- Хүн зөвхөн өөрийн нэрээр бичнэ. AI-ийн хариу нь түүнийг дуудсан хүний session-ээр бичигдэнэ.
create policy "messages insert" on public.messages for insert to authenticated
  with check (author_id = public.my_profile_id() and author_kind in ('user', 'ai'));
-- AI/систем мессеж дээрх «Үүсгэх / Алгасах» товчийг баг бүхэлдээ ашиглана
create policy "messages update" on public.messages for update to authenticated
  using (author_id = public.my_profile_id() or author_kind <> 'user' or public.is_leader());
create policy "messages delete" on public.messages for delete to authenticated
  using (author_id = public.my_profile_id() or public.is_leader());

do $$ begin
  alter publication supabase_realtime add table public.channels;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null; end $$;

-- ── Анхны сувгууд (сувгийн хүснэгт хоосон үед л) ──
do $$ begin
  if not exists (select 1 from public.channels) then
    insert into public.channels (name, slug, description, kind, position) values
      ('Ерөнхий', 'general', 'Бүх багийн чат. Ажил дурдвал AI автоматаар бүртгэнэ.', 'team', 1000),
      ('Ирсэн хүсэлт', 'inbox', 'Имэйл, zuca.mn, Facebook-ээс автоматаар орж ирсэн мессеж — AI ажил болгоно.', 'inbox', 2000);
    insert into public.channels (name, slug, description, department_id, position)
    select d.name, coalesce(lower(d.code), left(d.id::text, 8)), d.description, d.id, 3000 + d.position
      from public.departments d
     where not exists (select 1 from public.channels c where c.slug = coalesce(lower(d.code), left(d.id::text, 8)));
  end if;
end $$;

-- ═════════════════════════ v6: Зөвхөн ZUCA — ажлыг хариуцагчид нь, zuca.mn синк ═════════════════════════

-- ── Ажлыг хэн харах вэ ──
-- Админ: бүгдийг · Ажилтан: өөрт оноогдсон, өөрийн үүсгэсэн, эзэнгүй ажил.
-- (Cron, Telegram bot, intake нь service role-оор ажиллах тул эдгээр дүрэм тэдэнд хамаарахгүй.)
drop policy if exists "tasks all"    on public.tasks;
drop policy if exists "tasks select" on public.tasks;
drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks update" on public.tasks;
drop policy if exists "tasks delete" on public.tasks;
-- Хоёр эрх: Админ (admin/director) бүгдийг; Ажилтан — өөрт оноогдсон, өөрийн үүсгэсэн, эзэнгүй ажил
create policy "tasks select" on public.tasks for select to authenticated using (
  public.is_leader()
  or assignee_id = public.my_profile_id()
  or created_by = public.my_profile_id()
  or assignee_id is null
);
create policy "tasks insert" on public.tasks for insert to authenticated with check (true);
create policy "tasks update" on public.tasks for update to authenticated using (
  public.is_leader()
  or assignee_id = public.my_profile_id()
  or created_by = public.my_profile_id()
  or assignee_id is null                                   -- эзэнгүй ажлыг «Би авъя» гэж авах
) with check (
  public.is_leader()
  or assignee_id = public.my_profile_id()
  or created_by = public.my_profile_id()
  or assignee_id is null
);
create policy "tasks delete" on public.tasks for delete to authenticated using (
  public.is_leader() or created_by = public.my_profile_id()
);

-- Эрхийг хоёр болгоно: «Удирдлага» → Админ, «Хэлтсийн дарга» → Ажилтан.
-- (Хэрэгтэй хүнийг дараа нь «Баг» хуудаснаас Админ болгоно. Хэлтэс, дарга AI-д хэрэглэгдсээр байна.)
update public.profiles set role = 'admin'  where role = 'director';
update public.profiles set role = 'member' where role = 'manager';

-- ── zuca.mn-ээс орой бүр татах мэдээлэл ──
alter table public.camps add column if not exists zuca_rating      numeric(3, 1);
alter table public.camps add column if not exists zuca_reviews     int;
alter table public.camps add column if not exists zuca_shifts_open int;
alter table public.camps add column if not exists zuca_synced_at   timestamptz;
create index if not exists camps_zuca_id_idx on public.camps (zuca_id);

create table if not exists public.zuca_shifts (
  id         bigint primary key,                                    -- zuca.mn-ийн ээлжийн id
  camp_id    uuid not null references public.camps (id) on delete cascade,
  name       text not null default '',
  starts_at  timestamptz,
  ends_at    timestamptz,
  capacity   int not null default 0,
  booked     int not null default 0,
  price      int,
  is_open    boolean not null default true,
  is_day     boolean not null default false,
  synced_at  timestamptz not null default now()
);
create index if not exists zuca_shifts_start_idx on public.zuca_shifts (starts_at);
create index if not exists zuca_shifts_camp_idx on public.zuca_shifts (camp_id);

-- Системийн жижиг тохиргоо/төлөв (жишээ нь сүүлийн синк)
create table if not exists public.app_meta (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table public.zuca_shifts enable row level security;
alter table public.app_meta    enable row level security;
drop policy if exists "zuca_shifts select" on public.zuca_shifts;
drop policy if exists "app_meta select"    on public.app_meta;
create policy "zuca_shifts select" on public.zuca_shifts for select to authenticated using (true);
create policy "app_meta select"    on public.app_meta    for select to authenticated using (true);
-- Supabase ихэвчлэн автоматаар олгодог ч, тодорхой байлгая (синк service_role-оор бичнэ)
grant select on public.zuca_shifts, public.app_meta to authenticated;
grant all    on public.zuca_shifts, public.app_meta to service_role;
-- Бичих эрх зөвхөн service role-д (синк, cron)

do $$ begin
  alter publication supabase_realtime add table public.zuca_shifts;
exception when others then null; end $$;

-- ═════════════════════════ v7: Төсөл ба ажилтны календарь ═════════════════════════
-- Төсөл олон ажлыг нэгтгэнэ (жишээ нь «Зуслангийн 100 жилийн хаалт»).
-- Явц % = дууссан ажил / нийт ажил. Календарь нь tasks.due_date-ийг ашиглана.

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  color        text not null default '#4f46e5',
  status       text not null default 'active' check (status in ('active', 'on_hold', 'done')),
  owner_id     uuid references public.profiles (id) on delete set null,
  camp_id      uuid references public.camps (id) on delete set null,
  start_date   date,
  due_date     date,
  position     double precision not null default 0,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists projects_status_idx on public.projects (status, position);

-- Төслийг устгахад ажлууд нь устахгүй, зөвхөн төслөөс салгана
alter table public.tasks add column if not exists project_id uuid references public.projects (id) on delete set null;
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_due_idx on public.tasks (assignee_id, due_date);

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists projects_created_by on public.projects;
create trigger projects_created_by before insert on public.projects
  for each row execute function public.set_created_by();

alter table public.projects enable row level security;
drop policy if exists "projects select" on public.projects;
drop policy if exists "projects insert" on public.projects;
drop policy if exists "projects update" on public.projects;
drop policy if exists "projects delete" on public.projects;
-- Төслийг баг бүхэлдээ харж, үүсгэнэ. Засах — админ, хариуцагч, үүсгэгч. Устгах — админ, үүсгэгч.
create policy "projects select" on public.projects for select to authenticated using (true);
create policy "projects insert" on public.projects for insert to authenticated with check (true);
create policy "projects update" on public.projects for update to authenticated using (
  public.is_leader() or owner_id = public.my_profile_id() or created_by = public.my_profile_id()
);
create policy "projects delete" on public.projects for delete to authenticated using (
  public.is_leader() or created_by = public.my_profile_id()
);

-- Ажилтан бусдын ажлыг харахгүй (RLS) ч төслийн явц % зөв гарахын тулд зөвхөн тоог нь буцаана
create or replace function public.project_progress()
returns table (project_id uuid, total bigint, done bigint)
language sql stable security definer set search_path = public as $$
  select t.project_id, count(*), count(*) filter (where t.status = 'done')
    from public.tasks t
   where t.project_id is not null
     and auth.uid() is not null
   group by t.project_id
$$;
revoke all on function public.project_progress() from public, anon;
grant execute on function public.project_progress() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when others then null; end $$;
