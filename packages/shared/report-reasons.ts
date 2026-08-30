export const OTHER_REPORT_REASON_ID = "other" as const;

export type ReportReasonOption = {
  id: string;
  label: string;
};

export const REPORT_REASON_OPTIONS: ReportReasonOption[] = [
  { id: "spam", label: "Spam or misleading" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "child_safety", label: "Child safety concern" },
  { id: "impersonation", label: "Impersonation or fake account" },
  { id: OTHER_REPORT_REASON_ID, label: "Something else" },
];

export function formatReportReason(
  reasonId: string,
  otherDetail?: string
): string | null {
  const option = REPORT_REASON_OPTIONS.find((item) => item.id === reasonId);
  if (!option) return null;
  if (option.id === OTHER_REPORT_REASON_ID) {
    const detail = otherDetail?.trim();
    if (!detail || detail.length < 10) return null;
    return `${option.label}: ${detail}`;
  }
  return option.label;
}
