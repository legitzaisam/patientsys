
CREATE TABLE public.staff_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_documents TO authenticated;
GRANT ALL ON public.staff_documents TO service_role;
ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own docs select" ON public.staff_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "own docs insert" ON public.staff_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own docs delete" ON public.staff_documents FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "staff files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'staff-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'owner')));
CREATE POLICY "staff files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "staff files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'staff-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "staff files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'staff-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'owner')));
