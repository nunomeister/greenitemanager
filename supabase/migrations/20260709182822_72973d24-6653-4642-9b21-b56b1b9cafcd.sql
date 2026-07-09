REVOKE ALL ON FUNCTION public.reset_my_data() FROM public;
REVOKE ALL ON FUNCTION public.reset_my_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_my_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_my_data() TO service_role;