-- pgcrypto lives in the extensions schema on hosted Supabase.
-- gen_random_bytes() is not in core Postgres; gen_random_uuid() is.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ENUMS
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('owner','practitioner','front_desk','patient'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.patient_status AS ENUM ('active','inactive','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.document_kind AS ENUM ('consent','treatment_plan','consultation','aftercare','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.document_status AS ENUM ('draft','sent','viewed','signed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.photo_kind AS ENUM ('before','after'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.message_author AS ENUM ('staff','patient'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CLINICS
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- PROFILES (staff)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  job_title text,
  registration_body text,
  registration_number text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','practitioner','front_desk')
  );
$$;

-- PATIENTS
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid,
  reference text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  email text,
  phone text,
  status public.patient_status NOT NULL DEFAULT 'active',
  allergies text,
  medications text,
  conditions text,
  notes text,
  avatar_url text,
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patients_clinic_idx ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS patients_user_idx ON public.patients(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_patient_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1;
$$;

-- TREATMENT CATALOGUE
CREATE TABLE IF NOT EXISTS public.treatment_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  description text,
  price numeric(10,2),
  interval_days integer,
  cooling_off_hours integer NOT NULL DEFAULT 0,
  requires_consent boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_catalogue TO authenticated;
GRANT ALL ON public.treatment_catalogue TO service_role;
ALTER TABLE public.treatment_catalogue ENABLE ROW LEVEL SECURITY;

-- TREATMENTS
CREATE TABLE IF NOT EXISTS public.treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  catalogue_id uuid REFERENCES public.treatment_catalogue(id) ON DELETE SET NULL,
  practitioner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  product text,
  dose text,
  area text,
  notes text,
  price numeric(10,2),
  performed_at timestamptz NOT NULL DEFAULT now(),
  next_due_at date,
  status text NOT NULL DEFAULT 'completed',
  consent_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS treatments_patient_idx ON public.treatments(patient_id);
CREATE INDEX IF NOT EXISTS treatments_due_idx ON public.treatments(next_due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatments TO authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

-- PHOTOS
CREATE TABLE IF NOT EXISTS public.treatment_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  kind public.photo_kind NOT NULL,
  caption text,
  taken_at timestamptz NOT NULL DEFAULT now(),
  marketing_consent boolean NOT NULL DEFAULT false,
  visible_to_patient boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS treatment_photos_patient_idx ON public.treatment_photos(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_photos TO authenticated;
GRANT ALL ON public.treatment_photos TO service_role;
ALTER TABLE public.treatment_photos ENABLE ROW LEVEL SECURITY;

-- DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  kind public.document_kind NOT NULL,
  title text NOT NULL,
  body text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  responses jsonb,
  status public.document_status NOT NULL DEFAULT 'draft',
  access_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24),'hex'),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signed_name text,
  signature_data text,
  signed_ip text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_patient_idx ON public.documents(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  author public.message_author NOT NULL,
  author_id uuid,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_patient_idx ON public.messages(patient_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- MEDICAL HISTORY VERSIONS
CREATE TABLE IF NOT EXISTS public.medical_history_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  source public.message_author NOT NULL DEFAULT 'patient',
  changed_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mhv_patient_idx ON public.medical_history_versions(patient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.medical_history_versions TO authenticated;
GRANT ALL ON public.medical_history_versions TO service_role;
ALTER TABLE public.medical_history_versions ENABLE ROW LEVEL SECURITY;

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  actor_id uuid,
  actor_label text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  patient_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- TRIGGERS
DROP TRIGGER IF EXISTS clinics_updated ON public.clinics;
CREATE TRIGGER clinics_updated BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS patients_updated ON public.patients;
CREATE TRIGGER patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS catalogue_updated ON public.treatment_catalogue;
CREATE TRIGGER catalogue_updated BEFORE UPDATE ON public.treatment_catalogue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS treatments_updated ON public.treatments;
CREATE TRIGGER treatments_updated BEFORE UPDATE ON public.treatments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS documents_updated ON public.documents;
CREATE TRIGGER documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NEW USER HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic uuid;
BEGIN
  SELECT id INTO v_clinic FROM public.clinics ORDER BY created_at LIMIT 1;
  INSERT INTO public.profiles (id, clinic_id, full_name)
  VALUES (NEW.id, v_clinic, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  UPDATE public.patients SET user_id = NEW.id
    WHERE user_id IS NULL AND lower(email) = lower(NEW.email);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- POLICIES
DROP POLICY IF EXISTS "staff read clinics" ON public.clinics;
CREATE POLICY "staff read clinics" ON public.clinics FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owners manage clinics" ON public.clinics;
CREATE POLICY "owners manage clinics" ON public.clinics FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff manage patients" ON public.patients;
CREATE POLICY "staff manage patients" ON public.patients FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "patient reads own record" ON public.patients;
CREATE POLICY "patient reads own record" ON public.patients FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "patient updates own contact" ON public.patients;
CREATE POLICY "patient updates own contact" ON public.patients FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "staff manage catalogue" ON public.treatment_catalogue;
CREATE POLICY "staff manage catalogue" ON public.treatment_catalogue FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "patients read catalogue" ON public.treatment_catalogue;
CREATE POLICY "patients read catalogue" ON public.treatment_catalogue FOR SELECT TO authenticated USING (active);

DROP POLICY IF EXISTS "staff manage treatments" ON public.treatments;
CREATE POLICY "staff manage treatments" ON public.treatments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "patient reads own treatments" ON public.treatments;
CREATE POLICY "patient reads own treatments" ON public.treatments FOR SELECT TO authenticated USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "staff manage photos" ON public.treatment_photos;
CREATE POLICY "staff manage photos" ON public.treatment_photos FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "patient reads own photos" ON public.treatment_photos;
CREATE POLICY "patient reads own photos" ON public.treatment_photos FOR SELECT TO authenticated USING (patient_id = public.current_patient_id() AND visible_to_patient);

DROP POLICY IF EXISTS "staff manage documents" ON public.documents;
CREATE POLICY "staff manage documents" ON public.documents FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "patient reads own documents" ON public.documents;
CREATE POLICY "patient reads own documents" ON public.documents FOR SELECT TO authenticated USING (patient_id = public.current_patient_id());
DROP POLICY IF EXISTS "patient signs own documents" ON public.documents;
CREATE POLICY "patient signs own documents" ON public.documents FOR UPDATE TO authenticated USING (patient_id = public.current_patient_id()) WITH CHECK (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS "staff manage messages" ON public.messages;
CREATE POLICY "staff manage messages" ON public.messages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "patient reads own messages" ON public.messages;
CREATE POLICY "patient reads own messages" ON public.messages FOR SELECT TO authenticated USING (patient_id = public.current_patient_id());
DROP POLICY IF EXISTS "patient sends own messages" ON public.messages;
CREATE POLICY "patient sends own messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (patient_id = public.current_patient_id() AND author = 'patient');

DROP POLICY IF EXISTS "staff read history" ON public.medical_history_versions;
CREATE POLICY "staff read history" ON public.medical_history_versions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff write history" ON public.medical_history_versions;
CREATE POLICY "staff write history" ON public.medical_history_versions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff review history" ON public.medical_history_versions;
CREATE POLICY "staff review history" ON public.medical_history_versions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "patient reads own history" ON public.medical_history_versions;
CREATE POLICY "patient reads own history" ON public.medical_history_versions FOR SELECT TO authenticated USING (patient_id = public.current_patient_id());
DROP POLICY IF EXISTS "patient adds own history" ON public.medical_history_versions;
CREATE POLICY "patient adds own history" ON public.medical_history_versions FOR INSERT TO authenticated WITH CHECK (patient_id = public.current_patient_id() AND source = 'patient');

DROP POLICY IF EXISTS "owners read audit" ON public.audit_log;
CREATE POLICY "owners read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'owner'));
DROP POLICY IF EXISTS "authenticated append audit" ON public.audit_log;
CREATE POLICY "authenticated append audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- SEED CLINIC + CATALOGUE
INSERT INTO public.clinics (id, name, address, phone, email)
VALUES ('11111111-1111-4111-8111-111111111111','Aetheria Medical','12 Harley Street, London W1G 9PG','+44 20 7946 0100','hello@aetheria.clinic')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.treatment_catalogue (clinic_id, name, category, description, price, interval_days, cooling_off_hours, requires_consent)
SELECT v.clinic_id, v.name, v.category, v.description, v.price, v.interval_days, v.cooling_off_hours, v.requires_consent
FROM (
  VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid,'Botulinum Toxin Type A','Injectable','Wrinkle-relaxing injections, upper or lower face',295.00,120,48,true),
    ('11111111-1111-4111-8111-111111111111'::uuid,'Hyaluronic Acid Dermal Filler','Injectable','Volume restoration and contouring',450.00,270,48,true),
    ('11111111-1111-4111-8111-111111111111'::uuid,'Polynucleotide Skin Booster','Injectable','Skin quality and hydration course',280.00,90,48,true),
    ('11111111-1111-4111-8111-111111111111'::uuid,'Medical Grade Chemical Peel','Skin','Resurfacing peel for texture and pigmentation',180.00,42,24,true),
    ('11111111-1111-4111-8111-111111111111'::uuid,'Microneedling with RF','Skin','Collagen induction with radiofrequency',350.00,42,24,true),
    ('11111111-1111-4111-8111-111111111111'::uuid,'HydraFacial','Skin','Deep cleanse, extract and hydrate',150.00,30,0,false),
    ('11111111-1111-4111-8111-111111111111'::uuid,'Aesthetic Consultation','Consultation','Full facial assessment and treatment planning',0.00,NULL,0,false)
) AS v(clinic_id, name, category, description, price, interval_days, cooling_off_hours, requires_consent)
WHERE NOT EXISTS (SELECT 1 FROM public.treatment_catalogue LIMIT 1);
