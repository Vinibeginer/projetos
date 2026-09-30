-- ═══════════════════════════════════════════════════════════════
--  0009 — Projeto do estúdio (planta, móveis, pisos) salvo na nuvem
--
--  Antes: o estúdio de decoração guardava o projeto só no navegador,
--  então cada aparelho tinha a sua versão.
--
--  Agora: igual ao Tracker, o projeto fica numa linha por obra.
--  • Membros da obra leem; dono e editores gravam por salvar_planta().
--  • salvar_planta() grava numa transação e recusa a gravação se o
--    projeto foi alterado em outro aparelho/por outra pessoa desde a
--    última leitura (p_versao), como salvar_obra() no Tracker.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.projeto_planta (
  obra_id        uuid primary key references public.obras on delete cascade,
  doc            jsonb not null,
  atualizado_em  timestamptz not null default clock_timestamp(),
  atualizado_por uuid references auth.users on delete set null default auth.uid()
);
alter table public.projeto_planta enable row level security;
revoke all on public.projeto_planta from anon;

drop policy if exists p_planta_sel on public.projeto_planta;
create policy p_planta_sel on public.projeto_planta for select to authenticated using (public.pode_ler(obra_id));
-- gravação só pela função abaixo (controle de versão)

create or replace function public.salvar_planta(
  p_obra   uuid,
  p_doc    jsonb,
  p_versao timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual timestamptz;
  v_nova  timestamptz := clock_timestamp();
begin
  if not public.pode_editar(p_obra) then
    raise exception 'sem permissão para editar esta obra' using errcode = '42501';
  end if;
  if p_doc is null or jsonb_typeof(p_doc) <> 'object' or coalesce(jsonb_typeof(p_doc->'floors'), '') <> 'array' then
    raise exception 'projeto inválido' using errcode = '22023';
  end if;
  if octet_length(p_doc::text) > 5000000 then
    raise exception 'projeto grande demais (máx. 5 MB)' using errcode = '54000';
  end if;

  -- trava a linha: gravações simultâneas ficam em fila
  select atualizado_em into v_atual from public.projeto_planta where obra_id = p_obra for update;
  if found then
    if p_versao is null or v_atual <> p_versao then
      raise exception 'conflito: o projeto foi alterado em outro lugar' using errcode = '40001';
    end if;
    update public.projeto_planta
       set doc = p_doc, atualizado_em = v_nova, atualizado_por = auth.uid()
     where obra_id = p_obra;
  else
    insert into public.projeto_planta (obra_id, doc, atualizado_em, atualizado_por)
    values (p_obra, p_doc, v_nova, auth.uid());
  end if;
  return v_nova;
end $$;
revoke all on function public.salvar_planta(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.salvar_planta(uuid, jsonb, timestamptz) to authenticated;
