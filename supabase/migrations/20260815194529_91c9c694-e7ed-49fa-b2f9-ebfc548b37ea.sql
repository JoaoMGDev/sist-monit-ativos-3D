DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS user_roles_select_authenticated ON public.user_roles;
CREATE POLICY user_roles_select_own_or_admin ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;