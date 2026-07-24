-- ═══════════════════════════════════════════════════════════════
--  Função de "sinal de vida" — usada pelo agendamento semanal
--  do GitHub Actions para impedir que o projeto seja pausado
--  por inatividade (plano gratuito pausa após 7 dias parado).
--
--  Cole no SQL Editor do Supabase e clique em Run.
--  Não expõe nenhum dado: devolve apenas a data/hora do servidor.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.ping()
returns text
language sql
security definer
set search_path = public
as $$
  select 'ok ' || now()::text;
$$;

grant execute on function public.ping() to anon, authenticated;

-- teste
select public.ping();
