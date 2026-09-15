/**
 * Demo twin of access.server.ts: the same outcomes over the in-memory fixture
 * documents, so the public signing route behaves identically in demo mode.
 */
import { documents } from "@/lib/demo/data";
import {
  classifyDocument,
  type PublicDocument,
  type ResolveOutcome,
  type SignOutcome,
} from "./access.server";

type Row = Record<string, unknown>;

function findByToken(token: string): Row | null {
  return (documents as Row[]).find((d) => d["access_token"] === token) ?? null;
}

function publicView(row: Row): PublicDocument {
  return {
    id: String(row["id"]),
    title: String(row["title"]),
    body: (row["body"] as string | null) ?? null,
    kind: String(row["kind"]),
    status: String(row["status"]),
    expires_at: (row["expires_at"] as string | null) ?? null,
  };
}

export async function resolveDocumentByTokenDemo(token: string): Promise<ResolveOutcome> {
  const row = findByToken(token);
  const outcome = classifyDocument(row ? publicView(row) : null);
  if (outcome.outcome === "ok" && row && !row["viewed_at"]) {
    row["viewed_at"] = new Date().toISOString();
    if (row["status"] === "sent") row["status"] = "viewed";
    return { outcome: "ok", document: publicView(row) };
  }
  return outcome;
}

export async function signDocumentByTokenDemo(
  token: string,
  signedName: string,
): Promise<SignOutcome> {
  const name = signedName.trim();
  if (!name || name.length > 200) return { outcome: "not_found" };

  const row = findByToken(token);
  const classified = classifyDocument(row ? publicView(row) : null);
  if (classified.outcome !== "ok" || !row) {
    return classified.outcome === "signed" ? { outcome: "signed" } : { outcome: "not_found" };
  }

  row["status"] = "signed";
  row["signed_at"] = new Date().toISOString();
  row["signed_name"] = name;
  row["signature_data"] = name;
  return { outcome: "ok" };
}
