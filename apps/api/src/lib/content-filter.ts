import { pool } from "@vaara/db";

export const FOUL_LANGUAGE_MESSAGE =
  "We found foul language in this message. That goes against Vaara’s community guidelines. Please fix it and try again.";

export const CHECK_UNAVAILABLE_MESSAGE =
  "We couldn’t check this message. Try again in a moment.";

/** Per-signal block lines. Judge meaning, not word presence. */
export const BLOCK_THRESHOLDS = {
  filthy: 0.6,
  sexualOrRomantic: 0.65,
  harassing: 0.5,
} as const;

/** Below block, elevated scores are allowed and logged for review. */
const REVIEW_THRESHOLDS = {
  filthy: 0.35,
  sexualOrRomantic: 0.4,
  harassing: 0.3,
} as const;

const MODEL = "gemini-flash-latest";

const SYSTEM_PROMPT = `You review one message from a parent community before it is published.
Judge the full meaning and intent. Do not score high only because a sensitive
word appears. Parents write about school, class, buses, homework, health,
safety, puberty, pregnancy, and child sex education. That is fine when the
message is a genuine parenting discussion.

Foul language, insults, scolding, threats, sexualizing someone, and unwanted
romantic or sexual approaches aimed at another parent are not fine.

Return JSON only, with this shape:
{
  "isEnglish": true,
  "language": "",
  "english": "",
  "filthy": 0.0,
  "sexualOrRomantic": 0.0,
  "harassing": 0.0
}

isEnglish is true only when the message is English.
A mix of English and another language is not English.
Local language written in English letters is not English.
When isEnglish is true, language and english are empty strings.
When isEnglish is false, language is a short name you choose
(for example Telugu, Hindi, or mixed Hindi and English).
Do not pick from a fixed list.
english is the same message in English, same tone.
Keep insults, slurs, sexual remarks, and threats.
Do not soften them into polite wording.
The three scores describe that English meaning, from 0 to 1.

filthy: foul language, insults, or slurs used as abuse.
sexualOrRomantic: sex, pornography, or romancing aimed at someone,
including a proposition. Legitimate health, puberty, pregnancy, safety,
or educational discussion must score low even when those topics are named.
harassing: scolding, threats, or sexual harassment aimed at someone.

Score high only when the meaning is abusive, insulting, scolding,
threatening, sexualizing, or making an unwanted romantic or sexual approach
toward someone. Score low for a class, bus, homework, or other parenting
question. Do not score a message higher because it is off-topic.`;

export type ContentVerdict = {
  isEnglish: boolean;
  language: string;
  english: string;
  filthy: number;
  sexualOrRomantic: number;
  harassing: number;
};

export type ContentAction = "allow" | "review" | "block";

export type ScreenOk = { ok: true; englishBody: string | null };
export type ScreenRejected = {
  ok: false;
  error: string;
  code: "content_rejected";
};

type CacheEntry = { at: number; verdict: ContentVerdict; action: ContentAction };
const recent = new Map<string, CacheEntry>();

export function filterMode(): "shadow" | "enforce" | "off" {
  if (process.env.CONTENT_FILTER_DISABLED === "1") return "off";
  const raw = process.env.CONTENT_FILTER_MODE?.trim().toLowerCase();
  if (raw === "off") return "off";
  if (raw === "enforce") return "enforce";
  return "shadow";
}

export function buildUserPrompt(input: {
  text: string;
  threadTitle?: string | null;
  replyTo?: string | null;
}): string {
  const lines = [`Message:\n"""\n${input.text.trim()}\n"""`];
  const title = input.threadTitle?.trim();
  const reply = input.replyTo?.trim();
  if (title) lines.push(`Thread title: ${title}`);
  if (reply) lines.push(`Replying to: ${reply.slice(0, 280)}`);
  return lines.join("\n\n");
}

function clampScore(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

export function parseVerdict(raw: unknown): ContentVerdict | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const isEnglish = row.isEnglish === true;
  const language = isEnglish ? "" : String(row.language ?? "").trim();
  const english = isEnglish ? "" : String(row.english ?? "").trim();
  if (!isEnglish && !english) return null;
  return {
    isEnglish,
    language,
    english,
    filthy: clampScore(row.filthy),
    sexualOrRomantic: clampScore(row.sexualOrRomantic),
    harassing: clampScore(row.harassing),
  };
}

