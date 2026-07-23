-- Esegui questo file nel SQL Editor per aggiungere la timeline delle lavorazioni.

alter table public.jobs
  add column if not exists current_step text not null default 'materiale_ordinato',
  add column if not exists has_galvanizing boolean not null default false,
  add column if not exists has_painting boolean not null default false;

update public.jobs
set current_step = case
  when lower(phase) like '%pront%' or lower(phase) like '%consegn%' then 'pronto_ritiro'
  when lower(phase) like '%controll%' then 'controllo'
  when lower(phase) like '%vernici%' then 'verniciatura'
  when lower(phase) like '%zinc%' then 'zincatura'
  when lower(phase) like '%produzione%' or lower(phase) like '%saldatura%' then 'inizio_lavorazione'
  else 'materiale_ordinato'
end
where current_step = 'materiale_ordinato';

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
