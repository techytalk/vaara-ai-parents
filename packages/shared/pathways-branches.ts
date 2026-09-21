import type {
  PathBranch,
  PathBranchMap,
  PathTopicId,
  PathwayContext,
  StageId,
} from "./pathways-types.js";

const LOCK_LINE = "Exploring does not change your child’s profile.";
const HEADLINE = "Explore what comes next";
const DECK = "Follow a branch. Find a question. Hear from parents.";
const LOCATION_KICKER = "YOUR CHILD IS HERE";

export const OTHER_ROUTES_PATH_ID = "other-routes";

export const PATH_TOPIC_IDS = [
  "subjects",
  "workload",
  "college_plans",
  "learning",
  "next_grade",
] as const satisfies readonly PathTopicId[];

const PATH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export type PathDiscussionOrigin = "branch" | "other_routes";

export type PathDiscussionTag = {
  pathId: string;
  topicId: PathTopicId;
  origin: PathDiscussionOrigin;
};

export function parsePathDiscussionTag(input: {
  pathId?: string;
  topicId?: string;
  origin?: string;
}): PathDiscussionTag | { error: string } {
  const origin =
    input.origin === "other_routes" || input.origin === "branch"
      ? input.origin
      : input.origin
        ? null
        : "branch";
  if (!origin) {
    return { error: "Invalid path origin" };
  }

  const rawPath = (input.pathId ?? "").trim().toLowerCase();
  const pathId =
    origin === "other_routes" ? OTHER_ROUTES_PATH_ID : rawPath;
  if (!PATH_ID_PATTERN.test(pathId)) {
    return { error: "Invalid path" };
  }

  const topicId = (input.topicId ?? "").trim() as PathTopicId;
  if (!PATH_TOPIC_IDS.includes(topicId)) {
    return { error: "Invalid path topic" };
  }

  return { pathId, topicId, origin };
}

function otherRoutesPrompt(ctx: PathwayContext): string {
  if (ctx.family === "IB") {
    return "Parents comparing IB Diploma, A Level, and CBSE 11–12 after MYP: what actually helped you decide?";
  }
  if (ctx.family === "CAMBRIDGE") {
    return "After IGCSE, what helped you compare A Level with IB Diploma or CBSE 11–12?";
  }
  if (ctx.family === "STATE") {
    return "Parents who explored Intermediate and Polytechnic after Class 10: what helped you compare the options?";
  }
  return "Parents who weighed staying on this board against switching after Class 10: what actually mattered?";
}

const SENIOR_TOPICS: Array<{ id: PathTopicId; label: string }> = [
  { id: "subjects", label: "Subjects" },
  { id: "workload", label: "Workload" },
  { id: "college_plans", label: "College plans" },
];

const EARLY_TOPICS: Array<{ id: PathTopicId; label: string }> = [
  { id: "learning", label: "Learning" },
  { id: "next_grade", label: "Next grade" },
  { id: "subjects", label: "Subjects" },
];

function stageMeta(stage: StageId): string {
  if (stage === "foundation") return "Early years";
  if (stage === "middle") return "Middle-school stage";
  if (stage === "board_10" || stage === "after_10") return "Class 10 stage";
  if (stage === "senior") return "Classes 11–12";
  return "After school";
}

function forkCaption(ctx: PathwayContext): string {
  if (ctx.family === "CAMBRIDGE" && (ctx.primaryStage === "board_10" || ctx.includeAfter10Fork)) {
    return "Some options after IGCSE";
  }
  if (ctx.primaryStage === "board_10" || ctx.includeAfter10Fork || ctx.primaryStage === "after_10") {
    return "Some options for Classes 11–12";
  }
  if (ctx.primaryStage === "after_12") return "Some options after school";
  if (ctx.primaryStage === "senior") return "This senior stage";
  return "What this stage is for";
}

function branch(partial: PathBranch): PathBranch {
  return partial;
}

function ibDiplomaPrompts(): PathBranch["prompts"] {
  return {
    subjects:
      "Parents with children in IB DP: how did you choose HL and SL subjects, especially when your child was unsure about a career?",
    workload:
      "DP parents: how did you plan around May exams overlapping JEE, NEET, or state CETs?",
    college_plans:
      "Parents whose children did IB DP: how did you weigh Indian entrances with UCAS or other abroad routes?",
  };
}

