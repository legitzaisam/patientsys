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
