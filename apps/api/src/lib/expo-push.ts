type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendExpoPush(
  pushToken: string,
  payload: PushPayload
): Promise<boolean> {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
    return false;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const expoToken = process.env.EXPO_ACCESS_TOKEN;
  if (expoToken) {
    headers.Authorization = `Bearer ${expoToken}`;
  }

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: "default",
      }),
    });

    if (!res.ok) {
      console.error("Expo push failed:", await res.text());
      return false;
    }

    const json = (await res.json()) as {
      data?: Array<{ status?: string; message?: string }>;
    };
    const status = json.data?.[0]?.status;
    if (status === "error") {
      console.error("Expo push error:", json.data?.[0]?.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Expo push request error:", err);
    return false;
  }
}