function aLevelPrompts(): PathBranch["prompts"] {
  return {
    subjects:
      "Cambridge parents: which three or four A Levels did you pick, and what did Indian colleges actually check?",
    workload:
      "A Level parents: how did March vs June series affect Indian 11th or UG timelines?",
    college_plans:
      "After IGCSE, what helped you compare A Level with CBSE 11–12 or IB Diploma?",
  };
}

function cbseSeniorPrompts(switchedFrom?: string): PathBranch["prompts"] {
  return {
    subjects: switchedFrom
      ? `Parents who switched from ${switchedFrom} to CBSE: how did you choose a subject combination for Class 11?`
      : "How did your child choose subjects for Class 11, and what surprised you after the move?",
    workload:
      "CBSE 11–12 parents: how did you manage board year alongside entrance preparation?",
    college_plans:
      "CBSE parents: how did you balance your child’s interests with subjects needed for possible college courses?",
  };
}

function sscIntermediatePrompts(): PathBranch["prompts"] {
  return {
    subjects:
      "Parents who explored Intermediate after SSC: what helped you compare MPC, BiPC, MEC, and the other groups?",
    workload:
      "Junior college parents: what was the jump from SSC to Intermediate like in the first term?",
    college_plans:
      "Parents who compared Intermediate and Polytechnic after Class 10: what helped you decide?",
  };
}

function earlyPrompts(board: string): PathBranch["prompts"] {
  return {
    learning: `${board} parents in the early years: what helped with reading, numeracy, or settling into school?`,
    next_grade: `What do you wish you had known before the next class in ${board}?`,
    subjects: `Is it too early to think about later subject choices in ${board}? What did you actually watch for?`,
  };
}

