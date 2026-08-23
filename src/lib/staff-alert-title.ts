/** Split "Message from Name: topic" / "Urgent from Name: topic" into headline + topic. */
export function parseStaffAlertTitle(title: string): { headline: string; topic: string | null } {
  const withTopic = title.match(/^(Message|Urgent) from (.+?): (.+)$/i);
  if (withTopic) {
    return { headline: `${withTopic[1]} from ${withTopic[2]}`, topic: withTopic[3]!.trim() };
  }
  return { headline: title, topic: null };
}
