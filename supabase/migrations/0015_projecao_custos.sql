-- ═══════════════════════════════════════════════════════════════
--  0015 — Projeção de custos das próximas etapas
--
--  Cada linha é uma etapa futura (ou um aporte de recursos próprios):
--  mês previsto, custos estimados de material, mão de obra e outros e,
--  quando ligada a uma etapa da PCI (item + pavimento + até qual %),
--  o tracker calcula a liberação da CAIXA que ela gera. O fluxo de
--  caixa mensal é calculado na página.
--  salvar_obra() grava as projeções na mesma transação; se a página
--  ainda for a versão antiga (sem o campo), as projeções ficam como estão.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.projecoes (
  id          bigserial primary key,
  obra_id     uuid not null references public.obras on delete cascade,
  ordem       int  not null default 0,
  tipo        text not null default 'etapa' check (tipo in ('etapa','aporte')),
  descricao   text not null default '',
  item_ordem  int,                 -- item da PCI (1..20) ou nulo
  andar       text,                -- T, P1, P2, CX, G ou nulo
  ate_pct     numeric(6,2),        -- até qual % a etapa avança
  mes         date,                -- 1º dia do mês previsto
  material    numeric(14,2) not null default 0,
  mao_obra    numeric(14,2) not null default 0,
  outros      numeric(14,2) not null default 0,
  aporte      numeric(14,2) not null default 0,   -- entrada de recursos próprios
  obs         text default ''
);
create index if not exists idx_projecoes_obra on public.projecoes(obra_id);
alter table public.projecoes enable row level security;

drop policy if exists p_projecoes_sel on public.projecoes;
create policy p_projecoes_sel on public.projecoes for select to authenticated using (public.pode_ler(obra_id));
drop policy if exists p_projecoes_ins on public.projecoes;
create policy p_projecoes_ins on public.projecoes for insert to authenticated with check (public.pode_editar(obra_id));
drop policy if exists p_projecoes_upd on public.projecoes;
create policy p_projecoes_upd on public.projecoes for update to authenticated using (public.pode_editar(obra_id)) with check (public.pode_editar(obra_id));
drop policy if exists p_projecoes_del on public.projecoes;
create policy p_projecoes_del on public.projecoes for delete to authenticated using (public.pode_editar(obra_id));

grant select, insert, update, delete on public.projecoes to authenticated;
grant usage, select on sequence public.projecoes_id_seq to authenticated;

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

  -- projeções de custo: só são trocadas quando a página envia o campo
  -- (versão antiga da página não conhece projeções e não as apaga)
  if p_dados ? 'projecoes' then
    delete from public.projecoes where obra_id = p_obra;
    insert into public.projecoes (obra_id, ordem, tipo, descricao, item_ordem, andar, ate_pct, mes, material, mao_obra, outros, aporte, obs)
    select p_obra, coalesce(x.ordem,0), coalesce(x.tipo,'etapa'), coalesce(x.descricao,''), x.item_ordem, x.andar, x.ate_pct, x.mes,
           coalesce(x.material,0), coalesce(x.mao_obra,0), coalesce(x.outros,0), coalesce(x.aporte,0), coalesce(x.obs,'')
    from jsonb_to_recordset(coalesce(p_dados->'projecoes','[]'))
      as x(ordem int, tipo text, descricao text, item_ordem int, andar text, ate_pct numeric, mes date,
           material numeric, mao_obra numeric, outros numeric, aporte numeric, obs text);
  end if;

  update public.obras set atualizado_em = clock_timestamp() where id = p_obra
  returning atualizado_em into v_atual;
  return v_atual;
end $$;

revoke execute on function public.salvar_obra(uuid, jsonb, timestamptz) from public, anon;
grant  execute on function public.salvar_obra(uuid, jsonb, timestamptz) to authenticated;
