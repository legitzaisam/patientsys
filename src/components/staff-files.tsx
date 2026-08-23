import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, FileText, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { addMyDocument, deleteMyDocument, listMyDocuments, setMyAvatar } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = "staff-files";

export const CATEGORIES = [
  { value: "jccp_register", label: "JCCP register entry", hint: "JCCP practitioner register confirmation" },
  { value: "statutory_registration", label: "Statutory registration", hint: "GMC / GDC / NMC / GPhC / HCPC certificate" },
  { value: "qualification", label: "Qualification / Ofqual certificate", hint: "Level 4–7 aesthetics or clinical qualification" },
  { value: "indemnity_insurance", label: "Medical indemnity insurance", hint: "Current cover schedule" },
  { value: "dbs", label: "DBS check", hint: "Enhanced DBS disclosure" },
  { value: "training", label: "CPD / training certificate", hint: "Product, technique or CPD training" },
  { value: "bls", label: "BLS & anaphylaxis training", hint: "Basic life support and emergency management" },
  { value: "infection_control", label: "Infection control & sharps", hint: "Infection prevention, waste and sharps training" },
  { value: "safeguarding", label: "Safeguarding training", hint: "Adults and children safeguarding" },
  { value: "information_governance", label: "Information governance / GDPR", hint: "Data protection and confidentiality training" },
  { value: "right_to_work", label: "Right to work / ID", hint: "Passport, visa or share code evidence" },
  { value: "immunisation", label: "Immunisation record", hint: "Hepatitis B and occupational health" },
  { value: "contract", label: "Contract & policies", hint: "Employment contract, signed clinic policies" },
  { value: "other", label: "Other", hint: "Anything else held on your staff file" },
];

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function openSigned(path: string) {
  if (DEMO_MODE) {
    if (path.startsWith("blob:")) window.open(path, "_blank", "noopener");
    else toast.info("Demo mode — sample file, nothing stored");
    return;
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error("Could not open this file");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

export function StaffAvatar({
  userId,
  fullName,
  avatarPath,
  readOnly,
  queryKey,
  size = "lg",
}: {
  userId: string;
  fullName: string;
  avatarPath?: string | null;
  readOnly?: boolean;
  queryKey?: string[];
  /** lg = own profile; md = staff profile editor; sm = compact staff card */
  size?: "sm" | "md" | "lg";
}) {
  const queryClient = useQueryClient();
  const { data: identity } = useIdentity();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatarRef = useRef<HTMLInputElement | null>(null);
  const isManagerView = userId !== identity?.userId;
  const qKey = queryKey ?? ["my-profile", userId];

  useEffect(() => {
    let cancelled = false;
    async function sign() {
      if (!avatarPath) return setAvatarUrl(null);
      if (DEMO_MODE) return setAvatarUrl(avatarPath.startsWith("blob:") ? avatarPath : null);
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(avatarPath, 3600);
      if (!cancelled) setAvatarUrl(data?.signedUrl ?? null);
    }
    void sign();
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  const saveAvatar = useMutation({
    mutationFn: useServerFn(setMyAvatar),
    onSuccess: () => {
      toast.success("Profile picture updated");
      queryClient.invalidateQueries({ queryKey: qKey });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleAvatar(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setBusy(true);
    try {
      const path = DEMO_MODE
        ? URL.createObjectURL(file)
        : `${userId}/avatar/${crypto.randomUUID()}-${safeName(file.name)}`;
      if (!DEMO_MODE) {
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      const payload: { path: string; targetUserId?: string } = { path };
      if (isManagerView) payload.targetUserId = userId;
      saveAvatar.mutate({ data: payload });
    } finally {
      setBusy(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex w-full flex-col items-center gap-2.5 text-center">
      <Avatar
        className={cn(
          "ring-1 ring-border/60",
          size === "sm" ? "h-20 w-20" : size === "md" ? "h-28 w-28" : "h-40 w-40",
        )}
      >
        {avatarUrl && <AvatarImage src={avatarUrl} alt={`${fullName} profile picture`} />}
        <AvatarFallback className={size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl"}>
          {initials || "?"}
        </AvatarFallback>
      </Avatar>
      <input
        ref={avatarRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleAvatar(e.target.files?.[0])}
      />
      {!readOnly && (
        <div className={cn("flex w-full flex-col items-center gap-1.5", size === "sm" && "px-0.5")}>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 w-full", size === "lg" && "max-w-[10.5rem]", size === "md" && "max-w-none")}
            disabled={busy}
            onClick={() => avatarRef.current?.click()}
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            {avatarPath ? "Change photo" : "Upload photo"}
          </Button>
          {avatarPath && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-2xs"
              disabled={busy}
              onClick={() => {
                const payload: { path: null; targetUserId?: string } = { path: null };
                if (isManagerView) payload.targetUserId = userId;
                saveAvatar.mutate({ data: payload });
              }}
            >
              Remove
            </Button>
          )}
          <p className={cn(
            "text-pretty text-2xs leading-snug text-muted-foreground",
            size === "lg" ? "max-w-[10.5rem]" : "max-w-full",
          )}>
            JPG or PNG, up to 10 MB
          </p>
        </div>
      )}
    </div>
  );
}

export function StaffDocuments({
  userId,
  readOnly,
  queryKey,
}: {
  userId: string;
  readOnly?: boolean;
  queryKey?: string[];
}) {
  const queryClient = useQueryClient();
  const { data: identity } = useIdentity();
  const fetchDocs = useServerFn(listMyDocuments);
  const isManagerView = userId !== identity?.userId;
  const qKey = queryKey ?? ["my-documents", userId];
  const { data: docs } = useQuery({
    queryKey: qKey,
    queryFn: () => fetchDocs({ data: isManagerView ? { targetUserId: userId } : {} }),
  });

  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("jccp_register");
  const docRef = useRef<HTMLInputElement | null>(null);

  const addDoc = useMutation({
    mutationFn: useServerFn(addMyDocument),
    onSuccess: () => {
      toast.success("Document uploaded");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: qKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeDoc = useMutation({
    mutationFn: useServerFn(deleteMyDocument),
    onSuccess: () => {
      toast.success("Document removed");
      queryClient.invalidateQueries({ queryKey: qKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDoc(file?: File | null) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File must be under 10 MB");
      return;
    }
    setBusy(true);
    try {
      const path = DEMO_MODE
        ? URL.createObjectURL(file)
        : `${userId}/documents/${crypto.randomUUID()}-${safeName(file.name)}`;
      if (!DEMO_MODE) {
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      addDoc.mutate({
        data: {
          title: title.trim() || file.name,
          category,
          path,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        },
      });
    } finally {
      setBusy(false);
      if (docRef.current) docRef.current.value = "";
    }
  }

  const list = (docs ?? []) as any[];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Documents</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {readOnly
              ? "Records held on file for JCCP and UK clinic practice. Managers can open but not edit these."
              : "Records required for JCCP and UK clinic practice. Stored privately — only you and clinic managers can open them."}
          </p>
        </div>
        <Badge variant="outline" className="rounded-xl text-2xs uppercase">
          {list.length} on file
        </Badge>
      </div>

      {!readOnly && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_260px_auto] sm:items-end">
          <div className="field-stack">
            <Label htmlFor="doc-title">Document name</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JCCP registration certificate"
            />
          </div>
          <div className="field-stack">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input ref={docRef} type="file" className="hidden" onChange={(e) => void handleDoc(e.target.files?.[0])} />
          <Button disabled={busy} onClick={() => docRef.current?.click()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
          </Button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-edge overflow-hidden rounded-2xl border border-edge">
        {CATEGORIES.map((c) => {
          const items = list.filter((d) => d.category === c.value);
          return (
            <li key={c.value} className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-foreground">{c.label}</h3>
                  <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">{c.hint}</p>
                </div>
                {items.length === 0 ? (
                  <span className="shrink-0 pt-0.5 text-2xs text-muted-foreground">Not uploaded</span>
                ) : (
                  <span className="shrink-0 pt-0.5 text-2xs font-medium text-success-ink">
                    {items.length} on file
                  </span>
                )}
              </div>
              {items.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {items.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-glass-line bg-glass-2/50 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => void openSigned(d.path)}
                        className="flex min-w-0 items-center gap-2.5 text-left"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-ink-3" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground underline-offset-2 hover:underline">
                            {d.title}
                          </span>
                          <span className="block truncate text-2xs text-muted-foreground">
                            {d.file_name} {formatSize(d.file_size)} ·{" "}
                            {new Date(d.created_at).toLocaleDateString("en-GB")}
                          </span>
                        </span>
                      </button>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeDoc.mutate({ data: { id: d.id } })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
        {list.some((d) => !CATEGORIES.find((c) => c.value === d.category))
          ? list
              .filter((d) => !CATEGORIES.find((c) => c.value === d.category))
              .map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <button
                    type="button"
                    onClick={() => void openSigned(d.path)}
                    className="flex min-w-0 items-center gap-2.5 text-left"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-ink-3" />
                    <span className="min-w-0 truncate text-sm text-foreground">{d.title}</span>
                  </button>
                  <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                    {categoryLabel(d.category)}
                  </Badge>
                </li>
              ))
          : null}
      </ul>
    </Card>
  );
}
