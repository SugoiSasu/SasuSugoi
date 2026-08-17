REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, text, uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_award_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_reverse_on_delete() FROM PUBLIC, anon, authenticated;

