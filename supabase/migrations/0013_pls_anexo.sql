-- ═══════════════════════════════════════════════════════════════
--  0013 — PDF da PLS anexado à medição
--
--  • Bucket privado "pls" no Storage: os arquivos ficam em
--    pls/<obra_id>/<arquivo>.pdf. Quem tem acesso à obra lê; quem pode
--    editar a obra anexa ou remove.
--  • medicoes.pls_arquivo: caminho do PDF anexado à medição.
--  • salvar_obra() grava pls_arquivo; se a página ainda for a versão
--    antiga (sem o campo), mantém o anexo já gravado.
-- ═══════════════════════════════════════════════════════════════

alter table public.medicoes add column if not exists pls_arquivo text;

insert into storage.buckets (id, name, public)
values ('pls', 'pls', false)
on conflict (id) do nothing;

-- obra dona do arquivo: 1ª pasta do caminho (null se não for um uuid)
create or replace function public.obra_da_pasta(caminho text)
returns uuid language sql immutable
set search_path = public as $$
  select case when split_part(caminho, '/', 1) ~ '^[0-9a-fA-F-]{36}$' then split_part(caminho, '/', 1)::uuid end;
$$;
grant execute on function public.obra_da_pasta(text) to authenticated;

drop policy if exists p_pls_sel on storage.objects;
create policy p_pls_sel on storage.objects for select to authenticated
  using (bucket_id = 'pls' and coalesce(public.pode_ler(public.obra_da_pasta(name)), false));
drop policy if exists p_pls_ins on storage.objects;
create policy p_pls_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'pls' and coalesce(public.pode_editar(public.obra_da_pasta(name)), false));
drop policy if exists p_pls_del on storage.objects;
create policy p_pls_del on storage.objects for delete to authenticated
  using (bucket_id = 'pls' and coalesce(public.pode_editar(public.obra_da_pasta(name)), false));

