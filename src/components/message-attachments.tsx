import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

export type Attachment = { path: string; name: string; type: string; size: number };

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Renders message attachments as signed, time-limited links. */
export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function sign() {
      const next: Record<string, string> = {};
      for (const a of attachments) {
        if (DEMO_MODE) {
          next[a.path] = a.path;
          continue;
        }
        const { data } = await supabase.storage.from("message-attachments").createSignedUrl(a.path, 3600);
        if (data?.signedUrl) next[a.path] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    if (attachments.length) void sign();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(attachments.map((a) => a.path))]);

  if (!attachments.length) return null;

  return (
    <ul className="mt-2 space-y-1">
      {attachments.map((a) => {
        const url = urls[a.path];
        const isImage = a.type?.startsWith("image/");
        return (
          <li key={a.path}>
            {isImage && url ? (
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={a.name} className="max-h-40 rounded-xl border border-glass-line object-cover" />
              </a>
            ) : (
              <a
                href={url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-current/20 px-2 py-1 text-2xs underline-offset-2 hover:underline"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[180px] truncate">{a.name}</span>
                <span className="opacity-70">{formatSize(a.size)}</span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
