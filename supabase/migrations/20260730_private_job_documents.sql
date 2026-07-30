-- Rende realmente privati i documenti delle commesse.

update storage.buckets
set public = false
where id = 'job-documents';

update public.job_documents
set url = ''
where url <> '';

create or replace function public.get_client_portal(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'client', jsonb_build_object('name', c.name, 'contact_name', c.contact_name),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'code', j.code, 'phase', j.phase, 'progress', j.progress,
        'delivery', j.delivery, 'due_date', j.due_date, 'note', j.note,
        'requires_installation', j.requires_installation, 'payment_notice', j.payment_notice,
        'workflow_type', j.workflow_type, 'current_step', j.current_step,
        'has_galvanizing', j.has_galvanizing, 'has_painting', j.has_painting,
        'fulfillment_choice', j.fulfillment_choice, 'updated_at', j.updated_at
      ) order by j.created_at desc)
      from public.jobs j where j.client_id = c.id and j.completed_at is null
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_object_agg(x.job_id, x.items) from (
        select p.job_id, jsonb_agg(jsonb_build_object('url', p.url, 'caption', p.caption) order by p.created_at desc) items
        from public.job_photos p join public.jobs j on j.id = p.job_id
        where j.client_id = c.id and j.completed_at is null group by p.job_id
      ) x
    ), '{}'::jsonb),
    'documents', coalesce((
      select jsonb_object_agg(x.job_id, x.items) from (
        select d.job_id, jsonb_agg(jsonb_build_object(
          'id', d.id, 'file_name', d.file_name, 'label', d.label
        ) order by d.created_at desc) items
        from public.job_documents d join public.jobs j on j.id = d.job_id
        where j.client_id = c.id and j.completed_at is null group by d.job_id
      ) x
    ), '{}'::jsonb)
  )
  from public.clients c where c.access_token = p_token and c.active = true;
$$;

revoke all on function public.get_client_portal(uuid) from public;
grant execute on function public.get_client_portal(uuid) to anon, authenticated;
