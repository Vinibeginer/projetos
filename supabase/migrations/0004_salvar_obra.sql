-- ═══════════════════════════════════════════════════════════════
--  0004 — Gravação atômica dos dados de uma obra
--
--  Antes: o tracker apagava e reinseria cada tabela separadamente,
--  sem transação. Uma queda de rede no meio deixava a tabela vazia,
--  e dois editores ao mesmo tempo sobrescreviam um ao outro.
--
--  Agora: salvar_obra() troca tudo numa única transação (ou grava
--  tudo, ou nada) e recusa a gravação se a obra foi alterada por
--  outra pessoa/aba desde o último carregamento (p_versao).
-- ═══════════════════════════════════════════════════════════════

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
begin
  if not public.pode_editar(p_obra) then
    raise exception 'sem permissão para editar esta obra' using errcode = '42501';
  end if;

  -- trava a linha da obra: gravações simultâneas ficam em fila
  select atualizado_em into v_atual from public.obras where id = p_obra for update;
  if not found then
    raise exception 'obra não encontrada' using errcode = 'P0002';
  end if;
  if p_versao is not null and v_atual <> p_versao then
    raise exception 'conflito: a obra foi alterada em outro lugar' using errcode = '40001';
  end if;

  delete from public.itens         where obra_id = p_obra;
  delete from public.materiais     where obra_id = p_obra;
  delete from public.mo_pagamentos where obra_id = p_obra;
  delete from public.medicoes      where obra_id = p_obra;
  delete from public.historico     where obra_id = p_obra;

  insert into public.itens (obra_id, ordem, descricao, pci_pct, exec_pct, travado, prev_pct, obs)
  select p_obra, ordem, descricao, coalesce(pci_pct,0), coalesce(exec_pct,0),
         coalesce(travado,false), coalesce(prev_pct,0), coalesce(obs,'')
  from jsonb_to_recordset(coalesce(p_dados->'itens','[]'))
    as x(ordem int, descricao text, pci_pct numeric, exec_pct numeric, travado boolean, prev_pct numeric, obs text);

  insert into public.materiais (obra_id, data, descricao, categoria, fornecedor, referencia, valor, pago)
  select p_obra, data, descricao, categoria, fornecedor, referencia, coalesce(valor,0), coalesce(pago,true)
  from jsonb_to_recordset(coalesce(p_dados->'materiais','[]'))
    as x(data date, descricao text, categoria text, fornecedor text, referencia text, valor numeric, pago boolean);

  insert into public.mo_pagamentos (obra_id, data, destinatario, referencia, valor, tipo, item_id)
  select p_obra, data, destinatario, referencia, coalesce(valor,0), coalesce(tipo,'mo'), item_id
  from jsonb_to_recordset(coalesce(p_dados->'mo_pagamentos','[]'))
    as x(data date, destinatario text, referencia text, valor numeric, tipo text, item_id bigint);

  insert into public.medicoes (obra_id, numero, data, pct_caixa, valor, referencia, itens_desc, confirmada)
  select p_obra, numero, data, coalesce(pct_caixa,0), coalesce(valor,0), referencia, itens_desc, coalesce(confirmada,false)
  from jsonb_to_recordset(coalesce(p_dados->'medicoes','[]'))
    as x(numero int, data date, pct_caixa numeric, valor numeric, referencia text, itens_desc text, confirmada boolean);

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
