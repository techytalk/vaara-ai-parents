import { PATHWAYS_CATALOGUE } from "./pathways-catalogue.js";
import type {
  HubStream,
  PathwayCard,
  PathwayContext,
  PathwayHubGroup,
  PathwayHubPayload,
  PathwayItem,
  PathwayVisibility,
  QualificationId,
  StageId,
  StreamId,
} from "./pathways-types.js";
import { buildPathBranchMap } from "./pathways-branches.js";

const STAGE_LABEL: Record<StageId, string> = {
  foundation: "Early years",
  middle: "Middle school",
  board_10: "Class 10 years",
  after_10: "After Class 10",
  senior: "Grade 11–12",
  after_12: "After school",
};

function qualificationLabel(id: QualificationId): string {
  switch (id) {
    case "cbse_12":
      return "After Class 12";
    case "isc_12":
      return "After ISC";
    case "state_12":
      return "After Intermediate";
    case "a_level":
      return "After A Level";
    case "ib_dp":
      return "After DP";
    case "ib_cp":
      return "After CP";
    case "igcse":
      return "Needs A Level";
    case "ib_myp":
      return "Needs DP";
    case "ib_pyp":
      return "Needs MYP / DP";
    case "cbse_10":
    case "icse_10":
    case "ssc_10":
    case "state_10":
      return "After Class 10";
    default:
      return "Later";
  }
}

function streamMatches(item: PathwayItem, stream: HubStream): boolean {
  if (item.streamIds.includes("all")) return true;
  if (stream === "undecided") return false;
  if (stream === "pcmb") {
    return (
      item.streamIds.includes("pcmb") ||
      item.streamIds.includes("pcm") ||
      item.streamIds.includes("pcb")
    );
  }
  return item.streamIds.includes(stream as Exclude<StreamId, "undecided">);
}

function isContrast(item: PathwayItem, stream: HubStream): boolean {
  if (stream === "undecided" || stream === "pcmb") return false;
  return item.contrastForStreamIds.includes(
    stream as Exclude<StreamId, "undecided" | "all">
  );
}

function geographyOk(item: PathwayItem, stateCode: string | null): boolean {
  if (item.stateCodes.includes("IN")) return true;
  if (!stateCode) return false;
  return item.stateCodes.includes(stateCode);
}

function isNational(item: PathwayItem): boolean {
  return item.stateCodes.includes("IN");
}

function isStateScoped(item: PathwayItem, stateCode: string | null): boolean {
  if (!stateCode) return false;
  return item.stateCodes.includes(stateCode) && !item.stateCodes.includes("IN");
}

function stageLive(
  item: PathwayItem,
  ctx: PathwayContext
): boolean {
  if (item.stageIds.includes(ctx.primaryStage)) return true;
  if (
    ctx.includeAfter10Fork &&
    item.pillar === "what_next" &&
    item.stageIds.includes("after_10")
  ) {
    return true;
  }
  return false;
}

function stagePreview(item: PathwayItem, ctx: PathwayContext): boolean {
  return item.previewStageIds.includes(ctx.primaryStage);
}

function whenLabelFor(
  item: PathwayItem,
  visibility: PathwayVisibility,
  ctx: PathwayContext
): string | null {
  if (visibility === "inactive") return "Paused";
  if (visibility === "contrast") {
    if (ctx.stream === "pcm") return "If PCB";
    if (ctx.stream === "pcb") return "If PCM";
    if (ctx.stream === "commerce") return "Other stream";
    if (ctx.stream === "arts") return "Other stream";
    return "Not this stream";
  }
  if (visibility === "dimmed") {
    const whenRow = item.detailRows.find((r) => r.label === "When");
    if (whenRow) return whenRow.value;
    const firstPreview = item.previewStageIds[0];
    if (firstPreview) return STAGE_LABEL[firstPreview];
    const firstStage = item.stageIds[0];
    if (firstStage) return STAGE_LABEL[firstStage];
    return "Later";
  }
  return null;
}

function sortCards(a: PathwayCard, b: PathwayCard): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.title.localeCompare(b.title);
}

function toCard(
  item: PathwayItem,
  visibility: PathwayVisibility,
  ctx: PathwayContext
): PathwayCard {
  return {
    ...item,
    visibility,
    whenLabel: whenLabelFor(item, visibility, ctx),
  };
}

/**
 * Deterministic hub query per docs §8.3.
 */
