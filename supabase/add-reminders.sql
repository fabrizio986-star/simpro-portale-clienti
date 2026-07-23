-- Esegui questo file nel SQL Editor per aggiungere i solleciti dei clienti.

create table if not exists public.client_reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  message text,
  handled boolean not null default false,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

alter table public.client_reminders enable row level security;

drop policy if exists "simpro admins manage reminders" on public.client_reminders;
create policy "simpro admins manage reminders"
on public.client_reminders for all
to authenticated
using (public.is_simpro_admin())
with check (public.is_simpro_admin());

create or replace function public.submit_client_reminder(
  p_token uuid,
  p_job_id uuid,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  select c.id into v_client_id
  from public.clients c
  join public.jobs j on j.client_id = c.id
  where c.access_token = p_token
    and c.active = true
    and j.id = p_job_id;

  if v_client_id is null then
    return jsonb_build_object('ok', false, 'message', 'Link o lavorazione non validi.');
  end if;

  if exists (
    select 1
    from public.client_reminders r
    where r.client_id = v_client_id
      and r.job_id = p_job_id
      and r.created_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Hai già inviato un sollecito nelle ultime 24 ore.');
  end if;

  insert into public.client_reminders (client_id, job_id, message)
  values (v_client_id, p_job_id, nullif(left(trim(coalesce(p_message, '')), 500), ''));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_client_reminder(uuid, uuid, text) from public;
grant execute on function public.submit_client_reminder(uuid, uuid, text) to anon, authenticated;

revoke all on public.client_reminders from anon;
grant select, update, delete on public.client_reminders to authenticated;
