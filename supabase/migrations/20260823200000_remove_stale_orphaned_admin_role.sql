-- zuzel (26127690-572c-4f9a-a380-28512dd1d0ab) is one of the 6 orphaned Lovable-migration
-- profiles: has a public.profiles row and a public.user_roles admin grant, but no matching
-- auth.users row (never migrated, can't log in - see project_lovable_migration_orphaned_users memory).
--
-- This stale admin row breaks owner_requests_notify_admin() (migration 20260707002051): the
-- trigger loops over every admin/super_admin in user_roles and calls notify(), which inserts
-- into public.notifications(user_id ...) - a column with a hard FK to auth.users(id). Looping
-- into zuzel's phantom admin row throws "notifications_user_id_fkey", which aborts the whole
-- owner_requests INSERT. Net effect: submitting an owner request is currently broken for
-- every real user in production, not just this account.
--
-- Removing the role grants nothing away (the account can't authenticate to use it anyway) and
-- unblocks the trigger.
DELETE FROM public.user_roles
WHERE user_id = '26127690-572c-4f9a-a380-28512dd1d0ab'
  AND role = 'admin';
