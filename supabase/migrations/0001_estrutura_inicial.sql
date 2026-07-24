-- ═══════════════════════════════════════════════════════════════
--  TRACKER DE OBRA — estrutura do banco (Supabase / PostgreSQL)
--  Projeto: qazbyotibhqrwbuvmdza
--
--  Regras adotadas:
--    • cadastro livre (qualquer pessoa cria conta)
--    • NADA é visível sem login — não existe acesso público
--    • cada obra tem um código único (tag), ex.: OBR-K7M2QX
--    • uma conta pode ter várias obras (abas no tracker)
--    • dono edita a própria obra; convidados apenas leem
--
--  Como usar: Supabase → SQL Editor → New query → colar tudo → Run
--  Pode rodar mais de uma vez sem quebrar nada.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. PERFIS ────────────────────────────────────────────────
create table if not exists public.perfis (
  id         uuid primary key references auth.users on delete cascade,
  nome       text,
  email      text,
  criado_em  timestamptz not null default now()
);

-- ── 2. OBRAS ─────────────────────────────────────────────────
-- código único e legível de cada obra, ex.: OBR-K7M2QX
-- (alfabeto sem O/0/I/1 para não confundir na hora de ditar)
create or replace function public.gerar_tag_obra()
returns text language plpgsql
set search_path = public as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  t text; i int;
begin
  loop
    t := 'OBR-';
    for i in 1..6 loop
      t := t || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.obras where tag = t);
  end loop;
  return t;
end $$;

create table if not exists public.obras (
  id            uuid primary key default gen_random_uuid(),
  tag           text unique not null default public.gerar_tag_obra(),
  dono          uuid not null references auth.users on delete cascade,
  nome          text not null,
  orcamento     numeric(14,2) not null default 0,  -- custo total (PCI)
  base_obra     numeric(14,2) not null default 0,  -- recurso disponível p/ obra
  mo_teto       numeric(14,2) not null default 0,  -- teto de mão de obra
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_obras_dono on public.obras(dono);

-- se o script já tinha sido rodado antes sem a coluna tag, acrescenta agora
alter table public.obras add column if not exists tag text;
update public.obras set tag = public.gerar_tag_obra() where tag is null;
alter table public.obras alter column tag set default public.gerar_tag_obra();
alter table public.obras alter column tag set not null;
create unique index if not exists idx_obras_tag on public.obras(tag);

-- ── 3. COMPARTILHAMENTO ──────────────────────────────────────
create table if not exists public.obra_membros (
  obra_id   uuid not null references public.obras on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  papel     text not null default 'leitor' check (papel in ('leitor','editor')),
  criado_em timestamptz not null default now(),
  primary key (obra_id, user_id)
);
create index if not exists idx_membros_user on public.obra_membros(user_id);

-- convite por e-mail: vira acesso automaticamente quando a pessoa se cadastra
create table if not exists public.convites (
  id        bigserial primary key,
  obra_id   uuid not null references public.obras on delete cascade,
  email     text not null,
  papel     text not null default 'leitor' check (papel in ('leitor','editor')),
  criado_em timestamptz not null default now(),
  unique (obra_id, email)
);

-- ── 4. DADOS DA OBRA ─────────────────────────────────────────
create table if not exists public.itens (
  id        bigserial primary key,
  obra_id   uuid not null references public.obras on delete cascade,
  ordem     int  not null default 0,
  descricao text not null,
  pci_pct   numeric(6,2)  not null default 0,
  exec_pct  numeric(6,2)  not null default 0,
  travado   boolean       not null default false,
  prev_pct  numeric(6,2)  not null default 0,
  obs       text default ''
);
create index if not exists idx_itens_obra on public.itens(obra_id);

create table if not exists public.materiais (
  id         bigserial primary key,
  obra_id    uuid not null references public.obras on delete cascade,
  data       date,
  descricao  text,
  categoria  text,
  fornecedor text,
  referencia text,
  valor      numeric(14,2) not null default 0,
  pago       boolean not null default true
);
create index if not exists idx_materiais_obra on public.materiais(obra_id);

create table if not exists public.mo_pagamentos (
  id           bigserial primary key,
  obra_id      uuid not null references public.obras on delete cascade,
  data         date,
  destinatario text,
  referencia   text,
  valor        numeric(14,2) not null default 0,
  tipo         text not null default 'mo' check (tipo in ('mo','adiantamento','material')),
  item_id      bigint
);
create index if not exists idx_mo_obra on public.mo_pagamentos(obra_id);

create table if not exists public.medicoes (
  id         bigserial primary key,
  obra_id    uuid not null references public.obras on delete cascade,
  numero     int not null,
  data       date,
  pct_caixa  numeric(6,2)  not null default 0,
  valor      numeric(14,2) not null default 0,
  referencia text,
  itens_desc text,
  confirmada boolean not null default false
);
create index if not exists idx_medicoes_obra on public.medicoes(obra_id);

create table if not exists public.historico (
  id          bigserial primary key,
  obra_id     uuid not null references public.obras on delete cascade,
  data        date,
  descricao   text,
  delta_pct   numeric(6,2)  not null default 0,
  delta_valor numeric(14,2) not null default 0,
  previsao    boolean not null default false,
  obs         text
);
create index if not exists idx_historico_obra on public.historico(obra_id);
-- guarda a data como o usuário escreveu (ex.: "22/06–18/07/2026")
alter table public.historico add column if not exists data_txt text;

-- ── 5. FUNÇÕES DE PERMISSÃO ──────────────────────────────────
create or replace function public.pode_ler(o uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.obras        where id = o       and dono    = auth.uid())
      or exists (select 1 from public.obra_membros where obra_id = o  and user_id = auth.uid());
$$;

create or replace function public.pode_editar(o uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.obras        where id = o      and dono    = auth.uid())
      or exists (select 1 from public.obra_membros where obra_id = o and user_id = auth.uid() and papel = 'editor');
$$;

-- lista as obras que a conta pode abrir — alimenta as abas do tracker
create or replace function public.minhas_obras()
returns table (
  id uuid, tag text, nome text,
  orcamento numeric, base_obra numeric, mo_teto numeric,
  papel text, criado_em timestamptz
) language sql security definer stable
set search_path = public as $$
  select o.id, o.tag, o.nome, o.orcamento, o.base_obra, o.mo_teto,
         case when o.dono = auth.uid() then 'dono' else coalesce(m.papel, 'leitor') end,
         o.criado_em
  from public.obras o
  left join public.obra_membros m on m.obra_id = o.id and m.user_id = auth.uid()
  where o.dono = auth.uid() or m.user_id = auth.uid()
  order by (o.dono = auth.uid()) desc, o.criado_em;
$$;

-- ── 6. GATILHOS DE CADASTRO ──────────────────────────────────
-- cria o perfil e converte convites pendentes em acesso
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;

  insert into public.obra_membros (obra_id, user_id, papel)
  select c.obra_id, new.id, c.papel from public.convites c
  where lower(c.email) = lower(new.email)
  on conflict do nothing;

  delete from public.convites where lower(email) = lower(new.email);
  return new;
end; $$;

drop trigger if exists trg_novo_usuario on auth.users;
create trigger trg_novo_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- ── 7. SEGURANÇA POR LINHA ───────────────────────────────────
alter table public.perfis        enable row level security;
alter table public.obras         enable row level security;
alter table public.obra_membros  enable row level security;
alter table public.convites      enable row level security;
alter table public.itens         enable row level security;
alter table public.materiais     enable row level security;
alter table public.mo_pagamentos enable row level security;
alter table public.medicoes      enable row level security;
alter table public.historico     enable row level security;

-- perfis: cada um enxerga e edita o próprio
drop policy if exists p_perfis_sel on public.perfis;
create policy p_perfis_sel on public.perfis for select to authenticated using (id = auth.uid());
drop policy if exists p_perfis_upd on public.perfis;
create policy p_perfis_upd on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- obras: dono manda; convidado só lê
drop policy if exists p_obras_sel on public.obras;
create policy p_obras_sel on public.obras for select to authenticated
  using (dono = auth.uid() or exists (select 1 from public.obra_membros m where m.obra_id = id and m.user_id = auth.uid()));
drop policy if exists p_obras_ins on public.obras;
create policy p_obras_ins on public.obras for insert to authenticated with check (dono = auth.uid());
drop policy if exists p_obras_upd on public.obras;
create policy p_obras_upd on public.obras for update to authenticated using (dono = auth.uid()) with check (dono = auth.uid());
drop policy if exists p_obras_del on public.obras;
create policy p_obras_del on public.obras for delete to authenticated using (dono = auth.uid());

-- membros: dono administra; a pessoa vê o próprio vínculo
drop policy if exists p_memb_sel on public.obra_membros;
create policy p_memb_sel on public.obra_membros for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.obras o where o.id = obra_id and o.dono = auth.uid()));
drop policy if exists p_memb_ins on public.obra_membros;
create policy p_memb_ins on public.obra_membros for insert to authenticated
  with check (exists (select 1 from public.obras o where o.id = obra_id and o.dono = auth.uid()));
