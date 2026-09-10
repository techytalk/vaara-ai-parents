const MEDICINE_PATTERNS = [
  /\b(paracetamol|ibuprofen|calpol|crocin|amoxicillin|azithromycin|cetirizine|montelukast)\b/i,
  /\b\d+\s*(mg|ml|mcg|drops?|tablet|tsp|teaspoon)\b/i,
];

const ADVICE_PATTERNS = [
  /\bshould i give\b/i,
  /\bhow much syrup\b/i,
  /\bis it normal that (his|her|my) (fever|temperature|cough|rash)\b/i,
  /\b(dose|dosage|prescribe|medication)\b/i,
  /\b(symptom|symptoms).{0,40}(give|take|use)\b/i,
];

const OBJECTIONABLE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(child\s*porn|child\s*pornography|csam|loli|lolita|preteen\s*sex|underage\s*sex)\b/i,
    reason: "This content is not allowed on Vaara.",
  },
  {
    pattern:
      /\b(porn|porno|pornography|onlyfans|xxx|nude\s+pics?|nudes|sex\s+tape|explicit\s+sex)\b/i,
    reason:
      "Sexual or pornographic content is not allowed in Vaara circles. Please keep posts suitable for a parent community.",
  },
  {
    pattern:
      /\b(kill\s+you(rself)?|i('ll| will) kill|rape|bomb\s+threat|shoot\s+up)\b/i,
    reason:
      "Threats and violent content are not allowed. If someone is in danger, contact local emergency services.",
  },
  {
    pattern: /\b(nigger|faggot|kike|tranny|retard)\b/i,
    reason: "Hate speech and slurs are not allowed on Vaara.",
  },
];

const OBJECTIONABLE_REASON =
  "This doesn't follow Vaara's community guidelines. Keep posts respectful and suitable for a parent community, or it will be removed.";

export function detectMedicalAdvice(text: string): {
  blocked: boolean;
  reason?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { blocked: false };

  for (const pattern of ADVICE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        reason:
          "This looks like medical advice or dosing guidance. Vaara cannot host that between parents — please speak with a qualified professional.",
      };
    }
  }

  for (const pattern of MEDICINE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        blocked: true,
        reason:
          "Please avoid naming medicines or doses here. Share logistics only (wait time, manner, fees) and consult a doctor for medical questions.",
      };
    }
  }

  return { blocked: false };
}

export function detectObjectionableContent(text: string): {
  blocked: boolean;
  reason?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { blocked: false };

  for (const item of OBJECTIONABLE_PATTERNS) {
    if (item.pattern.test(trimmed)) {
      return { blocked: true, reason: item.reason };
    }
  }

  return { blocked: false };
}

export function rejectObjectionableText(
  ...parts: Array<string | undefined | null>
): { error: string } | null {
  const combined = parts.filter(Boolean).join("\n");
  const result = detectObjectionableContent(combined);
  if (result.blocked) {
    return { error: result.reason ?? OBJECTIONABLE_REASON };
  }
  return null;
}
