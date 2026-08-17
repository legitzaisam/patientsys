CREATE POLICY "staff read message attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'message-attachments' AND is_staff(auth.uid()));

CREATE POLICY "staff upload message attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-attachments' AND is_staff(auth.uid()));

CREATE POLICY "patient read own message attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = public.current_patient_id()::text);

CREATE POLICY "patient upload own message attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = public.current_patient_id()::text);

CREATE POLICY "owners delete message attachments" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-attachments' AND is_owner(auth.uid()));