function forkBranches(ctx: PathwayContext): {
  primary: PathBranch[];
  overflow: PathBranch[];
} {
  const here = `${ctx.boardLabel} · ${ctx.gradeLabel}`;

  if (ctx.family === "IB") {
    return {
      primary: [
        branch({
          id: "ib-diploma",
          kicker: "Continue IB",
          title: "IB Diploma",
          relation: "continue",
          breadcrumb: `${here} → IB DP`,
          exploreTitle: "Explore IB Diploma",
          itemSlug: "ib-diploma",
          showStreamIntents: true,
          prompts: ibDiplomaPrompts(),
        }),
        branch({
          id: "cambridge-a-level",
          kicker: "Switch",
          title: "A Level",
          relation: "switch",
          breadcrumb: `${here} → A Level`,
          exploreTitle: "Explore Cambridge A Level",
          itemSlug: "cambridge-a-level",
          showStreamIntents: true,
          prompts: aLevelPrompts(),
        }),
        branch({
          id: "ib-to-cbse",
          kicker: "Switch",
          title: "CBSE 11–12",
          relation: "switch",
          breadcrumb: `${here} → CBSE 11–12`,
          exploreTitle: "Explore CBSE Classes 11–12",
          itemSlug: "ib-to-cbse",
          showStreamIntents: true,
          prompts: cbseSeniorPrompts("MYP"),
        }),
      ],
      overflow: [
        branch({
          id: "ib-cp",
          kicker: "Other route",
          title: "Career-related Programme",
          relation: "other",
          breadcrumb: `${here} → IBCP`,
          exploreTitle: "Explore the Career-related Programme",
          itemSlug: "ib-cp",
          showStreamIntents: false,
          prompts: {
            subjects:
              "Has anyone’s child taken IBCP in India, and which universities accepted it?",
            college_plans:
              "How did you confirm whether a college treats IBCP like the Diploma?",
          },
        }),
      ],
    };
  }

  if (ctx.family === "CAMBRIDGE") {
    return {
      primary: [
        branch({
          id: "cambridge-a-level",
          kicker: "Continue Cambridge",
          title: "A Level",
          relation: "continue",
          breadcrumb: `${here} → A Level`,
          exploreTitle: "Explore Cambridge A Level",
          itemSlug: "cambridge-a-level",
          showStreamIntents: true,
          prompts: aLevelPrompts(),
        }),
        branch({
          id: "ib-diploma",
          kicker: "Switch",
          title: "IB Diploma",
          relation: "switch",
          breadcrumb: `${here} → IB DP`,
          exploreTitle: "Explore IB Diploma",
          itemSlug: "ib-diploma",
          showStreamIntents: true,
          prompts: ibDiplomaPrompts(),
        }),
        branch({
          id: "cbse-after-10-streams",
          kicker: "Switch",
          title: "CBSE 11–12",
          relation: "switch",
          breadcrumb: `${here} → CBSE 11–12`,
          exploreTitle: "Explore CBSE Classes 11–12",
          itemSlug: "cbse-after-10-streams",
          showStreamIntents: true,
          prompts: cbseSeniorPrompts("IGCSE"),
        }),
      ],
      overflow: [],
    };
  }

  if (ctx.family === "STATE") {
    const overflow: PathBranch[] = [
      branch({
        id: "cbse-after-10-streams",
        kicker: "Switch",
        title: "CBSE 11–12",
        relation: "switch",
        breadcrumb: `${here} → CBSE 11–12`,
        exploreTitle: "Explore CBSE Classes 11–12",
        itemSlug: "cbse-after-10-streams",
        showStreamIntents: true,
        prompts: cbseSeniorPrompts("SSC"),
      }),
    ];
    if (ctx.stateCode === "TG" || ctx.stateCode === "AP") {
      overflow.unshift(
        branch({
          id: "tg-polycet",
          kicker: "Other route",
          title: "Polytechnic",
          relation: "other",
          breadcrumb: `${here} → Polytechnic`,
          exploreTitle: "Explore Polytechnic",
          itemSlug: "tg-polycet",
          showStreamIntents: false,
          prompts: {
            subjects:
              "Parents who chose Polytechnic after Class 10: what should we know before POLYCET?",
            college_plans:
              "Did ECET later into B.Tech feel like a real option from diploma?",
          },
        })
      );
    }
    return {
      primary: [
        branch({
          id: "ssc-intermediate",
          kicker: "Continue state",
          title: "Intermediate",
          relation: "continue",
          breadcrumb: `${here} → Intermediate`,
          exploreTitle: "Explore Intermediate",
          itemSlug: "ssc-intermediate",
          showStreamIntents: true,
          prompts: sscIntermediatePrompts(),
        }),
        branch({
          id: "cbse-after-10-streams",
          kicker: "Switch",
          title: "CBSE 11–12",
          relation: "switch",
          breadcrumb: `${here} → CBSE 11–12`,
          exploreTitle: "Explore CBSE Classes 11–12",
          itemSlug: "cbse-after-10-streams",
          showStreamIntents: true,
          prompts: cbseSeniorPrompts("SSC"),
        }),
        branch({
          id: "cambridge-a-level",
          kicker: "Switch",
          title: "A Level / IB",
          relation: "switch",
          breadcrumb: `${here} → international 11–12`,
          exploreTitle: "Explore international 11–12",
          itemSlug: "cambridge-a-level",
          showStreamIntents: false,
          prompts: {
            subjects:
              "Has anyone moved from SSC to A Level or IB Diploma after Class 10? What was the catch-up like?",
            college_plans:
              "Why did you switch out of the state board after SSC?",
          },
        }),
      ],
      overflow: overflow.filter((row) => row.id === "tg-polycet"),
    };
  }

  // CBSE and ICSE share the Indian-board fork shape.
  const poly: PathBranch[] =
    ctx.stateCode === "TG"
      ? [
          branch({
            id: "tg-polycet",
            kicker: "Other route",
            title: "Polytechnic",
            relation: "other",
            breadcrumb: `${here} → Polytechnic`,
            exploreTitle: "Explore Polytechnic",
            itemSlug: "tg-polycet",
            showStreamIntents: false,
            prompts: {
              subjects:
                "Parents who chose Polytechnic after Class 10: what should we know before POLYCET?",
              college_plans:
                "Did diploma-then-ECET feel like a real engineering path?",
            },
          }),
        ]
      : [];

  return {
    primary: [
      branch({
        id: "cbse-after-10-streams",
        kicker: ctx.family === "ICSE" ? "Continue ISC" : "Stay on CBSE",
        title: "Classes 11–12",
        relation: "continue",
        breadcrumb: `${here} → 11–12`,
        exploreTitle:
          ctx.family === "ICSE"
            ? "Explore ISC Classes 11–12"
            : "Explore CBSE Classes 11–12",
        itemSlug: "cbse-after-10-streams",
        showStreamIntents: true,
        prompts: cbseSeniorPrompts(),
      }),
      branch({
        id: "cbse-switch-board",
        kicker: "Switch",
        title: ctx.family === "ICSE" ? "CBSE 11–12" : "ISC / IB / A Level",
        relation: "switch",
        breadcrumb: `${here} → another board`,
        exploreTitle: "Explore switching board",
        itemSlug: "cbse-switch-board",
        showStreamIntents: false,
        prompts: {
          subjects:
            "Parents who changed board after Class 10: what was hardest in the first year?",
          college_plans:
            "Did you switch for JEE/NEET coaching alignment, or for something else?",
        },
      }),
      branch({
        id: "ib-diploma",
        kicker: "Switch",
        title: "IB Diploma",
        relation: "switch",
        breadcrumb: `${here} → IB DP`,
        exploreTitle: "Explore IB Diploma",
        itemSlug: "ib-diploma",
        showStreamIntents: true,
        prompts: ibDiplomaPrompts(),
      }),
    ],
    overflow: poly,
  };
}

