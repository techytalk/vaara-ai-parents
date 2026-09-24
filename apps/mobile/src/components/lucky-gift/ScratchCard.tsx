import { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, layout } from "@/constants/theme";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/components/onboarding/ui";
import { api, type LuckyGiftResponse } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { getToken } from "@/lib/session";

const COLS = 8;
const ROWS = 6;
const REVEAL_RATIO = 0.42;

type Revealed = Extract<LuckyGiftResponse, { status: "revealed" }>;
type Pending = Extract<LuckyGiftResponse, { status: "pending" }>;

type Props = {
  visible: boolean;
  /** Scratch flow for a pending card. */
  pending?: Pending;
  /** Reopen a revealed win to collect the phone (claim reminder). */
  claim?: Revealed;
  onFinished: (next: LuckyGiftResponse | null) => void;
};

export function LuckyGiftScratchCard({
  visible,
  pending,
  claim,
  onFinished,
}: Props) {
  const startInResult = Boolean(claim);
  const [phase, setPhase] = useState<"cover" | "result">(
    startInResult ? "result" : "cover"
  );
  const [cleared, setCleared] = useState(() =>
    Array.from({ length: COLS * ROWS }, () => false)
  );
  const [result, setResult] = useState<Revealed | null>(claim ?? null);
  const [phone, setPhone] = useState("+91");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scratching, setScratching] = useState(false);
  const [boardSize, setBoardSize] = useState({ w: 280, h: 180 });
  const scratchedRef = useRef(startInResult);
  const clearedRef = useRef(cleared);

  useEffect(() => {
    clearedRef.current = cleared;
  }, [cleared]);

  useEffect(() => {
    if (!visible) return;
    if (claim) {
      setPhase("result");
      setResult(claim);
      scratchedRef.current = true;
    }
    trackEvent("lucky_gift_view");
  }, [visible, claim]);

  async function reveal() {
    if (scratchedRef.current) return;
    scratchedRef.current = true;
    setScratching(true);
    try {
      const token = await getToken();
      if (!token) {
        scratchedRef.current = false;
        return;
      }
      const res = await api.scratchLuckyGift(token);
      if (res.status !== "revealed") {
        onFinished(res.status === "hidden" ? res : null);
        return;
      }
      setResult(res);
      setPhase("result");
      trackEvent("lucky_gift_scratched", { outcome: res.outcome });
    } catch {
      scratchedRef.current = false;
    } finally {
      setScratching(false);
    }
  }

  function clearCell(index: number) {
    if (scratchedRef.current || phase !== "cover") return;
    const next = clearedRef.current.slice();
    if (next[index]) return;
    next[index] = true;
    clearedRef.current = next;
    setCleared(next);
    const ratio = next.filter(Boolean).length / next.length;
    if (ratio >= REVEAL_RATIO) {
      void reveal();
    }
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase === "cover",
        onMoveShouldSetPanResponder: () => phase === "cover",
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const col = Math.min(
            COLS - 1,
            Math.max(0, Math.floor((locationX / boardSize.w) * COLS))
          );
          const row = Math.min(
            ROWS - 1,
            Math.max(0, Math.floor((locationY / boardSize.h) * ROWS))
          );
          clearCell(row * COLS + col);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const col = Math.min(
            COLS - 1,
            Math.max(0, Math.floor((locationX / boardSize.w) * COLS))
          );
          const row = Math.min(
            ROWS - 1,
            Math.max(0, Math.floor((locationY / boardSize.h) * ROWS))
          );
          clearCell(row * COLS + col);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, boardSize.w, boardSize.h]
  );

  async function submitPhone() {
    if (!result || result.outcome !== "win") return;
    setPhoneError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await api.submitLuckyGiftPhone(token, phone.trim());
      if (res.status !== "revealed") {
        setPhoneError("Could not save phone");
        return;
      }
      setResult(res);
      trackEvent("lucky_gift_phone_submitted");
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Could not save phone");
    } finally {
      setSubmitting(false);
    }
  }

  async function openSupport(channel: "call" | "whatsapp") {
    if (!result?.supportPhone) return;
    trackEvent("lucky_gift_support_tapped", { channel });
    const digits = result.supportPhone.replace(/[^\d]/g, "");
    const url =
      channel === "call"
        ? `tel:${result.supportPhone}`
        : `https://wa.me/${digits}`;
    await Linking.openURL(url).catch(() => undefined);
  }

  if (!visible) return null;

  const prizeLabel = pending?.prizeLabel ?? result?.prizeLabel ?? "₹500 gift voucher";

  return (
    <View style={styles.scrim} pointerEvents="auto">
      <View style={styles.dim} />
      <View style={styles.card}>
        <Text style={styles.kicker}>Lucky gift</Text>
        <Text style={styles.title}>
          {phase === "cover"
            ? `Scratch for a ${prizeLabel}`
            : result?.outcome === "win"
              ? `You won a ${result.prizeLabel}`
              : "Not this time"}
        </Text>

        {phase === "cover" ? (
          <>
            <Text style={styles.lead}>
              Drag your finger across the card to reveal whether you won.
            </Text>
            <View
              style={styles.scratchWrap}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setBoardSize({ w: width, h: height });
              }}
              {...pan.panHandlers}
            >
              <View style={styles.scratchUnder}>
                <Ionicons name="gift-outline" size={36} color={colors.primary} />
                <Text style={styles.scratchUnderText}>Your result is ready</Text>
              </View>
              <View style={styles.scratchGrid}>
                {cleared.map((isClear, i) => (
                  <View
                    key={i}
                    style={[
                      styles.scratchCell,
                      isClear && styles.scratchCellClear,
                    ]}
                  />
                ))}
              </View>
            </View>
            <SecondaryButton
              label={scratching ? "Revealing…" : "Reveal now"}
              onPress={() => void reveal()}
              disabled={scratching}
            />
          </>
        ) : result?.outcome === "win" ? (
          <>
            <Text style={styles.lead}>
              We’ll use this number only to send your {result.prizeLabel} details.
            </Text>
            <Text style={styles.code}>Claim code {result.claimCode}</Text>
            {result.phoneSubmitted ? (
              <Text style={styles.ok}>Phone saved. We’ll be in touch.</Text>
            ) : result.claimsOpen ? (
              <>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="+91XXXXXXXXXX"
                  placeholderTextColor={colors.textMuted}
                />
                {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
                <PrimaryButton
                  label={submitting ? "Saving…" : "Save phone"}
                  onPress={() => void submitPhone()}
                  disabled={submitting}
                />
              </>
            ) : (
              <Text style={styles.lead}>The claim window is closed.</Text>
            )}
            <View style={styles.row}>
              <Pressable
                style={styles.linkBtn}
                onPress={() => void openSupport("call")}
              >
                <Ionicons name="call-outline" size={18} color={colors.primary} />
                <Text style={styles.linkText}>Call</Text>
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => void openSupport("whatsapp")}
              >
                <Ionicons name="logo-whatsapp" size={18} color={colors.primary} />
                <Text style={styles.linkText}>WhatsApp</Text>
              </Pressable>
            </View>
            <PrimaryButton
              label="Continue"
              onPress={() => onFinished(result)}
            />
          </>
        ) : (
          <>
            <Text style={styles.lead}>
              You’re connected to your circles — neighbourhood, school, board
              and class. Talk there about kids, school, activities, and everyday
              questions.
            </Text>
            {result ? (
              <Text style={styles.code}>Claim code {result.claimCode}</Text>
            ) : null}
            <View style={styles.row}>
              <Pressable
                style={styles.linkBtn}
                onPress={() => void openSupport("call")}
              >
                <Ionicons name="call-outline" size={18} color={colors.primary} />
                <Text style={styles.linkText}>Call</Text>
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => void openSupport("whatsapp")}
              >
                <Ionicons name="logo-whatsapp" size={18} color={colors.primary} />
                <Text style={styles.linkText}>WhatsApp</Text>
              </Pressable>
            </View>
            <PrimaryButton
              label="Continue to your circles"
              onPress={() => onFinished(result)}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    justifyContent: "flex-end",
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 24,
    alignSelf: "center",
    maxWidth: layout.formMaxWidth,
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 14,
  },
  scratchWrap: {
    width: 280,
    height: 180,
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#f4efe6",
  },
  scratchUnder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scratchUnderText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  scratchGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  scratchCell: {
    width: `${100 / COLS}%`,
    height: `${100 / ROWS}%`,
    backgroundColor: "#c45c4a",
  },
  scratchCellClear: {
    backgroundColor: "transparent",
  },
  code: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  error: { color: "#b42318", marginBottom: 8 },
  ok: { color: colors.primary, fontWeight: "600", marginBottom: 12 },
  row: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 10,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  linkText: { color: colors.primary, fontWeight: "700" },
});
