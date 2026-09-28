import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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

const COLS = 32;
const ROWS = 20;
const CELL_COUNT = COLS * ROWS;
const BRUSH_RADIUS = 26;
const REVEAL_RATIO = 0.36;
const STROKE_STEP = 7;

const FOIL = ["#C9C1B4", "#B7AFA2", "#DDD6CA", "#A89F92"] as const;

function formatSupportPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return phone;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const PETALS = ["🌸", "🌺", "🌼", "🌷", "💐"] as const;

type Petal = {
  id: number;
  emoji: (typeof PETALS)[number];
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  spin: string;
};

function makePetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    emoji: PETALS[id % PETALS.length],
    left: Math.random() * 92,
    delay: Math.random() * 900,
    duration: 2400 + Math.random() * 1800,
    size: 18 + Math.random() * 16,
    drift: (Math.random() - 0.5) * 90,
    spin: `${(Math.random() > 0.5 ? 1 : -1) * (160 + Math.random() * 280)}deg`,
  }));
}

function FlowerFall({ onDone }: { onDone: () => void }) {
  const { height } = useWindowDimensions();
  const petals = useMemo(() => makePetals(34), []);
  const progress = useRef(petals.map(() => new Animated.Value(0))).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const fall = Animated.parallel(
      petals.map((petal, i) =>
        Animated.timing(progress[i], {
          toValue: 1,
          duration: petal.duration,
          delay: petal.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      )
    );
    fall.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    return () => fall.stop();
  }, [petals, progress]);

  return (
    <View pointerEvents="none" style={styles.flowers}>
      {petals.map((petal, i) => (
        <Animated.Text
          key={petal.id}
          style={{
            position: "absolute",
            left: `${petal.left}%`,
            fontSize: petal.size,
            opacity: progress[i].interpolate({
              inputRange: [0, 0.08, 0.82, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateY: progress[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-48, height + 24],
                }),
              },
              {
                translateX: progress[i].interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, petal.drift, petal.drift * 0.35],
                }),
              },
              {
                rotate: progress[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", petal.spin],
                }),
              },
            ],
          }}
        >
          {petal.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const ScratchCell = memo(function ScratchCell({
  index,
  cleared,
}: {
  index: number;
  cleared: boolean;
}) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const shade = FOIL[(col + row * 2) % FOIL.length];
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: `${(col / COLS) * 100}%`,
        top: `${(row / ROWS) * 100}%`,
        width: `${100 / COLS + 0.15}%`,
        height: `${100 / ROWS + 0.15}%`,
        backgroundColor: cleared ? "transparent" : shade,
      }}
    />
  );
});

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
    Array.from({ length: CELL_COUNT }, () => false)
  );
  const [result, setResult] = useState<Revealed | null>(claim ?? null);
  const [phone, setPhone] = useState("+91");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scratching, setScratching] = useState(false);
  const [lifting, setLifting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const scratchedRef = useRef(startInResult);
  const clearedRef = useRef(cleared);
  const boardRef = useRef({ w: 280, h: 180 });
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const peelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liftingRef = useRef(false);
  const phaseRef = useRef(phase);
  const strokeToRef = useRef<(x: number, y: number) => void>(() => undefined);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      if (peelTimerRef.current) clearTimeout(peelTimerRef.current);
    };
  }, []);

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
        liftingRef.current = false;
        setLifting(false);
        return;
      }
      const res = await api.scratchLuckyGift(token);
      if (res.status !== "revealed") {
        onFinished(res.status === "hidden" ? res : null);
        return;
      }
      setResult(res);
      setPhase("result");
      if (res.outcome === "win") setCelebrate(true);
      trackEvent("lucky_gift_scratched", { outcome: res.outcome });
    } catch {
      scratchedRef.current = false;
      liftingRef.current = false;
      setLifting(false);
    } finally {
      setScratching(false);
    }
  }

  function paint(next: boolean[]) {
    clearedRef.current = next;
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setCleared(clearedRef.current.slice());
    });
  }

  function scratchAt(x: number, y: number, next: boolean[]) {
    const { w, h } = boardRef.current;
    if (w <= 0 || h <= 0) return;
    const cellW = w / COLS;
    const cellH = h / ROWS;
    const minCol = clamp(Math.floor((x - BRUSH_RADIUS) / cellW), 0, COLS - 1);
    const maxCol = clamp(Math.floor((x + BRUSH_RADIUS) / cellW), 0, COLS - 1);
    const minRow = clamp(Math.floor((y - BRUSH_RADIUS) / cellH), 0, ROWS - 1);
    const maxRow = clamp(Math.floor((y + BRUSH_RADIUS) / cellH), 0, ROWS - 1);
    const r2 = BRUSH_RADIUS * BRUSH_RADIUS;
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        const dx = cx - x;
        const dy = cy - y;
        if (dx * dx + dy * dy <= r2) next[row * COLS + col] = true;
      }
    }
  }

  function finishCover() {
    if (liftingRef.current || scratchedRef.current) return;
    liftingRef.current = true;
    setLifting(true);
    const all = Array.from({ length: CELL_COUNT }, () => true);
    paint(all);
    peelTimerRef.current = setTimeout(() => {
      void reveal();
    }, 380);
  }

  function strokeTo(x: number, y: number) {
    if (scratchedRef.current || liftingRef.current || phaseRef.current !== "cover") {
      return;
    }
    const next = clearedRef.current.slice();
    const last = lastPointRef.current;
    if (!last) {
      scratchAt(x, y, next);
    } else {
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(dist / STROKE_STEP));
      for (let i = 1; i <= steps; i++) {
        scratchAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps, next);
      }
    }
    lastPointRef.current = { x, y };
    paint(next);
    const ratio = next.filter(Boolean).length / CELL_COUNT;
    if (ratio >= REVEAL_RATIO) finishCover();
  }

  strokeToRef.current = strokeTo;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          phaseRef.current === "cover" && !scratchedRef.current,
        onMoveShouldSetPanResponder: () =>
          phaseRef.current === "cover" && !scratchedRef.current,
        onPanResponderGrant: (evt) => {
          lastPointRef.current = null;
          const { locationX, locationY } = evt.nativeEvent;
          strokeToRef.current(locationX, locationY);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          strokeToRef.current(locationX, locationY);
        },
        onPanResponderRelease: () => {
          lastPointRef.current = null;
        },
        onPanResponderTerminate: () => {
          lastPointRef.current = null;
        },
      }),
    []
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
  const scratchedCount = cleared.filter(Boolean).length;
  const progress = Math.min(1, scratchedCount / (CELL_COUNT * REVEAL_RATIO));
  const supportPhone = result ? formatSupportPhone(result.supportPhone) : "";

  return (
    <View style={styles.scrim} pointerEvents="auto">
      <View style={styles.dim} />
      <View style={styles.card}>
        <Text style={styles.kicker}>Lucky gift</Text>
        {phase !== "cover" && result?.outcome !== "win" ? (
          <Text style={styles.miss}>
            You didn&apos;t win the {result?.prizeLabel ?? "gift"} this time.
          </Text>
        ) : null}
        <Text style={styles.title}>
          {phase === "cover"
            ? `Scratch for a ${prizeLabel}`
            : result?.outcome === "win"
              ? `You won a ${result.prizeLabel}`
              : "But you're now part of the Vaara parenting community"}
        </Text>

        {phase === "cover" ? (
          <>
            <Text style={styles.lead}>
              Scratch the foil with your finger. A few swipes opens your result.
            </Text>
            <View
              style={styles.scratchWrap}
              pointerEvents="box-only"
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                boardRef.current = { w: width, h: height };
              }}
              {...pan.panHandlers}
            >
              <View pointerEvents="none" style={styles.scratchUnder}>
                <Ionicons name="gift" size={40} color={colors.primary} />
                <Text style={styles.scratchUnderText}>
                  {lifting ? "Opening your result…" : "Your result is under here"}
                </Text>
              </View>
              <View pointerEvents="none" style={styles.scratchGrid}>
                {cleared.map((isClear, i) => (
                  <ScratchCell key={i} index={i} cleared={isClear} />
                ))}
              </View>
              {scratchedCount < CELL_COUNT * 0.12 && !lifting ? (
                <View pointerEvents="none" style={styles.foilHint}>
                  <Ionicons name="hand-left-outline" size={22} color="#4E463C" />
                  <Text style={styles.foilHintText}>Scratch here</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.hint}>
              {lifting || scratching
                ? "Opening your result…"
                : scratchedCount > 0
                  ? "Keep scratching"
                  : "Drag your finger across the foil"}
            </Text>
            <SecondaryButton
              label={scratching ? "Revealing…" : "Reveal now"}
              onPress={() => void reveal()}
              disabled={scratching || lifting}
            />
          </>
        ) : result?.outcome === "win" ? (
          <>
            {result.claimsOpen ? (
              <>
                <Text style={styles.lead}>
                  Please reach out to{" "}
                  <Text style={styles.phoneDisplay} selectable>
                    {supportPhone}
                  </Text>{" "}
                  for claiming the gift.
                </Text>
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
              </>
            ) : (
              <Text style={styles.lead}>The claim window is closed.</Text>
            )}
            <Text style={styles.code}>Claim code {result.claimCode}</Text>
            {result.phoneSubmitted ? (
              <Text style={styles.ok}>
                Number saved. We’ll reach out to you about the gift.
              </Text>
            ) : result.claimsOpen ? (
              <>
                <Text style={styles.ask}>
                  We need your contact number to reach out to you about the gift.
                </Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="Your mobile number"
                  placeholderTextColor={colors.textMuted}
                />
                {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
                <PrimaryButton
                  label={submitting ? "Saving…" : "Save my number"}
                  onPress={() => void submitPhone()}
                  disabled={submitting}
                />
              </>
            ) : null}
            <PrimaryButton
              label="Continue"
              onPress={() => onFinished(result)}
            />
          </>
        ) : (
          <>
            <Text style={styles.lead}>
              You&apos;re connected with parents from your neighbourhood and
              your child&apos;s school, board and class. Ask questions, share
              your experiences, and see what other parents are talking about.
            </Text>
            <PrimaryButton
              label="Explore your parent circles"
              onPress={() => onFinished(result)}
            />
          </>
        )}
      </View>
      {celebrate ? <FlowerFall onDone={() => setCelebrate(false)} /> : null}
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
  flowers: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    overflow: "hidden",
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
  miss: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 6,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 14,
  },
  ask: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 10,
  },
  scratchWrap: {
    width: "100%",
    maxWidth: 320,
    height: 188,
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#F6F1E6",
    borderWidth: 2,
    borderColor: "#C4A574",
  },
  scratchUnder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F6F1E6",
  },
  scratchUnderText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  scratchGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  foilHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  foilHintText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4E463C",
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  hint: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 12,
  },
  phoneDisplay: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.2,
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
    marginTop: -4,
    marginBottom: 8,
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
