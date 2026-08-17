CREATE POLICY "Owners can delete recall tasks" ON public.recall_tasks FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));
GRANT DELETE ON public.recall_tasks TO authenticated;