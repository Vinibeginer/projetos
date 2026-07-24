-- ═══════════════════════════════════════════════════════════════
--  0003 — Consulta pública de avanço físico pelo código da obra
--
--  Devolve SOMENTE percentuais de execução. Nenhum valor em R$,
--  nenhuma medição, nenhum pagamento, nenhum material.
--  A função é security definer: ignora o RLS, mas só consegue
--  entregar as colunas listadas aqui dentro.
-- ═══════════════════════════════════════════════════════════════

-- interruptor por obra (permite desligar o compartilhamento depois)
alter table public.obras add column if not exists publico boolean not null default true;

create or replace function public.avanco_publico(p_tag text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'nome',          o.nome,
    'tag',           o.tag,
    'atualizado_em', o.atualizado_em,
    'pct_geral',     coalesce((
        select round(sum(i.pci_pct * i.exec_pct) / 100.0, 2)
        from public.itens i where i.obra_id = o.id
      ), 0),
    'itens', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'descricao', i.descricao,
                   'peso',      i.pci_pct,
                   'exec',      i.exec_pct
                 ) order by i.ordem
               )
        from public.itens i where i.obra_id = o.id
      ), '[]'::jsonb)
  )
  from public.obras o
  where upper(o.tag) = upper(btrim(p_tag))
    and o.publico = true;
$$;

grant execute on function public.avanco_publico(text) to anon, authenticated;

-- teste (troque pelo código real da sua obra)
-- select public.avanco_publico('OBR-XXXXXX');
