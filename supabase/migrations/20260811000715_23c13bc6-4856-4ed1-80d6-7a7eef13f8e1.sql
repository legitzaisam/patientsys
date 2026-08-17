CREATE POLICY "staff read patient photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "staff upload patient photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "staff update patient photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "staff delete patient photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));