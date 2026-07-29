-- Archivio interno degli ordini completati.
alter table public.jobs
  add column if not exists completed_at timestamptz;

alter table public.jobs
  add column if not exists completion_type text;

alter table public.jobs
  drop constraint if exists jobs_completion_type_check;

alter table public.jobs
  add constraint jobs_completion_type_check
  check (completion_type is null or completion_type in ('ritirato', 'installato'));

create index if not exists jobs_completed_at_idx
  on public.jobs (completed_at desc)
  where completed_at is not null;

-- Gli ordini archiviati restano disponibili agli amministratori tramite le
-- normali policy RLS, ma non vengono restituiti al portale pubblico del cliente.
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
    'jobs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', j.id,
          'title', j.title,
          'code', j.code,
          'phase', j.phase,
          'progress', j.progress,
          'delivery', j.delivery,
          'due_date', j.due_date,
          'note', j.note,
          'requires_installation', j.requires_installation,
          'payment_notice', j.payment_notice,
          'workflow_type', j.workflow_type,
          'current_step', j.current_step,
          'has_galvanizing', j.has_galvanizing,
          'has_painting', j.has_painting,
          'updated_at', j.updated_at
        )
        order by j.created_at desc
      )
      from public.jobs j
      where j.client_id = c.id
        and j.completed_at is null
    ), '[]'::jsonb)
  )
  from public.clients c
  where c.access_token = p_token
    and c.active = true;
$$;

revoke all on function public.get_client_portal(uuid) from public;
grant execute on function public.get_client_portal(uuid) to anon, authenticated;
