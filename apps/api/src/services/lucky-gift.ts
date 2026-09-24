import { randomBytes, randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@vaara/db";

export type LuckyGiftPeriod = "morning" | "afternoon" | "evening";

export type PeriodWindow = {
  start: string; // HH:MM in campaign timezone
  end: string;
  count: number;
};

export type PeriodWindows = Record<LuckyGiftPeriod, PeriodWindow>;

export type LuckyGiftCampaign = {
  id: string;
  slug: string;
  prizeLabel: string;
  supportPhone: string;
  winnerQuota: number;
  carryUnclaimedForward: boolean;
  periodWindows: PeriodWindows;
  timezone: string;
  startsAt: string;
  endsAt: string;
  claimDeadline: string;
  claimsOpen: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LuckyGiftStatus = "hidden" | "pending" | "revealed";

export type LuckyGiftResponse =
  | { status: "hidden" }
  | { status: "pending"; prizeLabel: string }
  | {
      status: "revealed";
      outcome: "win" | "lose";
      prizeLabel: string;
      claimCode: string;
      supportPhone: string;
      claimDeadline: string;
      phoneSubmitted: boolean;
      claimsOpen: boolean;
    };

const DEFAULT_PERIOD_WINDOWS: PeriodWindows = {
  morning: { start: "06:00", end: "11:00", count: 7 },
  afternoon: { start: "11:00", end: "17:00", count: 6 },
  evening: { start: "17:00", end: "22:00", count: 7 },
};

const PERIODS: LuckyGiftPeriod[] = ["morning", "afternoon", "evening"];

type CampaignRow = {
  id: string;
  slug: string;
  prize_label: string;
  support_phone: string;
  winner_quota: number;
  carry_unclaimed_forward: boolean;
  period_windows: PeriodWindows;
  timezone: string;
  starts_at: Date | string;
  ends_at: Date | string;
  claim_deadline: Date | string;
  claims_open: boolean;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type CardRow = {
  id: string;
  campaign_id: string;
  user_id: string;
  winning_moment_id: string | null;
  outcome: "win" | "lose";
  claim_code: string;
  scratched_at: Date | string | null;
  winner_phone: string | null;
  phone_submitted_at: Date | string | null;
  created_at: Date | string;
};

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function mapCampaign(row: CampaignRow): LuckyGiftCampaign {
  return {
    id: row.id,
    slug: row.slug,
    prizeLabel: row.prize_label,
    supportPhone: row.support_phone,
    winnerQuota: Number(row.winner_quota),
    carryUnclaimedForward: Boolean(row.carry_unclaimed_forward),
    periodWindows: normalizePeriodWindows(row.period_windows),
    timezone: row.timezone || "Asia/Kolkata",
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    claimDeadline: toIso(row.claim_deadline),
    claimsOpen: Boolean(row.claims_open),
    active: Boolean(row.active),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function normalizePeriodWindows(raw: unknown): PeriodWindows {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<LuckyGiftPeriod, Partial<PeriodWindow>>
  >;
  const out = { ...DEFAULT_PERIOD_WINDOWS };
  for (const period of PERIODS) {
    const item = src[period];
    if (!item) continue;
    out[period] = {
      start: typeof item.start === "string" ? item.start : out[period].start,
      end: typeof item.end === "string" ? item.end : out[period].end,
      count:
        typeof item.count === "number" && Number.isFinite(item.count)
          ? Math.max(0, Math.floor(item.count))
          : out[period].count,
    };
  }
  return out;
}

function parseHm(hm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
function dateKeyInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Build a UTC Date for wall-clock time in `timeZone` on calendar day `dateKey`
 * (YYYY-MM-DD). Uses a short binary search against Intl formatting.
 */
function zonedLocalDate(
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const [y, mo, d] = dateKey.split("-").map(Number);
  // Rough UTC guess near India / local noon offset.
  let lo = Date.UTC(y, mo - 1, d, hour - 14, minute, 0);
  let hi = Date.UTC(y, mo - 1, d, hour + 14, minute, 0);
  const target = `${dateKey} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = fmt.formatToParts(new Date(mid));
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "00";
    const key = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
    if (key === target) return new Date(mid);
    if (key < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return new Date(Math.floor((lo + hi) / 2));
}

function listCampaignDateKeys(
  startsAt: Date,
  endsAt: Date,
  timeZone: string
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  // Walk hourly from start to end to collect overlapping local dates.
  let t = startsAt.getTime();
  const end = endsAt.getTime();
  while (t <= end) {
    const key = dateKeyInTz(new Date(t), timeZone);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    t += 60 * 60 * 1000;
  }
  const endKey = dateKeyInTz(endsAt, timeZone);
  if (!seen.has(endKey)) keys.push(endKey);
  return keys;
}

function randomClaimCode(): string {
  return String(randomInt(1000, 10000));
}

async function uniqueClaimCode(
  client: PoolClient,
  campaignId: string
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomClaimCode();
    const { rows } = await client.query(
      `SELECT 1 FROM lucky_gift_cards
       WHERE campaign_id = $1 AND claim_code = $2`,
      [campaignId, code]
    );
    if (rows.length === 0) return code;
  }
  return randomBytes(3).toString("hex").slice(0, 6).toUpperCase();
}

function validatePeriodWindows(windows: PeriodWindows): string | null {
  let total = 0;
  for (const period of PERIODS) {
    const w = windows[period];
    if (!parseHm(w.start) || !parseHm(w.end)) {
      return `Invalid ${period} window times`;
    }
    const start = parseHm(w.start)!;
    const end = parseHm(w.end)!;
    if (
      start.hour * 60 + start.minute >= end.hour * 60 + end.minute
    ) {
      return `${period} end must be after start`;
    }
    total += w.count;
  }
  if (total !== 20) {
    return `Period counts must sum to 20 (got ${total})`;
  }
  return null;
}

function generateMomentsForCampaign(campaign: LuckyGiftCampaign): Array<{
  period: LuckyGiftPeriod;
  availableAt: Date;
  expiresAt: Date | null;
}> {
  const windows = campaign.periodWindows;
  const err = validatePeriodWindows(windows);
  if (err) throw new Error(err);

  const startsAt = new Date(campaign.startsAt);
  const endsAt = new Date(campaign.endsAt);
  const dateKeys = listCampaignDateKeys(startsAt, endsAt, campaign.timezone);
  if (dateKeys.length === 0) {
    throw new Error("Campaign has no overlapping local dates");
  }

  const moments: Array<{
    period: LuckyGiftPeriod;
    availableAt: Date;
    expiresAt: Date | null;
  }> = [];

  for (const period of PERIODS) {
    const w = windows[period];
    const startHm = parseHm(w.start)!;
    const endHm = parseHm(w.end)!;

    for (let i = 0; i < w.count; i++) {
      let placed: Date | null = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const dateKey = dateKeys[randomInt(0, dateKeys.length)];
        const windowStart = zonedLocalDate(
          dateKey,
          startHm.hour,
          startHm.minute,
          campaign.timezone
        );
        const windowEnd = zonedLocalDate(
          dateKey,
          endHm.hour,
          endHm.minute,
          campaign.timezone
        );
        const lo = Math.max(windowStart.getTime(), startsAt.getTime());
        const hi = Math.min(windowEnd.getTime(), endsAt.getTime());
        if (hi <= lo) continue;
        placed = new Date(randomInt(lo, hi));
        break;
      }
      if (!placed) {
        throw new Error(
          `Could not place a ${period} winning moment inside the campaign window`
        );
      }
      const expiresAt = campaign.carryUnclaimedForward
        ? null
        : (() => {
            const dateKey = dateKeyInTz(placed, campaign.timezone);
            return zonedLocalDate(
              dateKey,
              endHm.hour,
              endHm.minute,
              campaign.timezone
            );
          })();
      moments.push({
        period,
        availableAt: placed,
        expiresAt,
      });
    }
  }

  return moments;
}

async function loadCampaignBySlug(
  client: PoolClient,
  slug = "suchitra-500"
): Promise<LuckyGiftCampaign | null> {
  const { rows } = await client.query<CampaignRow>(
    `SELECT * FROM lucky_gift_campaigns WHERE slug = $1`,
    [slug]
  );
  return rows[0] ? mapCampaign(rows[0]) : null;
}

async function cardsIssuedCount(
  client: PoolClient,
  campaignId: string
): Promise<number> {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM lucky_gift_cards WHERE campaign_id = $1`,
    [campaignId]
  );
  return Number(rows[0]?.n ?? 0);
}

/** New cards may only be issued while the campaign switch is on and inside the window. */
function isCampaignLive(campaign: LuckyGiftCampaign, now = new Date()): boolean {
  if (!campaign.active) return false;
  const t = now.getTime();
  return (
    t >= new Date(campaign.startsAt).getTime() &&
    t <= new Date(campaign.endsAt).getTime()
  );
}

function isBeforeClaimDeadline(
  campaign: LuckyGiftCampaign,
  now = new Date()
): boolean {
  return now.getTime() <= new Date(campaign.claimDeadline).getTime();
}

/**
 * An already-assigned pending card stays revealable through the claim deadline,
 * including after ends_at. An explicit admin pause (active=false while still
 * inside starts_at..ends_at) hides it until the campaign is resumed.
 */
function canAccessPendingCard(
  campaign: LuckyGiftCampaign,
  now = new Date()
): boolean {
  if (!campaign.claimsOpen || !isBeforeClaimDeadline(campaign, now)) {
    return false;
  }
  const t = now.getTime();
  const endsAt = new Date(campaign.endsAt).getTime();
  if (!campaign.active && t <= endsAt) {
    return false;
  }
  return true;
}

function periodWindowsEqual(a: PeriodWindows, b: PeriodWindows): boolean {
  for (const period of PERIODS) {
    if (
      a[period].start !== b[period].start ||
      a[period].end !== b[period].end ||
      a[period].count !== b[period].count
    ) {
      return false;
    }
  }
  return true;
}

function revealedPayload(
  campaign: LuckyGiftCampaign,
  card: CardRow
): Extract<LuckyGiftResponse, { status: "revealed" }> {
  const now = Date.now();
  const claimsStillOpen =
    campaign.claimsOpen &&
    now <= new Date(campaign.claimDeadline).getTime();
  return {
    status: "revealed",
    outcome: card.outcome,
    prizeLabel: campaign.prizeLabel,
    claimCode: card.claim_code,
    supportPhone: campaign.supportPhone,
    claimDeadline: campaign.claimDeadline,
    phoneSubmitted: Boolean(card.winner_phone),
    claimsOpen: claimsStillOpen,
  };
}

async function loadUserCard(
  client: PoolClient,
  campaignId: string,
  userId: string
): Promise<CardRow | null> {
  const { rows } = await client.query<CardRow>(
    `SELECT * FROM lucky_gift_cards
     WHERE campaign_id = $1 AND user_id = $2`,
    [campaignId, userId]
  );
  return rows[0] ?? null;
}

async function claimAvailableMoment(
  client: PoolClient,
  campaign: LuckyGiftCampaign,
  userId: string,
  now: Date
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id
     FROM lucky_gift_winning_moments
     WHERE campaign_id = $1
       AND claimed_at IS NULL
       AND available_at <= $2
       AND (expires_at IS NULL OR expires_at > $2)
     ORDER BY available_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1`,
    [campaign.id, now.toISOString()]
  );
  const moment = rows[0];
  if (!moment) return null;

  const { rows: winRows } = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM lucky_gift_cards
     WHERE campaign_id = $1 AND outcome = 'win'`,
    [campaign.id]
  );
  if (Number(winRows[0]?.n ?? 0) >= campaign.winnerQuota) {
    return null;
  }

  await client.query(
    `UPDATE lucky_gift_winning_moments
     SET claimed_by_user_id = $2, claimed_at = $3
     WHERE id = $1 AND claimed_at IS NULL`,
    [moment.id, userId, now.toISOString()]
  );
  return moment.id;
}

async function createCardForUser(
  client: PoolClient,
  campaign: LuckyGiftCampaign,
  userId: string,
  now: Date
): Promise<CardRow> {
  await client.query(
    `SELECT id FROM lucky_gift_campaigns WHERE id = $1 FOR UPDATE`,
    [campaign.id]
  );

  const existing = await loadUserCard(client, campaign.id, userId);
  if (existing) return existing;

  const momentId = await claimAvailableMoment(client, campaign, userId, now);
  const outcome = momentId ? "win" : "lose";
  const claimCode = await uniqueClaimCode(client, campaign.id);

  const { rows } = await client.query<CardRow>(
    `INSERT INTO lucky_gift_cards
       (campaign_id, user_id, winning_moment_id, outcome, claim_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [campaign.id, userId, momentId, outcome, claimCode]
  );
  return rows[0];
}

export async function getLuckyGiftForUser(input: {
  userId: string;
  role: string;
  onboardingComplete: boolean;
  accountCreatedAt: Date | string;
}): Promise<LuckyGiftResponse> {
  const client = await pool.connect();
  try {
    const campaign = await loadCampaignBySlug(client);
    if (!campaign) return { status: "hidden" };

    const existing = await loadUserCard(client, campaign.id, input.userId);

    if (existing) {
      if (existing.scratched_at) {
        return revealedPayload(campaign, existing);
      }
      if (canAccessPendingCard(campaign)) {
        return { status: "pending", prizeLabel: campaign.prizeLabel };
      }
      return { status: "hidden" };
    }

    // New cards only while the campaign is live.
    if (!isCampaignLive(campaign)) {
      return { status: "hidden" };
    }

    if (input.role !== "parent" || !input.onboardingComplete) {
      return { status: "hidden" };
    }

    const createdAt = new Date(input.accountCreatedAt).getTime();
    if (
      createdAt < new Date(campaign.startsAt).getTime() ||
      createdAt > new Date(campaign.endsAt).getTime()
    ) {
      return { status: "hidden" };
    }

    // Need at least one moment schedule before issuing cards.
    const { rows: momentCount } = await client.query(
      `SELECT COUNT(*)::int AS n FROM lucky_gift_winning_moments WHERE campaign_id = $1`,
      [campaign.id]
    );
    if (Number(momentCount[0]?.n ?? 0) === 0) {
      return { status: "hidden" };
    }

    await client.query("BEGIN");
    try {
      await createCardForUser(client, campaign, input.userId, new Date());
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    return { status: "pending", prizeLabel: campaign.prizeLabel };
  } finally {
    client.release();
  }
}

export async function scratchLuckyGift(input: {
  userId: string;
}): Promise<LuckyGiftResponse | { error: string; status: number }> {
  const client = await pool.connect();
  try {
    const campaign = await loadCampaignBySlug(client);
    if (!campaign) return { error: "Campaign not found", status: 404 };

    const card = await loadUserCard(client, campaign.id, input.userId);
    if (!card) return { error: "No lucky gift card", status: 404 };

    if (!card.scratched_at) {
      if (!canAccessPendingCard(campaign)) {
        return { status: "hidden" };
      }
      const { rows } = await client.query<CardRow>(
        `UPDATE lucky_gift_cards
         SET scratched_at = now()
         WHERE id = $1 AND scratched_at IS NULL
         RETURNING *`,
        [card.id]
      );
      return revealedPayload(campaign, rows[0] ?? card);
    }

    return revealedPayload(campaign, card);
  } finally {
    client.release();
  }
}

export async function submitLuckyGiftPhone(input: {
  userId: string;
  phone: string;
}): Promise<LuckyGiftResponse | { error: string; status: number }> {
  const phone = input.phone.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return {
      error: "Phone must be E.164, e.g. +9198XXXXXXXX",
      status: 400,
    };
  }

  const client = await pool.connect();
  try {
    const campaign = await loadCampaignBySlug(client);
    if (!campaign) return { error: "Campaign not found", status: 404 };

    const card = await loadUserCard(client, campaign.id, input.userId);
    if (!card) return { error: "No lucky gift card", status: 404 };
    if (card.outcome !== "win") {
      return { error: "Only winners can submit a phone number", status: 400 };
    }
    if (!card.scratched_at) {
      return { error: "Scratch the card first", status: 400 };
    }
    if (!campaign.claimsOpen) {
      return { error: "Claims are closed", status: 400 };
    }
    if (Date.now() > new Date(campaign.claimDeadline).getTime()) {
      return { error: "Claim deadline has passed", status: 400 };
    }

    const { rows } = await client.query<CardRow>(
      `UPDATE lucky_gift_cards
       SET winner_phone = $2, phone_submitted_at = now()
       WHERE id = $1
       RETURNING *`,
      [card.id, phone]
    );
    return revealedPayload(campaign, rows[0]);
  } finally {
    client.release();
  }
}

// ---- Admin ----

export async function adminGetLuckyGiftCampaign(slug = "suchitra-500") {
  const client = await pool.connect();
  try {
    const campaign = await loadCampaignBySlug(client, slug);
    if (!campaign) return null;

    const [moments, stats, unclaimed] = await Promise.all([
      client.query(
        `SELECT id, period, available_at, expires_at, claimed_by_user_id, claimed_at
         FROM lucky_gift_winning_moments
         WHERE campaign_id = $1
         ORDER BY available_at ASC`,
        [campaign.id]
      ),
      client.query(
        `SELECT
           COUNT(*)::int AS cards_issued,
           COUNT(*) FILTER (WHERE scratched_at IS NOT NULL)::int AS scratched,
           COUNT(*) FILTER (WHERE outcome = 'win')::int AS wins,
           COUNT(*) FILTER (WHERE outcome = 'lose')::int AS losses,
           COUNT(*) FILTER (WHERE winner_phone IS NOT NULL)::int AS phones_submitted
         FROM lucky_gift_cards
         WHERE campaign_id = $1`,
        [campaign.id]
      ),
      client.query(
        `SELECT COUNT(*)::int AS n
         FROM lucky_gift_winning_moments
         WHERE campaign_id = $1 AND claimed_at IS NULL`,
        [campaign.id]
      ),
    ]);

    const s = stats.rows[0] ?? {};
    return {
      campaign,
      moments: moments.rows.map((m) => ({
        id: m.id,
        period: m.period,
        availableAt: toIso(m.available_at),
        expiresAt: m.expires_at ? toIso(m.expires_at) : null,
        claimedByUserId: m.claimed_by_user_id,
        claimedAt: m.claimed_at ? toIso(m.claimed_at) : null,
      })),
      stats: {
        cardsIssued: Number(s.cards_issued ?? 0),
        scratched: Number(s.scratched ?? 0),
        wins: Number(s.wins ?? 0),
        losses: Number(s.losses ?? 0),
        phonesSubmitted: Number(s.phones_submitted ?? 0),
        unclaimedMoments: Number(unclaimed.rows[0]?.n ?? 0),
        momentCount: moments.rows.length,
      },
      live: isCampaignLive(campaign),
      scheduleReady: moments.rows.length === campaign.winnerQuota,
    };
  } finally {
    client.release();
  }
}

export async function adminListWinners(slug = "suchitra-500") {
  const client = await pool.connect();
  try {
    const campaign = await loadCampaignBySlug(client, slug);
    if (!campaign) return null;
    const { rows } = await client.query(
      `SELECT c.claim_code, c.winner_phone, c.scratched_at, c.phone_submitted_at,
              u.email, u.display_name, u.phone AS account_phone
       FROM lucky_gift_cards c
       JOIN users u ON u.id = c.user_id
       WHERE c.campaign_id = $1 AND c.outcome = 'win'
       ORDER BY c.scratched_at NULLS LAST, c.created_at`,
      [campaign.id]
    );
    return {
      winners: rows.map((r) => ({
        claimCode: r.claim_code,
        winnerPhone: r.winner_phone,
        scratchedAt: r.scratched_at ? toIso(r.scratched_at) : null,
        phoneSubmittedAt: r.phone_submitted_at
          ? toIso(r.phone_submitted_at)
          : null,
        email: r.email,
        displayName: r.display_name,
        accountPhone: r.account_phone,
      })),
    };
  } finally {
    client.release();
  }
}

export type AdminCampaignPatch = {
  prizeLabel?: string;
  supportPhone?: string;
  carryUnclaimedForward?: boolean;
  periodWindows?: PeriodWindows;
  startsAt?: string;
  endsAt?: string;
  claimDeadline?: string;
  claimsOpen?: boolean;
  active?: boolean;
};

export async function adminUpdateLuckyGiftCampaign(
  patch: AdminCampaignPatch,
  slug = "suchitra-500"
): Promise<
  | {
      ok: true;
      campaign: LuckyGiftCampaign;
      live: boolean;
      scheduleInvalidated?: boolean;
    }
  | { error: string; status: number }
> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const campaign = await loadCampaignBySlug(client, slug);
    if (!campaign) {
      await client.query("ROLLBACK");
      return { error: "Campaign not found", status: 404 };
    }

    const issued = await cardsIssuedCount(client, campaign.id);
    const nextWindows = patch.periodWindows
      ? normalizePeriodWindows(patch.periodWindows)
      : campaign.periodWindows;
    if (patch.periodWindows) {
      const err = validatePeriodWindows(nextWindows);
      if (err) {
        await client.query("ROLLBACK");
        return { error: err, status: 400 };
      }
    }

    const nextStarts = patch.startsAt ?? campaign.startsAt;
    const nextEnds = patch.endsAt ?? campaign.endsAt;
    const nextClaim = patch.claimDeadline ?? campaign.claimDeadline;
    const nextCarry =
      patch.carryUnclaimedForward ?? campaign.carryUnclaimedForward;

    const scheduleChanged =
      nextStarts !== campaign.startsAt ||
      nextEnds !== campaign.endsAt ||
      nextCarry !== campaign.carryUnclaimedForward ||
      !periodWindowsEqual(nextWindows, campaign.periodWindows);

    if (scheduleChanged && issued > 0) {
      await client.query("ROLLBACK");
      return {
        error:
          "Cannot change dates, windows, or carry-forward after cards have been issued",
        status: 400,
      };
    }

    if (new Date(nextEnds) <= new Date(nextStarts)) {
      await client.query("ROLLBACK");
      return { error: "endsAt must be after startsAt", status: 400 };
    }
    if (new Date(nextClaim) < new Date(nextEnds)) {
      await client.query("ROLLBACK");
      return { error: "claimDeadline must be on or after endsAt", status: 400 };
    }

    if (patch.supportPhone != null) {
      const phone = patch.supportPhone.trim();
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        await client.query("ROLLBACK");
        return {
          error: "supportPhone must be E.164, e.g. +9198XXXXXXXX",
          status: 400,
        };
      }
    }

    let scheduleInvalidated = false;
    if (scheduleChanged && issued === 0) {
      await client.query(
        `DELETE FROM lucky_gift_winning_moments WHERE campaign_id = $1`,
        [campaign.id]
      );
      scheduleInvalidated = true;
    }

    let nextActive =
      patch.active === undefined ? campaign.active : Boolean(patch.active);

    const { rows: momentCountRows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM lucky_gift_winning_moments WHERE campaign_id = $1`,
      [campaign.id]
    );
    const momentCount = Number(momentCountRows[0]?.n ?? 0);

    if (momentCount !== campaign.winnerQuota) {
      if (patch.active === true) {
        await client.query("ROLLBACK");
        return {
          error: scheduleInvalidated
            ? `Schedule changed — generate exactly ${campaign.winnerQuota} winning moments before turning ON`
            : `Generate exactly ${campaign.winnerQuota} winning moments before activating`,
          status: 400,
        };
      }
      if (nextActive && scheduleInvalidated) {
        nextActive = false;
      }
    }

    if (nextActive && !campaign.active) {
      const supportPhone = patch.supportPhone?.trim() || campaign.supportPhone;
      if (supportPhone === "+910000000000") {
        await client.query("ROLLBACK");
        return {
          error: "Set a real support phone before activating",
          status: 400,
        };
      }
      if (momentCount !== campaign.winnerQuota) {
        await client.query("ROLLBACK");
        return {
          error: `Generate exactly ${campaign.winnerQuota} winning moments before activating`,
          status: 400,
        };
      }
    }

    const { rows } = await client.query<CampaignRow>(
      `UPDATE lucky_gift_campaigns SET
         prize_label = COALESCE($2, prize_label),
         support_phone = COALESCE($3, support_phone),
         carry_unclaimed_forward = COALESCE($4, carry_unclaimed_forward),
         period_windows = COALESCE($5::jsonb, period_windows),
         starts_at = COALESCE($6::timestamptz, starts_at),
         ends_at = COALESCE($7::timestamptz, ends_at),
         claim_deadline = COALESCE($8::timestamptz, claim_deadline),
         claims_open = COALESCE($9, claims_open),
         active = $10,
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        campaign.id,
        patch.prizeLabel?.trim() || null,
        patch.supportPhone?.trim() || null,
        patch.carryUnclaimedForward ?? null,
        patch.periodWindows != null || scheduleChanged
          ? JSON.stringify(nextWindows)
          : null,
        patch.startsAt ?? null,
        patch.endsAt ?? null,
        patch.claimDeadline ?? null,
        patch.claimsOpen ?? null,
        nextActive,
      ]
    );

    await client.query("COMMIT");
    const updated = mapCampaign(rows[0]);
    return {
      ok: true,
      campaign: updated,
      live: isCampaignLive(updated),
      scheduleInvalidated: scheduleInvalidated || undefined,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function adminGenerateWinningMoments(
  slug = "suchitra-500"
): Promise<
  | { ok: true; momentCount: number; moments: Array<{ period: string; availableAt: string }> }
  | { error: string; status: number }
> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const campaign = await loadCampaignBySlug(client, slug);
    if (!campaign) {
      await client.query("ROLLBACK");
      return { error: "Campaign not found", status: 404 };
    }
    if (campaign.active) {
      await client.query("ROLLBACK");
      return {
        error: "Turn the campaign off before regenerating moments",
        status: 400,
      };
    }
    const issued = await cardsIssuedCount(client, campaign.id);
    if (issued > 0) {
      await client.query("ROLLBACK");
      return {
        error: "Cannot regenerate moments after cards have been issued",
        status: 400,
      };
    }

    let moments;
    try {
      moments = generateMomentsForCampaign(campaign);
    } catch (e) {
      await client.query("ROLLBACK");
      return {
        error: e instanceof Error ? e.message : "Could not generate moments",
        status: 400,
      };
    }

    await client.query(
      `DELETE FROM lucky_gift_winning_moments WHERE campaign_id = $1`,
      [campaign.id]
    );

    for (const m of moments) {
      await client.query(
        `INSERT INTO lucky_gift_winning_moments
           (campaign_id, period, available_at, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          campaign.id,
          m.period,
          m.availableAt.toISOString(),
          m.expiresAt ? m.expiresAt.toISOString() : null,
        ]
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      momentCount: moments.length,
      moments: moments
        .slice()
        .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime())
        .map((m) => ({
          period: m.period,
          availableAt: m.availableAt.toISOString(),
        })),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function fetchAuthUserLuckyGiftContext(userId: string): Promise<{
  role: string;
  onboardingComplete: boolean;
  createdAt: string;
} | null> {
  const { rows } = await pool.query(
    `SELECT role, onboarding_complete, created_at FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows[0]) return null;
  return {
    role: rows[0].role,
    onboardingComplete: Boolean(rows[0].onboarding_complete),
    createdAt: toIso(rows[0].created_at),
  };
}

/** Exposed for unit-style checks without hitting the DB. */
export const __test = {
  normalizePeriodWindows,
  validatePeriodWindows,
  generateMomentsForCampaign,
  zonedLocalDate,
  listCampaignDateKeys,
  DEFAULT_PERIOD_WINDOWS,
};
