import {
  formatReportReason,
  REPORT_REASON_OPTIONS,
} from "@vaara/shared/report-reasons";

type ReportBody = {
  reason?: string;
  reasonId?: string;
  otherDetail?: string;
};

export function parseReportReason(
  body: ReportBody
): { ok: true; reason: string } | { ok: false; error: string } {
  if (body.reasonId) {
    const formatted = formatReportReason(body.reasonId, body.otherDetail);
    if (!formatted) {
      if (body.reasonId === "other") {
        return {
          ok: false,
          error: "Please describe the issue (at least 10 characters)",
        };
      }
      return { ok: false, error: "Invalid report reason" };
    }
    return { ok: true, reason: formatted };
  }

  const reason = body.reason?.trim();
  if (!reason) {
    return { ok: false, error: "reason is required" };
  }
  if (reason.length < 3) {
    return { ok: false, error: "reason is too short" };
  }

  const knownLabels = new Set(
    REPORT_REASON_OPTIONS.map((option) => option.label.toLowerCase())
  );
  const prefix = reason.split(":")[0]?.trim().toLowerCase();
  if (
    !knownLabels.has(reason.toLowerCase()) &&
    prefix &&
    !knownLabels.has(prefix)
  ) {
    return { ok: true, reason };
  }

  return { ok: true, reason };
}
