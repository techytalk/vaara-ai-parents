export type ParentBlockedAlert = {
  blockerId: string;
  blockedId: string;
  blockerHandle?: string | null;
  blockedHandle?: string | null;
  postId?: string | null;
  messageId?: string | null;
  contentPreview?: string | null;
};

/**
 * Emails support when a parent blocks another parent.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs and returns.
 */
export async function sendParentBlockedAlert(
  alert: ParentBlockedAlert
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log("[safety-alert] email skipped");
    return;
  }

  const from =
    process.env.SAFETY_ALERT_FROM?.trim() || "Raj <Raj@vaara.ai>";
  const to = process.env.SAFETY_ALERT_EMAIL?.trim() || "support@vaara.ai";
  const snippet = alert.contentPreview
    ? alert.contentPreview.trim().slice(0, 280)
    : null;

  const lines = [
    "A parent blocked another parent in Vaara.",
    "",
    `Blocker: ${alert.blockerHandle ?? "(unknown)"} (${alert.blockerId})`,
    `Blocked: ${alert.blockedHandle ?? "(unknown)"} (${alert.blockedId})`,
  ];
  if (alert.postId) {
    lines.push(`Post id: ${alert.postId}`);
  }
  if (alert.messageId) {
    lines.push(`Message id: ${alert.messageId}`);
  }
  if (snippet) {
    lines.push("", "Content preview:", snippet);
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Vaara safety: parent blocked",
        text: lines.join("\n"),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "[safety-alert] email failed",
        response.status,
        detail.slice(0, 200)
      );
    }
  } catch (error) {
    console.error("[safety-alert] email failed", error);
  }
}