drop policy if exists p_memb_del on public.obra_membros;
create policy p_memb_del on public.obra_membros for delete to authenticated
  using (exists (select 1 from public.obras o where o.id = obra_id and o.dono = auth.uid()));

-- convites: só o dono da obra
drop policy if exists p_conv_all on public.convites;
create policy p_conv_all on public.convites for all to authenticated
  using (exists (select 1 from public.obras o where o.id = obra_id and o.dono = auth.uid()))
  with check (exists (select 1 from public.obras o where o.id = obra_id and o.dono = auth.uid()));

-- dados da obra: leitura para quem tem acesso, escrita só para quem pode editar
do $$
declare t text;
begin
  foreach t in array array['itens','materiais','mo_pagamentos','medicoes','historico'] loop
    execute format('drop policy if exists p_%1$s_sel on public.%1$s', t);
    execute format('create policy p_%1$s_sel on public.%1$s for select to authenticated using (public.pode_ler(obra_id))', t);
    execute format('drop policy if exists p_%1$s_ins on public.%1$s', t);
    execute format('create policy p_%1$s_ins on public.%1$s for insert to authenticated with check (public.pode_editar(obra_id))', t);
    execute format('drop policy if exists p_%1$s_upd on public.%1$s', t);
    execute format('create policy p_%1$s_upd on public.%1$s for update to authenticated using (public.pode_editar(obra_id)) with check (public.pode_editar(obra_id))', t);
    execute format('drop policy if exists p_%1$s_del on public.%1$s', t);
    execute format('create policy p_%1$s_del on public.%1$s for delete to authenticated using (public.pode_editar(obra_id))', t);
  end loop;
end $$;

-- ── 8. PERMISSÕES DE ACESSO VIA API ──────────────────────────
-- obrigatório em projetos criados a partir de 30/05/2026
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
grant execute on function public.minhas_obras()  to authenticated;
grant execute on function public.pode_ler(uuid)  to authenticated;
grant execute on function public.pode_editar(uuid) to authenticated;
-- 'anon' (sem login) não recebe nada: nada é visível sem login

-- ═══════════════════════════════════════════════════════════════
--  Conferência rápida — 9 tabelas, todas com rls_ativo = true
-- ═══════════════════════════════════════════════════════════════
select tablename as tabela, rowsecurity as rls_ativo
from pg_tables where schemaname = 'public' order by tablename;
