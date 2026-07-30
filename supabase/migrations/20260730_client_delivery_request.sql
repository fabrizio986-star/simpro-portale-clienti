-- Permette al cliente di scegliere ritiro in officina o consegna a pagamento.

alter table public.jobs
  add column if not exists fulfillment_choice text;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.jobs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%fulfillment_choice%';

  if constraint_name is not null then
    execute format('alter table public.jobs drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.jobs
  add constraint jobs_fulfillment_choice_check
  check (fulfillment_choice is null or fulfillment_choice in ('ritiro', 'consegna', 'installazione'));

create or replace function public.submit_fulfillment_choice(
  p_token uuid,
  p_job_id uuid,
  p_choice text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_job_title text;
  v_job_code text;
begin
  if p_choice not in ('ritiro', 'consegna', 'installazione') then
    return jsonb_build_object('ok', false, 'message', 'Scelta non valida.');
  end if;

  select c.id, j.title, j.code
    into v_client_id, v_job_title, v_job_code
  from public.clients c
  join public.jobs j on j.client_id = c.id
  where c.access_token = p_token
    and c.active = true
    and j.id = p_job_id
    and j.completed_at is null;

  if v_client_id is null then
    return jsonb_build_object('ok', false, 'message', 'Link o lavorazione non validi.');
  end if;

  update public.jobs
  set fulfillment_choice = p_choice,
      updated_at = now()
  where id = p_job_id;

  if p_choice = 'consegna' then
    if not exists (
      select 1
      from public.client_reminders r
      where r.client_id = v_client_id
        and r.job_id = p_job_id
        and r.handled = false
        and r.message ilike 'Richiesta consegna%'
    ) then
      insert into public.client_reminders (client_id, job_id, message)
      values (
        v_client_id,
        p_job_id,
        'Richiesta consegna a pagamento: contattare il cliente per organizzare data, costo e indirizzo.'
      );
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_fulfillment_choice(uuid, uuid, text) from public;
grant execute on function public.submit_fulfillment_choice(uuid, uuid, text) to anon, authenticated;
