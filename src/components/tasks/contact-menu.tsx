import { ChevronDown, Mail, MessageSquare, Phone } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useFloatingDock } from "@/components/floating-dock/dock-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logCallAttempt } from "@/lib/clinic.functions";
import { cn } from "@/lib/utils";

/**
 * Contact a patient without closing the task. Call / Message / Email only
 * start the channel; Handled stays a separate, manual step.
 */
export function usePatientContact() {
  const logCall = useServerFn(logCallAttempt);
  const { requestChat } = useFloatingDock();

  return {
    call: (p: { id: string; name: string; phone: string | null }) => {
      const phone = p.phone?.replace(/\s+/g, "") ?? "";
      if (!phone) {
        toast.error(`No phone number on ${p.name}'s record.`);
        return;
      }
      void logCall({ data: { patient_id: p.id, phone } }).catch(() => {});
      window.location.href = `tel:${phone}`;
    },
    message: (p: { id: string; name: string }) => {
      requestChat({ patientId: p.id, patientName: p.name });
    },
    email: (p: { name: string; email: string | null }) => {
      const email = p.email?.trim() ?? "";
      if (!email) {
        toast.error(`No email on ${p.name}'s record.`);
        return;
      }
      window.location.href = `mailto:${email}`;
    },
  };
}

const ITEM =
  "cursor-pointer rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-foreground focus:bg-[rgba(47,63,102,0.08)] focus:text-foreground";

export function ContactMenu({
  patientId,
  patientName,
  phone,
  email,
  kind = "primary",
  size = "row",
  label = "Contact",
  qc = "task-action-contact",
}: {
  patientId: string;
  patientName: string;
  phone: string | null;
  email: string | null;
  kind?: "primary" | "ghost";
  size?: "row" | "drawer";
  label?: string;
  qc?: string;
}) {
  const contact = usePatientContact();
  const hasPhone = Boolean(phone?.replace(/\s+/g, ""));
  const hasEmail = Boolean(email?.trim());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-qc={qc}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-full font-semibold shadow-inset-hi transition-[filter,background-color] hover:brightness-[0.97]",
            size === "drawer"
              ? "h-8 px-3.5 text-[12.5px]"
              : "h-7 px-3 text-[12px]",
            kind === "primary"
              ? "bg-accent text-accent-foreground"
              : "bg-[rgba(47,63,102,0.06)] text-foreground hover:bg-[rgba(47,63,102,0.1)]",
          )}
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10.5rem] p-1" data-qc="contact-menu">
        <DropdownMenuItem
          className={ITEM}
          disabled={!hasPhone}
          title={hasPhone ? `Call ${patientName}` : "No phone number on this record"}
          data-qc="task-contact-call"
          onSelect={() => contact.call({ id: patientId, name: patientName, phone })}
        >
          <Phone className="h-3.5 w-3.5 text-ink-3" aria-hidden />
          Call
        </DropdownMenuItem>
        <DropdownMenuItem
          className={ITEM}
          data-qc="task-contact-message"
          onSelect={() => contact.message({ id: patientId, name: patientName })}
        >
          <MessageSquare className="h-3.5 w-3.5 text-ink-3" aria-hidden />
          Message
        </DropdownMenuItem>
        <DropdownMenuItem
          className={ITEM}
          disabled={!hasEmail}
          title={hasEmail ? `Email ${patientName}` : "No email on this record"}
          data-qc="task-contact-email"
          onSelect={() => contact.email({ name: patientName, email })}
        >
          <Mail className="h-3.5 w-3.5 text-ink-3" aria-hidden />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
