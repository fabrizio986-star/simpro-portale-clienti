-- Crea automaticamente cliente e lavorazione quando l'autista registra
-- una commessa inesistente. L'abbinamento avviene SOLO per codice esatto.

create extension if not exists pgcrypto;

create or replace function public.sync_driver_delivery_to_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := btrim(coalesce(new.job_code, ''));
  v_client_name text := btrim(coalesce(new.client_name, ''));
  v_client_id uuid;
  v_job_id uuid;
  v_now timestamptz := now();
begin
  -- Senza un codice non si crea alcuna scheda per evitare associazioni ambigue.
  if v_code = '' then
    return new;
  end if;

  -- Il codice commessa e l'unico identificatore valido.
  select j.id, j.client_id
    into v_job_id, v_client_id
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

  -- Se la commessa non esiste, cerca il cliente soltanto per nome esatto.
  if v_client_name <> '' then
    select c.id
      into v_client_id
    from public.clients c
    where lower(btrim(c.name)) = lower(v_client_name)
    order by c.created_at asc nulls last
    limit 1;
  end if;

  -- Se manca anche il cliente, crea una nuova scheda cliente.
  if v_client_id is null then
    insert into public.clients (name, access_token, active)
    values (
      coalesce(nullif(v_client_name, ''), 'Cliente da completare'),
      gen_random_uuid(),
      true
    )
    returning id into v_client_id;
  end if;

  -- Crea una nuova lavorazione collegata al cliente indicato dall'autista.
  insert into public.jobs (
    client_id,
    title,
    code,
    workflow_type,
    current_step,
    phase,
    progress,
    priority,
    has_painting,
    painter,
    note,
    admin_notes,
    updated_at
  ) values (
    v_client_id,
    case
      when btrim(coalesce(new.notes, '')) <> '' then left(btrim(new.notes), 120)
      else 'Materiale in verniciatura - ' || v_code
    end,
    v_code,
    'completa',
    case when new.material_status = 'rientrato' then 'arrivo_officina' else 'verniciatura' end,
    case when new.material_status = 'rientrato' then 'Arrivo in officina' else 'In verniciatura' end,
    case when new.material_status = 'rientrato' then 75 else 60 end,
    'normale',
    true,
    nullif(btrim(new.painter), ''),
    case
      when new.material_status = 'rientrato' then 'Materiale rientrato in officina.'
      else 'Materiale in verniciatura presso ' || coalesce(nullif(btrim(new.painter), ''), 'verniciatore da indicare') || '.'
    end,
    'Lavorazione creata automaticamente dal movimento dell''autista. Codice: ' || v_code ||
      case when btrim(coalesce(new.notes, '')) <> '' then E'\nNote autista: ' || btrim(new.notes) else '' end,
    v_now
  );

  return new;
end;
$$;

drop trigger if exists trg_sync_driver_delivery_to_job on public.painting_deliveries;

create trigger trg_sync_driver_delivery_to_job
after insert or update of job_code, client_name, painter, material_status
on public.painting_deliveries
for each row
execute function public.sync_driver_delivery_to_job();

-- Ripara anche i movimenti gia presenti che hanno un codice ma nessuna commessa esatta.
update public.painting_deliveries
set updated_at = now()
where btrim(coalesce(job_code, '')) <> ''
  and not exists (
    select 1
    from public.jobs j
    where lower(btrim(coalesce(j.code, ''))) = lower(btrim(painting_deliveries.job_code))
  );