export function buildPathwayHub(ctx: PathwayContext): PathwayHubPayload {
  const whatNext: PathwayCard[] = [];
  const opportunitiesNational: PathwayCard[] = [];
  const opportunitiesState: PathwayCard[] = [];
  const notOnStream: PathwayCard[] = [];
  const inactive: PathwayCard[] = [];

  for (const item of PATHWAYS_CATALOGUE.items) {
    if (item.status === "draft") continue;
    if (!item.boardFamilies.includes(ctx.family)) continue;
    if (!geographyOk(item, ctx.stateCode)) continue;

    const live = stageLive(item, ctx);
    const preview = stagePreview(item, ctx);
    if (!live && !preview && item.status !== "inactive") continue;

    const qualEmpty = item.eligibleQualificationIds.length === 0;
    const qualOk =
      qualEmpty ||
      item.eligibleQualificationIds.includes(ctx.qualificationId);

    if (!qualOk) {
      if (preview) {
        const card = toCard(item, "dimmed", ctx);
        card.whenLabel = qualificationLabel(
          item.eligibleQualificationIds[0] ?? ctx.qualificationId
        );
        if (item.pillar === "what_next") whatNext.push(card);
        else if (isStateScoped(item, ctx.stateCode)) {
          opportunitiesState.push(card);
        } else {
          opportunitiesNational.push(card);
        }
      }
      continue;
    }

    if (item.status === "inactive") {
      inactive.push(toCard(item, "inactive", ctx));
      continue;
    }

    // Stream rules
    if (ctx.stream === "undecided") {
      if (!item.streamIds.includes("all")) {
        // Hide stream-specific exams until a stream is picked
        continue;
      }
    } else if (!streamMatches(item, ctx.stream)) {
      if (isContrast(item, ctx.stream)) {
        notOnStream.push(toCard(item, "contrast", ctx));
      }
      continue;
    }

    const visibility: PathwayVisibility = live ? "live" : "dimmed";
    const card = toCard(item, visibility, ctx);

    if (item.pillar === "what_next") {
      whatNext.push(card);
      continue;
    }

    if (isStateScoped(item, ctx.stateCode)) {
      opportunitiesState.push(card);
    } else if (isNational(item)) {
      opportunitiesNational.push(card);
    } else {
      opportunitiesState.push(card);
    }
  }

  const groups: PathwayHubGroup[] = [];

  if (whatNext.length > 0) {
    groups.push({
      id: "what_next",
      title: "What next",
      cards: whatNext.sort(sortCards),
    });
  }

  const liveNational = opportunitiesNational.filter((c) => c.visibility === "live");
  const dimNational = opportunitiesNational.filter((c) => c.visibility === "dimmed");
  const liveState = opportunitiesState.filter((c) => c.visibility === "live");
  const dimState = opportunitiesState.filter((c) => c.visibility === "dimmed");

  if (liveNational.length > 0 || liveState.length > 0) {
    groups.push({
      id: "opportunities_now",
      title: "Opportunities",
      cards: [...liveNational, ...liveState].sort(sortCards),
    });
  }

  const coming = [...dimNational, ...dimState].sort(sortCards);
  if (coming.length > 0) {
    const comingTitle =
      ctx.primaryStage === "senior" || ctx.primaryStage === "after_12"
        ? "Coming — after school"
        : "Coming — Grade 11–12";
    groups.push({
      id: "opportunities_coming",
      title: comingTitle,
      cards: coming,
    });
  }

  if (notOnStream.length > 0) {
    groups.push({
      id: "not_on_stream",
      title: "Not on this stream",
      cards: notOnStream.sort(sortCards),
    });
  }

  if (inactive.length > 0) {
    groups.push({
      id: "inactive",
      title: "Paused",
      cards: inactive.sort(sortCards),
    });
  }

  // Undecided prompt when chips are shown and no stream picked
  if (ctx.showStreamChips && ctx.stream === "undecided") {
    const oppIdx = groups.findIndex((g) => g.id === "opportunities_now");
    const promptCard: PathwayCard = {
      slug: "_pick-stream",
      kind: "pathway",
      pillar: "opportunities",
      boardFamilies: [ctx.family],
      stateCodes: ["IN"],
      stageIds: [ctx.primaryStage],
      previewStageIds: [],
      streamIds: ["all"],
      contrastForStreamIds: [],
      eligibleQualificationIds: [],
      title: "Pick a stream to see what it opens",
      summary: "PCM, PCB, Commerce, or Arts filters exams below.",
      lead: "Choose a stream chip above to filter Opportunities.",
      detailRows: [],
      requiredDetailRowLabels: [],
      admissionPattern: "not_applicable",
      contentDepth: "thin",
      status: "published",
      officialUrl: null,
      sourceUrls: [],
      lastReviewedOn: "2026-03-01",
      sortOrder: 0,
      visibility: "live",
      whenLabel: null,
    };
    if (oppIdx >= 0) {
      groups[oppIdx] = {
        ...groups[oppIdx],
        cards: [promptCard, ...groups[oppIdx].cards],
      };
    } else {
      groups.splice(whatNext.length > 0 ? 1 : 0, 0, {
        id: "opportunities_now",
        title: "Opportunities",
        cards: [promptCard],
      });
    }
  }

  return { context: ctx, groups, branchMap: buildPathBranchMap(ctx) };
}

export function getPathwayItemBySlug(slug: string): PathwayItem | null {
  if (slug.startsWith("_")) return null;
  return PATHWAYS_CATALOGUE.items.find((item) => item.slug === slug) ?? null;
}

export function getPathwayLinksForSlug(slug: string) {
  return PATHWAYS_CATALOGUE.links.filter(
    (link) => link.fromSlug === slug || link.toSlug === slug
  );
}
