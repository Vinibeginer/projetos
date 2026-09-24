-- ═══════════════════════════════════════════════════════════════
--  0006 — Marca a obra original do tracker
--
--  As abas Cronograma, Contrato, parte de Recursos e o orçamento de
--  MO por item são conteúdo fixo, escrito para a obra original.
--  Com esta coluna o tracker mostra esse conteúdo só nela e esconde
--  nas obras criadas por outras contas.
--
--  A obra original é reconhecida pela 2ª medição CAIXA real
--  (R$ 63.701,54), que só existe nela.
-- ═══════════════════════════════════════════════════════════════

alter table public.obras add column if not exists detalhes_fixos boolean not null default false;

update public.obras set detalhes_fixos = true
where id in (select obra_id from public.medicoes where valor = 63701.54);

-- conferência: deve listar exatamente uma obra
select tag, nome, detalhes_fixos from public.obras where detalhes_fixos;
