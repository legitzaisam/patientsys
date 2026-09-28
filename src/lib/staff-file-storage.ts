import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

export const STAFF_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const STAFF_FILE_BUCKET = "staff-files";

export const STAFF_FILE_CATEGORIES = [
  {
    value: "jccp_register",
    label: "JCCP register entry",
    hint: "JCCP practitioner register confirmation",
  },
  {
    value: "statutory_registration",
    label: "Statutory registration",
    hint: "GMC / GDC / NMC / GPhC / HCPC certificate",
  },
  {
    value: "qualification",
    label: "Qualification / Ofqual certificate",
    hint: "Level 4–7 aesthetics or clinical qualification",
  },
  {
    value: "indemnity_insurance",
    label: "Medical indemnity insurance",
    hint: "Current cover schedule",
  },
  { value: "dbs", label: "DBS check", hint: "Enhanced DBS disclosure" },
  {
    value: "training",
    label: "CPD / training certificate",
    hint: "Product, technique or CPD training",
  },
  {
    value: "bls",
    label: "BLS & anaphylaxis training",
    hint: "Basic life support and emergency management",
  },
  {
    value: "infection_control",
    label: "Infection control & sharps",
    hint: "Infection prevention, waste and sharps training",
  },
  {
    value: "safeguarding",
    label: "Safeguarding training",
    hint: "Adults and children safeguarding",
  },
  {
    value: "information_governance",
    label: "Information governance / GDPR",
    hint: "Data protection and confidentiality training",
  },
  {
    value: "right_to_work",
    label: "Right to work / ID",
    hint: "Passport, visa or share code evidence",
  },
  {
    value: "immunisation",
    label: "Immunisation record",
    hint: "Hepatitis B and occupational health",
  },
  {
    value: "contract",
    label: "Contract & policies",
    hint: "Employment contract, signed clinic policies",
  },
  { value: "other", label: "Other", hint: "Anything else held on your staff file" },
];

export function staffFileCategoryLabel(value: string) {
  return STAFF_FILE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function formatFileSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Opens a staff file in a new tab through a short-lived signed URL (demo: the local blob). */
export async function openStaffFile(path: string) {
  if (DEMO_MODE) {
    if (path.startsWith("blob:")) window.open(path, "_blank", "noopener");
    else toast.info("Demo mode — sample file, nothing stored");
    return;
  }
  const { data, error } = await supabase.storage
    .from(STAFF_FILE_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error("Could not open this file");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

/**
 * Puts a file in the staff bucket under the person's folder and returns the
 * stored path (demo: an object URL). Size is checked here so every upload
 * button behaves the same.
 */
export async function uploadStaffFile(
  userId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size > STAFF_FILE_MAX_BYTES) return { ok: false, error: "File must be under 10 MB" };
  if (DEMO_MODE) return { ok: true, path: URL.createObjectURL(file) };
  const path = `${userId}/documents/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(STAFF_FILE_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}
