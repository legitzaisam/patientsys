import type { AnimationEvent, FormEvent } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Provisioned clinic logins. Passwords match scripts/provision-staff.mjs. */
export const STAFF_LOGINS = [
  {
    email: "nadia.rahman@aetheria.clinic",
    password: "Practitioner1!",
    label: "Dr Nadia Rahman",
    detail: "Practitioner",
  },
  {
    email: "tom.whitfield@aetheria.clinic",
    password: "Practitioner2!",
    label: "Dr Tom Whitfield",
    detail: "Practitioner",
  },
  {
    email: "sofia.marchetti@aetheria.clinic",
    password: "Reception1!",
    label: "Sofia Marchetti",
    detail: "Receptionist",
  },
  {
    email: "developer@aetheria.clinic",
    password: "Developer1!",
    label: "Software developer",
    detail: "Software admin",
  },
] as const;

/** Reads a browser-filled value into React state. */
export function autofillHandlers(setValue: (value: string) => void) {
  return {
    onInput: (event: FormEvent<HTMLInputElement>) => setValue(event.currentTarget.value),
    onAnimationStart: (event: AnimationEvent<HTMLInputElement>) => {
      if (event.animationName === "aetheria-autofill") setValue(event.currentTarget.value);
    },
  };
}

/** Fills the email and password for a known account. The visitor still presses Sign in. */
export function LoginAutofill({
  onFill,
}: {
  onFill: (email: string, password: string) => void;
}) {
  return (
    <div className="field-stack">
      <Label htmlFor="login-autofill">Autofill</Label>
      <Select
        onValueChange={(email) => {
          const account = STAFF_LOGINS.find((row) => row.email === email);
          if (account) onFill(account.email, account.password);
        }}
      >
        <SelectTrigger id="login-autofill" aria-label="Autofill an account">
          <SelectValue placeholder="Choose an account" />
        </SelectTrigger>
        <SelectContent>
          {STAFF_LOGINS.map((account) => (
            <SelectItem key={account.email} value={account.email}>
              {account.label} — {account.detail}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
