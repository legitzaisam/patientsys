CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'owner');
$$;

-- patients
DROP POLICY IF EXISTS "staff manage patients" ON public.patients;
CREATE POLICY "staff read patients" ON public.patients FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff add patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "staff edit patients" ON public.patients FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "owners delete patients" ON public.patients FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- treatments
DROP POLICY IF EXISTS "staff manage treatments" ON public.treatments;
CREATE POLICY "staff read treatments" ON public.treatments FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff add treatments" ON public.treatments FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "staff edit treatments" ON public.treatments FOR UPDATE TO authenticated USING (is_owner(auth.uid()) OR practitioner_id = auth.uid()) WITH CHECK (is_owner(auth.uid()) OR practitioner_id = auth.uid());
CREATE POLICY "owners delete treatments" ON public.treatments FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- documents
DROP POLICY IF EXISTS "staff manage documents" ON public.documents;
CREATE POLICY "staff read documents" ON public.documents FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff add documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "staff edit documents" ON public.documents FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "owners delete documents" ON public.documents FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- appointments
DROP POLICY IF EXISTS "staff manage appointments" ON public.appointments;
CREATE POLICY "staff read appointments" ON public.appointments FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff add appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "staff edit appointments" ON public.appointments FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "owners delete appointments" ON public.appointments FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- photos
DROP POLICY IF EXISTS "staff manage photos" ON public.treatment_photos;
CREATE POLICY "staff read photos" ON public.treatment_photos FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff add photos" ON public.treatment_photos FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "staff edit photos" ON public.treatment_photos FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "owners delete photos" ON public.treatment_photos FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- messages
DROP POLICY IF EXISTS "staff manage messages" ON public.messages;
CREATE POLICY "staff read messages" ON public.messages FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "owners delete messages" ON public.messages FOR DELETE TO authenticated USING (is_owner(auth.uid()));

-- catalogue: staff read only, owners manage
DROP POLICY IF EXISTS "staff manage catalogue" ON public.treatment_catalogue;
CREATE POLICY "staff read catalogue" ON public.treatment_catalogue FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- staff role administration by owners
CREATE POLICY "owners add roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "owners change roles" ON public.user_roles FOR UPDATE TO authenticated USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));
CREATE POLICY "owners remove roles" ON public.user_roles FOR DELETE TO authenticated USING (is_owner(auth.uid()) AND user_id <> auth.uid());

CREATE POLICY "owners edit staff profiles" ON public.profiles FOR UPDATE TO authenticated USING (is_owner(auth.uid())) WITH CHECK (is_owner(auth.uid()));