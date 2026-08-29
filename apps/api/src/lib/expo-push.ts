type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  channelId: string;
  priority: "default" | "normal" | "high";
};

type ExpoPushResult = {
  pushToken: string;
  ok: boolean;
  error?: string;
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const expoToken = process.env.EXPO_ACCESS_TOKEN;
  if (expoToken) {
    headers.Authorization = `Bearer ${expoToken}`;
  }

  return headers;
}

function isValidPushToken(pushToken: string): boolean {
  return Boolean(pushToken && pushToken.startsWith("ExponentPushToken"));
}

export async function sendExpoPush(
  pushToken: string,
  payload: PushPayload
): Promise<boolean> {
  const [result] = await sendExpoPushBatch([{ pushToken, payload }]);
  return result?.ok ?? false;
}

export async function sendExpoPushBatch(
  messages: Array<{ pushToken: string; payload: PushPayload }>
): Promise<ExpoPushResult[]> {
  const valid = messages.filter((message) =>
    isValidPushToken(message.pushToken)
  );

  const results: ExpoPushResult[] = messages.map((message) => ({
    pushToken: message.pushToken,
    ok: false,
    error: isValidPushToken(message.pushToken) ? undefined : "Invalid push token",
  }));

  if (valid.length === 0) {
    return results;
  }

  const body: ExpoPushMessage[] = valid.map((message) => ({
    to: message.pushToken,
    title: message.payload.title,
    body: message.payload.body,
    data: message.payload.data ?? {},
    sound: "default",
    channelId: "default",
    priority: "high",
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Expo push batch failed:", text);
      return results.map((result) =>
        isValidPushToken(result.pushToken)
          ? { ...result, error: text || "Push request failed" }
          : result
      );
    }

    const json = (await res.json()) as {
      data?: Array<{ status?: string; message?: string }>;
    };

    let validIndex = 0;
    for (let i = 0; i < messages.length; i++) {
      if (!isValidPushToken(messages[i].pushToken)) continue;

      const status = json.data?.[validIndex];
      validIndex++;
      if (status?.status === "ok") {
        results[i] = { pushToken: messages[i].pushToken, ok: true };
      } else {
        results[i] = {
          pushToken: messages[i].pushToken,
          ok: false,
          error: status?.message ?? "Push failed",
        };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Push request error";
    console.error("Expo push batch request error:", err);
    return results.map((result) =>
      isValidPushToken(result.pushToken)
        ? { ...result, error: message }
        : result
    );
  }

  return results;
}
