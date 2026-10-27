-- Consulta só de leitura para confirmar que a API de SQL funciona.
select
  current_database() as banco,
  current_setting('server_version') as postgres,
  (select count(*) from information_schema.tables where table_schema = 'public') as tabelas_public,
  exists (select 1 from pg_namespace where nspname = 'supabase_migrations') as tem_schema_migracoes;
