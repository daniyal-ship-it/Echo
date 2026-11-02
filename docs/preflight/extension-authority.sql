-- Run through the already connected Supabase account as the intended migration
-- role. Metadata only; this does NOT establish the deployed backend's identity.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database() AS database, current_user AS execution_role,
       session_user AS session_role, current_setting('search_path') AS search_path,
       current_schemas(false) AS resolved_path,
       (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
       current_setting('shared_preload_libraries',true) AS shared_libraries,
       current_setting('session_preload_libraries',true) AS session_libraries,
       current_setting('supautils.privileged_extensions',true) AS privileged_extensions,
       current_setting('supautils.privileged_role',true) AS privileged_role,
       current_setting('supautils.default_extension_install_schema',true) AS default_extension_schema,
       CASE WHEN nullif(current_setting('supautils.extensions_parameter_overrides',true),'') IS NOT NULL
         THEN current_setting('supautils.extensions_parameter_overrides')::jsonb -> 'vector'
         ELSE NULL END AS vector_schema_override;
SELECT name,version,superuser,trusted,relocatable,schema,requires
FROM pg_available_extension_versions WHERE name='vector' AND version='0.8.2';
ROLLBACK;
