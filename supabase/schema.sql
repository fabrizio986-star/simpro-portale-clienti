-- Esegui tutto questo file nel SQL Editor di Supabase una sola volta.

create extension if not exists pgcrypto;

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.admin_emails (email)
values ('fabrizio986@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_simpro_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  access_token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  code text,
  phase text not null default 'Ordine ricevuto',
  progress integer not null default 0 check (progress between 0 and 100),
  delivery text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_emails enable row level security;
alter table public.clients enable row level security;
alter table public.jobs enable row level security;

drop policy if exists "simpro admins manage clients" on public.clients;
create policy "simpro admins manage clients"
on public.clients for all
to authenticated
using (public.is_simpro_admin())
with check (public.is_simpro_admin());

drop policy if exists "simpro admins manage jobs" on public.jobs;
create policy "simpro admins manage jobs"
on public.jobs for all
to authenticated
using (public.is_simpro_admin())
with check (public.is_simpro_admin());

create or replace function public.get_client_portal(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'client', jsonb_build_object(
      'name', c.name,
      'contact_name', c.contact_name
    ),
    'jobs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'title', j.title,
            'code', j.code,
            'phase', j.phase,
            'progress', j.progress,
            'delivery', j.delivery,
            'note', j.note,
            'updated_at', j.updated_at
          )
          order by j.created_at desc
        )
        from public.jobs j
        where j.client_id = c.id
      ),
      '[]'::jsonb
    )
  )
  from public.clients c
  where c.access_token = p_token
    and c.active = true;
$$;

revoke all on function public.get_client_portal(uuid) from public;
grant execute on function public.get_client_portal(uuid) to anon, authenticated;
grant execute on function public.is_simpro_admin() to authenticated;

revoke all on public.admin_emails from anon, authenticated;
revoke all on public.clients from anon;
revoke all on public.jobs from anon;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
