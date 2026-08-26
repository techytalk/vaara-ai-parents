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
