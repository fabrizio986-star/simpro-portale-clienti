-- Evita clienti duplicati quando l'autista usa una parte riconoscibile del nome
-- (es. "Capasso" invece di "Capasso Lab"). In caso di piu risultati compatibili
-- non sceglie arbitrariamente e lascia il nome non abbinato al controllo manuale.

create or replace function public.sync_driver_delivery_to_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := btrim(coalesce(new.job_code, ''));
  v_client_name text := btrim(coalesce(new.client_name, ''));
  v_client_search text := lower(regexp_replace(v_client_name, '[^[:alnum:]]+', ' ', 'g'));
  v_client_id uuid;
  v_job_id uuid;
  v_client_matches integer := 0;
  v_now timestamptz := now();
begin
  if v_code = '' then return new; end if;

  select j.id, j.client_id into v_job_id, v_client_id
  from public.jobs j
  where lower(btrim(coalesce(j.code, ''))) = lower(v_code)
  order by j.updated_at desc nulls last
  limit 1;

  if v_job_id is not null then
    update public.jobs
    set has_painting = true,
        painter = coalesce(nullif(btrim(new.painter), ''), painter),
        current_step = case
          when new.material_status = 'rientrato' then 'arrivo_officina'
          when new.material_status in ('da_portare', 'in_viaggio', 'consegnato', 'ritirato') then 'verniciatura'
          else current_step
        end,
        updated_at = v_now
    where id = v_job_id;
    return new;
  end if;

  if length(v_client_search) >= 3 then
    select c.id into v_client_id
    from public.clients c
    where lower(regexp_replace(btrim(c.name), '[^[:alnum:]]+', ' ', 'g')) = v_client_search
    order by c.created_at asc nulls last
    limit 1;

    if v_client_id is null then
      select count(*), min(c.id::text)::uuid
        into v_client_matches, v_client_id
      from public.clients c
      where lower(regexp_replace(btrim(c.name), '[^[:alnum:]]+', ' ', 'g')) like '%' || v_client_search || '%';

      if v_client_matches <> 1 then v_client_id := null; end if;
    end if;
  end if;

  if v_client_id is null then
    insert into public.clients (name, access_token, active)
    values (coalesce(nullif(v_client_name, ''), 'Cliente da completare'), gen_random_uuid(), true)
    returning id into v_client_id;
  end if;

  insert into public.jobs (
    client_id, title, code, workflow_type, current_step, phase, progress,
    priority, has_painting, painter, note, admin_notes, updated_at
  ) values (
    v_client_id,
    case when btrim(coalesce(new.notes, '')) <> '' then left(btrim(new.notes), 120)
         else 'Materiale in verniciatura - ' || v_code end,
    v_code, 'completa',
    case when new.material_status = 'rientrato' then 'arrivo_officina' else 'verniciatura' end,
    case when new.material_status = 'rientrato' then 'Arrivo in officina' else 'In verniciatura' end,
    case when new.material_status = 'rientrato' then 75 else 60 end,
    'normale', true, nullif(btrim(new.painter), ''),
    case when new.material_status = 'rientrato' then 'Materiale rientrato in officina.'
         else 'Materiale in verniciatura presso ' || coalesce(nullif(btrim(new.painter), ''), 'verniciatore da indicare') || '.' end,
    'Lavorazione creata automaticamente dal movimento dell''autista. Codice: ' || v_code ||
      case when btrim(coalesce(new.notes, '')) <> '' then E'\nNote autista: ' || btrim(new.notes) else '' end,
    v_now
  );

  return new;
end;
$$;
