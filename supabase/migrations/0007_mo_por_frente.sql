-- ═══════════════════════════════════════════════════════════════
--  0007 — Mão de obra separada por frente de serviço
--
--  Frentes: p1 = 1º andar (térreo), p2 = 2º andar, p3 = 3º andar,
--           outros = serviços fora do orçamento de MO (muro, escadas,
--           montagem de ferragens...), sem teto.
--
--  • mo_pagamentos.frente  — a qual frente o pagamento pertence
--  • obras.mo_tetos        — teto de MO por frente, ex.: {"p1":..,"p2":..}
--  • salvar_obra()          — grava a frente; se a página ainda for a
--    versão antiga (sem frente no envio), mantém a frente já gravada
-- ═══════════════════════════════════════════════════════════════

alter table public.mo_pagamentos add column if not exists frente text not null default 'p1';
alter table public.mo_pagamentos drop constraint if exists mo_pagamentos_frente_check;
alter table public.mo_pagamentos add constraint mo_pagamentos_frente_check
  check (frente in ('p1','p2','p3','outros'));

alter table public.obras add column if not exists mo_tetos jsonb not null default '{}'::jsonb;

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

-- ── obra original: troca de pedreiro no 1º andar (set/2026) ──────
-- muro, escadas e montagem de ferragens ficaram fora do orçamento de MO
update public.mo_pagamentos p set frente = 'outros'
from public.obras o
where o.id = p.obra_id and o.detalhes_fixos
  and (p.referencia ilike '%muro%' or p.referencia ilike '%escada%' or p.referencia ilike '%ferrag%');

-- 1º andar: mantém tudo o que já foi pago + R$ 49.000 do novo pedreiro
-- 2º e 3º andar: R$ 140.000 divididos igualmente
update public.obras o set
  mo_tetos = jsonb_build_object(
    'p1', (select coalesce(sum(valor),0) from public.mo_pagamentos p
            where p.obra_id = o.id and p.frente = 'p1' and p.tipo in ('mo','adiantamento')) + 49000,
    'p2', 70000,
    'p3', 70000)
where o.detalhes_fixos and o.mo_tetos = '{}'::jsonb;

update public.obras set mo_teto = (mo_tetos->>'p1')::numeric + (mo_tetos->>'p2')::numeric + (mo_tetos->>'p3')::numeric
where detalhes_fixos and mo_tetos ? 'p1';

-- conferência
select o.tag, o.mo_tetos, o.mo_teto,
  (select json_agg(json_build_object('ref', referencia, 'valor', valor, 'frente', frente) order by data)
     from public.mo_pagamentos p where p.obra_id = o.id and p.frente <> 'p1') as fora_do_1o_andar
from public.obras o where o.detalhes_fixos;
