-- ═══════════════════════════════════════════════════════════════
--  0014 — PLS não é guardada como arquivo
--
--  Decisão do dono da obra: o PDF da PLS é só lido no navegador para
--  preencher os percentuais da medição; depois de confirmada a
--  medição, o arquivo é descartado. Nada vai para o Storage.
--  Remove as regras de acesso do bucket "pls" criado na 0013 e o
--  próprio bucket (só se estiver vazio). medicoes.pls_arquivo fica
--  sem uso (sempre nulo).
-- ═══════════════════════════════════════════════════════════════

drop policy if exists p_pls_sel on storage.objects;
drop policy if exists p_pls_ins on storage.objects;
drop policy if exists p_pls_del on storage.objects;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'pls')
     and not exists (select 1 from storage.objects where bucket_id = 'pls') then
    perform set_config('storage.allow_delete_query', 'true', true);   -- só nesta transação
    delete from storage.buckets where id = 'pls';
  end if;
exception when others then
  raise notice 'bucket pls não removido: %', sqlerrm;
end $$;

drop function if exists public.obra_da_pasta(text);

update public.medicoes set pls_arquivo = null where pls_arquivo is not null;

select (select count(*) from storage.buckets where id = 'pls') bucket_pls_restante,
       (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'p_pls_%') policies_restantes;
