-- ═══════════════════════════════════════════════════════════════
--  0005 — Fecha a tabela de controle de migrações para a API
--
--  public.migracoes é criada pelo workflow do GitHub Actions e, por
--  causa dos "default privileges" da 0001, ficou legível e editável
--  por qualquer usuário logado via API. Só o workflow (conexão direta
--  ao banco, como dono) precisa dela.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.migracoes (
  arquivo     text primary key,
  aplicada_em timestamptz not null default now()
);
alter table public.migracoes enable row level security;
revoke all on public.migracoes from anon, authenticated;
