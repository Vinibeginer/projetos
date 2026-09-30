-- ═══════════════════════════════════════════════════════════════
--  0008 — Login do site do projeto e dados do projeto estrutural
--
--  • acesso_projeto(): diz se a conta logada pode abrir o site do
--    projeto (estúdio, maquetes, projeto elétrico, gastos). Vale a
--    mesma regra do Tracker: dono ou membro da obra original
--    (obras.detalhes_fixos). Ter uma conta não basta. Convites
--    pendentes para o e-mail da conta viram acesso no primeiro login.
--
--  • membros_projeto(): lista membros e convites para o dono, que
--    convida/remove pessoas pela página inicial do site.
--
--  • projeto_estrutural: os dados do projeto estrutural (pilares,
--    vigas, sapatas) ficam aqui, não no repositório público — a prancha
--    proíbe disponibilizá-los a terceiros. Membros leem; dono e
--    editores gravam (pelo estúdio: "Guardar na nuvem da obra").
-- ═══════════════════════════════════════════════════════════════

create or replace function public.acesso_projeto()
returns table (obra_id uuid, papel text)
language plpgsql security definer volatile
set search_path = public as $$
#variable_conflict use_column
declare
  meu_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then return; end if;
  -- convite para quem já tinha conta: vira acesso no primeiro login
  -- (quem se cadastra depois do convite já é tratado por ao_criar_usuario)
  if meu_email <> '' then
    insert into public.obra_membros (obra_id, user_id, papel)
    select c.obra_id, auth.uid(), c.papel from public.convites c where lower(c.email) = meu_email
    on conflict do nothing;
    delete from public.convites c where lower(c.email) = meu_email;
  end if;
  return query
    select o.id, case when o.dono = auth.uid() then 'dono' else m.papel end
    from public.obras o
    left join public.obra_membros m on m.obra_id = o.id and m.user_id = auth.uid()
    where o.detalhes_fixos and (o.dono = auth.uid() or m.user_id is not null)
    order by o.criado_em
    limit 1;
end $$;
revoke all on function public.acesso_projeto() from public, anon;
grant execute on function public.acesso_projeto() to authenticated;

create table if not exists public.projeto_estrutural (
  obra_id        uuid primary key references public.obras on delete cascade,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null default auth.uid()
);
alter table public.projeto_estrutural enable row level security;
revoke all on public.projeto_estrutural from anon;

drop policy if exists p_estr_sel on public.projeto_estrutural;
drop policy if exists p_estr_ins on public.projeto_estrutural;
drop policy if exists p_estr_upd on public.projeto_estrutural;
drop policy if exists p_estr_del on public.projeto_estrutural;
create policy p_estr_sel on public.projeto_estrutural for select to authenticated using (public.pode_ler(obra_id));
create policy p_estr_ins on public.projeto_estrutural for insert to authenticated with check (public.pode_editar(obra_id));
create policy p_estr_upd on public.projeto_estrutural for update to authenticated
  using (public.pode_editar(obra_id)) with check (public.pode_editar(obra_id));
create policy p_estr_del on public.projeto_estrutural for delete to authenticated using (public.pode_editar(obra_id));

-- lista de acesso (membros e convites pendentes) — só o dono da obra original enxerga
create or replace function public.membros_projeto()
returns table (user_id uuid, email text, papel text, pendente boolean)
language sql security definer stable
set search_path = public as $$
  select m.user_id, p.email, m.papel, false
  from public.obra_membros m
  join public.obras o on o.id = m.obra_id
  left join public.perfis p on p.id = m.user_id
  where o.detalhes_fixos and o.dono = auth.uid()
  union all
  select null, c.email, c.papel, true
  from public.convites c
  join public.obras o on o.id = c.obra_id
  where o.detalhes_fixos and o.dono = auth.uid()
  order by 4, 2;
$$;
revoke all on function public.membros_projeto() from public, anon;
grant execute on function public.membros_projeto() to authenticated;

-- conferência: a obra original precisa existir para alguém conseguir entrar
select id, nome from public.obras where detalhes_fixos;
