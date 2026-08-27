-- Undo on /karty. Swiping left writes a five-day cooldown row, and until now
-- there was no way back: the original table was granted SELECT, INSERT and
-- UPDATE only, with matching policies, so a mis-swipe exiled a place for the
-- full cooldown with no recourse.
--
-- Undo has to remove the row rather than backdate it: backdating would leave a
-- row claiming the user skipped the place at a time they never did, and the
-- deck query reads skipped_at directly.

GRANT DELETE ON public.place_swipe_skips TO authenticated;

CREATE POLICY "swipe_skips owner delete" ON public.place_swipe_skips FOR DELETE TO authenticated
  USING (user_id = auth.uid());