create or replace function public.salvar_obra(
  p_obra   uuid,
  p_dados  jsonb,
  p_versao timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual timestamptz;
  v_mo_antigo jsonb;
  v_itens_antigo jsonb;
  v_med_antigo jsonb;
begin
  if not public.pode_editar(p_obra) then
    raise exception 'sem permissão para editar esta obra' using errcode = '42501';
  end if;

  select atualizado_em into v_atual from public.obras where id = p_obra for update;
  if not found then
    raise exception 'obra não encontrada' using errcode = 'P0002';
  end if;
  if p_versao is not null and v_atual <> p_versao then
    raise exception 'conflito: a obra foi alterada em outro lugar' using errcode = '40001';
  end if;

  -- frentes já gravadas, para quem ainda envia sem o campo frente
  select coalesce(jsonb_agg(jsonb_build_object('data', data, 'valor', valor,
           'referencia', referencia, 'destinatario', destinatario, 'frente', frente)), '[]')
    into v_mo_antigo
  from public.mo_pagamentos where obra_id = p_obra;

  -- % medido já gravado, para quem ainda envia sem o campo medido_pct
  select coalesce(jsonb_agg(jsonb_build_object('ordem', ordem, 'medido_pct', medido_pct, 'andares', andares)), '[]')
    into v_itens_antigo
  from public.itens where obra_id = p_obra;

  -- PLS já gravada de cada medição, para quem ainda envia sem o campo pls
  select coalesce(jsonb_agg(jsonb_build_object('numero', numero, 'pls', pls, 'pls_arquivo', pls_arquivo)), '[]')
    into v_med_antigo
  from public.medicoes where obra_id = p_obra;

  delete from public.itens         where obra_id = p_obra;
  delete from public.materiais     where obra_id = p_obra;
  delete from public.mo_pagamentos where obra_id = p_obra;
  delete from public.medicoes      where obra_id = p_obra;
  delete from public.historico     where obra_id = p_obra;

  insert into public.itens (obra_id, ordem, descricao, pci_pct, exec_pct, travado, prev_pct, obs, medido_pct, andares)
  select p_obra, x.ordem, x.descricao, coalesce(x.pci_pct,0), coalesce(x.exec_pct,0),
         coalesce(x.travado,false), coalesce(x.prev_pct,0), coalesce(x.obs,''),
         coalesce(x.medido_pct,
           (select (a->>'medido_pct')::numeric from jsonb_array_elements(v_itens_antigo) a
             where (a->>'ordem')::int = x.ordem limit 1),
           case when x.travado then coalesce(x.exec_pct,0) else 0 end),
         case when x.andares is not null then x.andares
              else (select a->'andares' from jsonb_array_elements(v_itens_antigo) a
                     where (a->>'ordem')::int = x.ordem and jsonb_typeof(a->'andares') = 'array' limit 1) end
  from jsonb_to_recordset(coalesce(p_dados->'itens','[]'))
    as x(ordem int, descricao text, pci_pct numeric, exec_pct numeric, travado boolean, prev_pct numeric, obs text, medido_pct numeric, andares jsonb);

  insert into public.materiais (obra_id, data, descricao, categoria, fornecedor, referencia, valor, pago)
  select p_obra, data, descricao, categoria, fornecedor, referencia, coalesce(valor,0), coalesce(pago,true)
  from jsonb_to_recordset(coalesce(p_dados->'materiais','[]'))
    as x(data date, descricao text, categoria text, fornecedor text, referencia text, valor numeric, pago boolean);

  insert into public.mo_pagamentos (obra_id, data, destinatario, referencia, valor, tipo, item_id, frente)
  select p_obra, x.data, x.destinatario, x.referencia, coalesce(x.valor,0), coalesce(x.tipo,'mo'), x.item_id,
         coalesce(x.frente,
           (select a->>'frente' from jsonb_array_elements(v_mo_antigo) a
             where (a->>'data')::date is not distinct from x.data
               and (a->>'valor')::numeric = coalesce(x.valor,0)
               and a->>'referencia'   is not distinct from x.referencia
               and a->>'destinatario' is not distinct from x.destinatario
             limit 1),
           'p1')
  from jsonb_to_recordset(coalesce(p_dados->'mo_pagamentos','[]'))
    as x(data date, destinatario text, referencia text, valor numeric, tipo text, item_id bigint, frente text);

  insert into public.medicoes (obra_id, numero, data, pct_caixa, valor, referencia, itens_desc, confirmada, pls, pls_arquivo)
  select p_obra, x.numero, x.data, coalesce(x.pct_caixa,0), coalesce(x.valor,0), x.referencia, x.itens_desc, coalesce(x.confirmada,false),
         case when x.pls is not null then x.pls
              else (select a->'pls' from jsonb_array_elements(v_med_antigo) a
                     where (a->>'numero')::int = x.numero and jsonb_typeof(a->'pls') = 'object' limit 1) end,
         coalesce(x.pls_arquivo,
              (select a->>'pls_arquivo' from jsonb_array_elements(v_med_antigo) a
                where (a->>'numero')::int = x.numero limit 1))
  from jsonb_to_recordset(coalesce(p_dados->'medicoes','[]'))
    as x(numero int, data date, pct_caixa numeric, valor numeric, referencia text, itens_desc text, confirmada boolean, pls jsonb, pls_arquivo text);

  insert into public.historico (obra_id, data, data_txt, descricao, delta_pct, delta_valor, previsao, obs)
  select p_obra, data, data_txt, descricao, coalesce(delta_pct,0), coalesce(delta_valor,0), coalesce(previsao,false), coalesce(obs,'')
  from jsonb_to_recordset(coalesce(p_dados->'historico','[]'))
    as x(data date, data_txt text, descricao text, delta_pct numeric, delta_valor numeric, previsao boolean, obs text);

  update public.obras set atualizado_em = clock_timestamp() where id = p_obra
  returning atualizado_em into v_atual;
  return v_atual;
end $$;

revoke execute on function public.salvar_obra(uuid, jsonb, timestamptz) from public, anon;
grant  execute on function public.salvar_obra(uuid, jsonb, timestamptz) to authenticated;
