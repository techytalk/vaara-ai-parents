import { createCipheriv, createHash, createHmac, randomBytes } from "crypto";

function secret(): string {
  return process.env.OAUTH_SIGNING_SECRET?.trim() || "dev-oauth-signing-secret";
}

function key(): Buffer {
  return createHash("sha256").update(secret()).digest();
}

export function emailHmac(email: string): string {
  return createHmac("sha256", secret()).update(email.toLowerCase()).digest("hex");
}

export function encryptEmail(email: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function authOrigin(): string {
  return process.env.PUBLIC_AUTH_ORIGIN?.trim() || "https://auth.vaara.ai";
}

export function jeePrepOrigin(): string {
  return process.env.JEE_PREP_URL?.trim() || "https://vaara-jee-prep.vercel.app";
}

export async function sendPrepApprovalEmail(input: {
  to: string;
  nickname: string;
  classBand: string;
  userCode: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const approveUrl = `${authOrigin()}/oauth/device?user_code=${encodeURIComponent(input.userCode)}`;
  const blockUrl = `${authOrigin()}/oauth/device/block?user_code=${encodeURIComponent(input.userCode)}`;
  const text = [
    `${input.nickname} (${input.classBand}) wants to join JEE Prep and keep a streak.`,
    "",
    `Review the request: ${approveUrl}`,
    "",
    `This isn't my child: ${blockUrl}`,
    "",
    "The request expires in 7 days.",
  ].join("\n");

  if (!apiKey) {
    console.log("[prep-mail] approval email skipped", approveUrl);
    return false;
  }

  const from = process.env.PREP_APPROVAL_FROM?.trim() || "Vaara <approvals@vaara.ai>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `${input.nickname} wants to join JEE Prep`,
      text,
    }),
  });
  if (!response.ok) {
    console.error("[prep-mail] approval email failed", response.status);
    return false;
  }
  return true;
}
