ALTER TABLE public.treatment_colours ADD COLUMN IF NOT EXISTS hex text;
ALTER TABLE public.treatment_colours ADD CONSTRAINT treatment_colours_hex_format CHECK (hex IS NULL OR hex ~* '^#[0-9a-f]{6}$');