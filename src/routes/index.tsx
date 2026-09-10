import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Camera, MessagesSquare, ClipboardCheck } from "lucide-react";
import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aetheria — Patient Records for Clinics & Medspas" },
      {
        name: "description",
        content:
          "Aesthetic clinic software for patient records, before & after photos, consent forms, treatment recall and secure patient messaging.",
      },
      { property: "og:title", content: "Aetheria — Patient Records for Clinics & Medspas" },
      {
        property: "og:description",
        content:
          "Patient records, imagery, consent and messaging built for aesthetic clinics and medspas.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Camera, title: "Before & after imagery", body: "Side-by-side photo comparison per treatment, stored in encrypted clinical storage." },
  { icon: ClipboardCheck, title: "Consent & consultation", body: "Send consent forms, treatment plans and consultation forms; patients sign in their portal." },
  { icon: MessagesSquare, title: "Direct patient comms", body: "A secure clinic-to-patient thread sits beside every record to drive rebooking." },
  { icon: ShieldCheck, title: "JCCP-aligned governance", body: "Immutable audit trail, versioned medical history and role-based access." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-edge bg-sidebar shadow-inset-hi backdrop-blur-glass backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <BrandLockup />
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/portal">Patient portal</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Staff sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-accent-ink">Clinic &amp; medspa software</p>
        <h1 className="mt-4 max-w-3xl text-[52px] font-semibold leading-[1.08] tracking-[-0.022em] text-foreground">
          Every patient, every treatment, every photo — in one considered record.
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground">
          Aetheria gives aesthetic practitioners a complete clinical record with before &amp; after
          imagery, consent and consultation forms, treatment recall and direct patient messaging —
          built around JCCP expectations and UK data protection.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Staff sign in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/portal">Patient portal</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-glass-2 text-ink-3 shadow-inset-hi">
                <f.icon className="h-4 w-4" />
              </span>
              <h2 className="mt-4 section-title">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-glass-line py-10 text-center text-xs text-muted-foreground">
        Aetheria — clinical records software for aesthetic practice.
      </footer>
    </div>
  );
}
