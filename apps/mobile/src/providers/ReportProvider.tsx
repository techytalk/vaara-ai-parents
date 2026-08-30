import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import { ReportReasonModal } from "@/components/ReportReasonModal";

type ReportRequest = {
  title: string;
  description?: string;
  submit: (reason: string) => Promise<void>;
};

type ReportContextValue = (request: ReportRequest) => void;

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitReport = useCallback((next: ReportRequest) => {
    setRequest(next);
  }, []);

  async function handleSubmit(reason: string) {
    if (!request) return;
    setSubmitting(true);
    try {
      await request.submit(reason);
      setRequest(null);
      Alert.alert(
        "Reported",
        "Thank you. Our safety team will review this report."
      );
    } catch (error) {
      Alert.alert(
        "Could not report",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ReportContext.Provider value={submitReport}>
      {children}
      <ReportReasonModal
        visible={Boolean(request)}
        title={request?.title ?? "Report"}
        description={request?.description}
        submitting={submitting}
        onCancel={() => {
          if (!submitting) setRequest(null);
        }}
        onSubmit={(reason) => void handleSubmit(reason)}
      />
    </ReportContext.Provider>
  );
}

export function useSubmitReport() {
  const value = useContext(ReportContext);
  if (!value) {
    throw new Error("useSubmitReport must be used within ReportProvider");
  }
  return value;
}