function singleContinue(ctx: PathwayContext): PathBranch {
  const here = `${ctx.boardLabel} · ${ctx.gradeLabel}`;
  if (ctx.family === "IB" && ctx.primaryStage === "senior") {
    return branch({
      id: "ib-diploma",
      kicker: "Continue IB",
      title: "IB Diploma",
      relation: "continue",
      breadcrumb: here,
      exploreTitle: "Explore IB Diploma",
      itemSlug: "ib-diploma",
      showStreamIntents: true,
      prompts: ibDiplomaPrompts(),
    });
  }
  if (ctx.family === "CAMBRIDGE" && ctx.primaryStage === "senior") {
    return branch({
      id: "cambridge-a-level",
      kicker: "Continue Cambridge",
      title: "A Level",
      relation: "continue",
      breadcrumb: here,
      exploreTitle: "Explore Cambridge A Level",
      itemSlug: "cambridge-a-level",
      showStreamIntents: true,
      prompts: aLevelPrompts(),
    });
  }
  if (ctx.primaryStage === "after_12") {
    return branch({
      id: "after-12-routes",
      kicker: "After school",
      title: "Indian UG / abroad",
      relation: "continue",
      breadcrumb: here,
      exploreTitle: "Explore after-school routes",
      itemSlug: "after-12-routes",
      showStreamIntents: true,
      prompts: {
        college_plans:
          "After boards, what actually mattered more: counselling, CUET, or abroad applications?",
        subjects: "Which Class 12 subjects later blocked or opened a course?",
        workload: "How did you sequence applications and results season?",
      },
    });
  }
  if (ctx.family === "CBSE" && ctx.primaryStage === "senior") {
    return branch({
      id: "cbse-aissce",
      kicker: "Stay on CBSE",
      title: "Class 12 (AISSCE)",
      relation: "continue",
      breadcrumb: here,
      exploreTitle: "Explore CBSE Class 12",
      itemSlug: "cbse-aissce",
      showStreamIntents: true,
      prompts: cbseSeniorPrompts(),
    });
  }
  if (ctx.family === "CBSE" && ctx.primaryStage === "middle") {
    return branch({
      id: "cbse-stay-middle",
      kicker: "Stay on CBSE",
      title: "Stay on CBSE",
      relation: "continue",
      breadcrumb: here,
      exploreTitle: "Explore this stage",
      itemSlug: "cbse-stay-middle",
      showStreamIntents: false,
      prompts: earlyPrompts("CBSE"),
    });
  }
  return branch({
    id: `${ctx.family.toLowerCase()}-stay`,
    kicker: `Stay on ${ctx.boardLabel}`,
    title: ctx.boardLabel,
    relation: "continue",
    breadcrumb: here,
    exploreTitle: `Explore ${ctx.boardLabel}`,
    itemSlug: null,
    showStreamIntents: false,
    prompts: earlyPrompts(ctx.boardLabel),
  });
}

export function isClass10Fork(ctx: PathwayContext): boolean {
  return ctx.includeAfter10Fork || ctx.primaryStage === "after_10";
}

export function buildPathBranchMap(ctx: PathwayContext): PathBranchMap {
  const fork = isClass10Fork(ctx);
  const { primary, overflow } = fork
    ? forkBranches(ctx)
    : { primary: [singleContinue(ctx)], overflow: [] };
  const defaultBranchId = primary[0]?.id ?? "stay";
  const topics =
    ctx.primaryStage === "foundation" || ctx.primaryStage === "middle"
      ? EARLY_TOPICS
      : SENIOR_TOPICS;

  return {
    forkCaption: forkCaption(ctx),
    locationKicker: LOCATION_KICKER,
    locationTitle: `${ctx.boardLabel} · ${ctx.gradeLabel}`,
    locationMeta: stageMeta(ctx.primaryStage),
    headline: HEADLINE,
    deck: DECK,
    lockLine: LOCK_LINE,
    defaultBranchId,
    topics,
    primary,
    overflow,
    otherRoutesPrompt: otherRoutesPrompt(ctx),
  };
}