export function decideAction(verdict: ContentVerdict): ContentAction {
  if (
    verdict.filthy >= BLOCK_THRESHOLDS.filthy ||
    verdict.sexualOrRomantic >= BLOCK_THRESHOLDS.sexualOrRomantic ||
    verdict.harassing >= BLOCK_THRESHOLDS.harassing
  ) {
    return "block";
  }
  if (
    verdict.filthy >= REVIEW_THRESHOLDS.filthy ||
    verdict.sexualOrRomantic >= REVIEW_THRESHOLDS.sexualOrRomantic ||
    verdict.harassing >= REVIEW_THRESHOLDS.harassing
  ) {
    return "review";
  }
  return "allow";
}

export function englishBodyFor(verdict: ContentVerdict): string | null {
  if (verdict.isEnglish) return null;
  const text = verdict.english.trim();
  return text || null;
}

async function callGemini(userPrompt: string): Promise<ContentVerdict | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0,
          thinkingConfig: { thinkingLevel: "low" },
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              isEnglish: { type: "BOOLEAN" },
              language: { type: "STRING" },
              english: { type: "STRING" },
              filthy: { type: "NUMBER" },
              sexualOrRomantic: { type: "NUMBER" },
              harassing: { type: "NUMBER" },
            },
            required: [
              "isEnglish",
              "language",
              "english",
              "filthy",
              "sexualOrRomantic",
              "harassing",
            ],
          },
        },
      }),
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini ${response.status} ${detail.slice(0, 180)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = [...parts]
    .reverse()
    .find((part) => part.text && part.thought !== true)?.text;
  if (!text) return null;
  return parseVerdict(JSON.parse(text));
}

async function judgeOnce(userPrompt: string): Promise<ContentVerdict | null> {
  try {
    return await callGemini(userPrompt);
  } catch (error) {
    console.error("[content-filter] retrying", error);
    try {
      return await callGemini(userPrompt);
    } catch (retryError) {
      console.error("[content-filter] unavailable", retryError);
      return null;
    }
  }
}

function remember(key: string, verdict: ContentVerdict, action: ContentAction) {
  recent.set(key, { at: Date.now(), verdict, action });
  if (recent.size <= 200) return;
  const oldest = [...recent.entries()].sort((a, b) => a[1].at - b[1].at)[0];
  if (oldest) recent.delete(oldest[0]);
}

async function writeEvent(input: {
  userId: string;
  surface: string;
  circleId?: string | null;
  threadId?: string | null;
  text: string;
  verdict: ContentVerdict;
  action: ContentAction;
  enforced: boolean;
}) {
  try {
    await pool.query(
      `INSERT INTO content_filter_events (
         user_id, surface, circle_id, thread_id, body, is_english, language,
         english_text, filthy, sexual_or_romantic, harassing, model, action, enforced
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        input.userId,
        input.surface,
        input.circleId ?? null,
        input.threadId ?? null,
        input.text,
        input.verdict.isEnglish,
        input.verdict.language || null,
        input.verdict.english || null,
        input.verdict.filthy,
        input.verdict.sexualOrRomantic,
        input.verdict.harassing,
        MODEL,
        input.action === "block" ? "blocked" : input.action,
        input.enforced,
      ]
    );
  } catch (error) {
    console.error("[content-filter] audit insert failed", error);
  }
}

export async function screenParentText(input: {
  userId: string;
  surface: string;
  text: string;
  circleId?: string | null;
  threadId?: string | null;
  threadTitle?: string | null;
  replyTo?: string | null;
}): Promise<ScreenOk | ScreenRejected> {
  const text = input.text.trim();
  if (!text) return { ok: true, englishBody: null };
  const mode = filterMode();
  if (mode === "off") return { ok: true, englishBody: null };

  const cacheKey = `${input.userId}\n${text}\n${input.threadTitle ?? ""}\n${input.replyTo ?? ""}`;
  const cached = recent.get(cacheKey);
  const fresh = cached && Date.now() - cached.at < 3 * 60 * 1000 ? cached : null;
  const verdict = fresh?.verdict ?? (await judgeOnce(buildUserPrompt(input)));
  if (!verdict) {
    if (mode === "enforce") {
      return { ok: false, error: CHECK_UNAVAILABLE_MESSAGE, code: "content_rejected" };
    }
    return { ok: true, englishBody: null };
  }
  const action = fresh?.action ?? decideAction(verdict);
  if (!fresh) remember(cacheKey, verdict, action);
  if (action !== "allow") {
    await writeEvent({
      userId: input.userId,
      surface: input.surface,
      circleId: input.circleId,
      threadId: input.threadId,
      text,
      verdict,
      action,
      enforced: mode === "enforce" && action === "block",
    });
  }
  if (mode === "enforce" && action === "block") {
    return { ok: false, error: FOUL_LANGUAGE_MESSAGE, code: "content_rejected" };
  }
  return { ok: true, englishBody: englishBodyFor(verdict) };
}
