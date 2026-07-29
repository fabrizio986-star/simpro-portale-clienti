-- Accesso tablet officina: sola lettura verniciature
-- Eseguire nel SQL Editor di Supabase.

create or replace function public.is_simpro_officina()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'officina@simprolamiere.it';
$$;

revoke all on function public.is_simpro_officina() from public;
grant execute on function public.is_simpro_officina() to authenticated;

drop policy if exists "officina reads clients" on public.clients;
create policy "officina reads clients" on public.clients
for select to authenticated
using (public.is_simpro_officina());

drop policy if exists "officina reads jobs" on public.jobs;
create policy "officina reads jobs" on public.jobs
for select to authenticated
using (public.is_simpro_officina());

drop policy if exists "officina reads painting deliveries" on public.painting_deliveries;
create policy "officina reads painting deliveries" on public.painting_deliveries
for select to authenticated
using (public.is_simpro_officina());

grant select on public.clients, public.jobs, public.painting_deliveries to authenticated;
