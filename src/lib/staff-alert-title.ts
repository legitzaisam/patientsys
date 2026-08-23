/** Split "Message from Name" / "Urgent from Name: legacy topic" into headline + optional topic. */
export function parseStaffAlertTitle(title: string): { headline: string; topic: string | null } {
  const withTopic = title.match(/^(Message|Urgent) from (.+?): (.+)$/i);
  if (withTopic) {
    const topic = withTopic[3]!.trim();
    return {
      headline: `${withTopic[1]} from ${withTopic[2]}`,
      topic: topic || null,
    };
  }
  const plain = title.match(/^(Message|Urgent) from (.+)$/i);
  if (plain) {
    return { headline: `${plain[1]} from ${plain[2]}`, topic: null };
  }
  return { headline: title, topic: null };
}

/** Toast title + preview for team alerts / chat pings. */
export function formatTeamAlertToast(input: {
  title: string;
  body?: string | null;
  kind?: string | null;
  urgent?: boolean | null;
}): { title: string; description?: string } {
  const { headline, topic } = parseStaffAlertTitle(input.title);
  const body = (input.body ?? "").trim();
  const isChat = input.kind === "staff_chat";
  const isUrgent = Boolean(input.urgent) || input.kind === "urgent";

  const fromMatch = headline.match(/^(?:Message|Urgent) from (.+)$/i);
  const fromName = fromMatch?.[1]?.trim() || null;

  if (isChat) {
    return {
      title: fromName ? `${fromName} messaged you` : "New chat message",
      description: body ? `“${body.slice(0, 160)}”` : undefined,
    };
  }

  if (isUrgent) {
    return {
      title: fromName ? `Urgent from ${fromName}` : "Urgent team alert",
      description: body || topic || undefined,
    };
  }

  return {
    title: headline || "New team message",
    description: body || topic || undefined,
  };
}
