-- Esegui questo file nel SQL Editor di Supabase una sola volta.

alter table public.jobs
  add column if not exists requires_installation boolean not null default false;

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
            'current_step', j.current_step,
            'has_galvanizing', j.has_galvanizing,
            'has_painting', j.has_painting,
            'requires_installation', j.requires_installation,
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
