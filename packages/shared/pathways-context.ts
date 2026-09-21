import type {
  BoardFamily,
  HubStream,
  PathwayContext,
  QualificationId,
  StageId,
} from "./pathways-types.js";

const STATE_NAME_TO_CODE: Record<string, string> = {
  telangana: "TG",
  "andhra pradesh": "AP",
  karnataka: "KA",
  "tamil nadu": "TN",
  kerala: "KL",
  maharashtra: "MH",
  gujarat: "GJ",
  goa: "GA",
  delhi: "DL",
  "nct of delhi": "DL",
  "uttar pradesh": "UP",
  haryana: "HR",
  punjab: "PB",
  rajasthan: "RJ",
  "himachal pradesh": "HP",
  uttarakhand: "UK",
  "madhya pradesh": "MP",
  chhattisgarh: "CG",
  bihar: "BR",
  jharkhand: "JH",
  odisha: "OD",
  "west bengal": "WB",
  assam: "AS",
};

const STATE_CODE_TO_LABEL: Record<string, string> = {
  TG: "Telangana",
  AP: "Andhra Pradesh",
  KA: "Karnataka",
  TN: "Tamil Nadu",
  KL: "Kerala",
  MH: "Maharashtra",
  GJ: "Gujarat",
  GA: "Goa",
  DL: "Delhi",
  UP: "Uttar Pradesh",
  HR: "Haryana",
  PB: "Punjab",
  RJ: "Rajasthan",
  HP: "Himachal Pradesh",
  UK: "Uttarakhand",
  MP: "Madhya Pradesh",
  CG: "Chhattisgarh",
  BR: "Bihar",
  JH: "Jharkhand",
  OD: "Odisha",
  WB: "West Bengal",
  AS: "Assam",
  IN: "India",
};

export function stateCodeFromLabel(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return STATE_NAME_TO_CODE[trimmed.toLowerCase()] ?? null;
}

export function stateLabelFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return STATE_CODE_TO_LABEL[code] ?? code;
}

function gradeNumber(code: string | null | undefined): number | null {
  if (!code) return null;
  const match = code.match(/^(?:G|Y)(\d+)$/i);
  if (!match) return null;
  return Number(match[1]);
}

export function boardFamilyFromCurriculum(
  curriculumCode: string | null | undefined
): BoardFamily | null {
  if (!curriculumCode) return null;
  if (curriculumCode === "CBSE") return "CBSE";
  if (curriculumCode === "IGCSE") return "CAMBRIDGE";
  if (curriculumCode === "SSC") return "STATE";
  if (curriculumCode === "ICSE") return "ICSE";
  if (
    curriculumCode === "IB_PYP" ||
    curriculumCode === "IB_MYP" ||
    curriculumCode === "IBDP"
  ) {
    return "IB";
  }
  return null;
}

export function derivePrimaryStage(params: {
  family: BoardFamily;
  curriculumCode: string;
  gradeCode: string | null;
}): StageId {
  const n = gradeNumber(params.gradeCode);
  if (params.family === "IB") {
    if (params.curriculumCode === "IB_PYP") return "foundation";
    if (params.curriculumCode === "IBDP") return "senior";
    if (n != null && n <= 8) return "middle";
    return "board_10";
  }
  if (params.family === "CAMBRIDGE") {
    if (n == null) return "board_10";
    if (n <= 6) return "foundation";
    if (n <= 9) return "middle";
    return "board_10";
  }
  if (n == null) return "middle";
  if (n <= 5) return "foundation";
  if (n <= 8) return "middle";
  if (n <= 10) return "board_10";
  return "senior";
}

export function deriveQualificationId(params: {
  family: BoardFamily;
  curriculumCode: string;
  primaryStage: StageId;
}): QualificationId {
  const { family, curriculumCode, primaryStage } = params;
  if (family === "CBSE") {
    return primaryStage === "senior" || primaryStage === "after_12"
      ? "cbse_12"
      : "cbse_10";
  }
  if (family === "ICSE") {
    return primaryStage === "senior" || primaryStage === "after_12"
      ? "isc_12"
      : "icse_10";
  }
  if (family === "STATE") {
    if (curriculumCode === "SSC") {
      return primaryStage === "senior" || primaryStage === "after_12"
        ? "state_12"
        : "ssc_10";
    }
    return primaryStage === "senior" || primaryStage === "after_12"
      ? "state_12"
      : "state_10";
  }
  if (family === "CAMBRIDGE") {
    return primaryStage === "senior" || primaryStage === "after_12"
      ? "a_level"
      : "igcse";
  }
  if (curriculumCode === "IB_PYP") return "ib_pyp";
  if (curriculumCode === "IBDP") return "ib_dp";
  return "ib_myp";
}

export function isFinalClass10Equivalent(params: {
  family: BoardFamily;
  curriculumCode: string;
  gradeCode: string | null;
  primaryStage: StageId;
}): boolean {
  if (params.primaryStage !== "board_10") return false;
  const n = gradeNumber(params.gradeCode);
  if (params.family === "CAMBRIDGE") return n === 11;
  if (params.family === "IB") return n === 10 || params.gradeCode === "G10";
  return n === 10;
}

export function streamChipsForFamily(family: BoardFamily): Array<{
  id: HubStream;
  label: string;
}> {
  if (family === "STATE") {
    return [
      { id: "pcm", label: "MPC" },
      { id: "pcb", label: "BiPC" },
      { id: "commerce", label: "MEC" },
      { id: "arts", label: "HEC" },
      { id: "vocational", label: "POLYCET" },
    ];
  }
  if (family === "IB" || family === "CAMBRIDGE") {
    return [
      { id: "pcm", label: "Engineering" },
      { id: "pcb", label: "Medicine" },
      { id: "commerce", label: "Commerce" },
      { id: "arts", label: "Arts" },
    ];
  }
  return [
    { id: "pcm", label: "PCM" },
    { id: "pcb", label: "PCB" },
    { id: "pcmb", label: "PCMB" },
    { id: "commerce", label: "Commerce" },
    { id: "arts", label: "Arts" },
  ];
}

export function stripForFamily(family: BoardFamily): {
  labels: string[];
  indexForStage: Record<StageId, number>;
  stageForIndex: StageId[];
} {
  const stageForIndex: StageId[] = [
    "foundation",
    "middle",
    "board_10",
    "senior",
    "after_12",
  ];
  if (family === "IB") {
    return {
      labels: ["PYP", "MYP", "10", "DP", "After"],
      indexForStage: {
        foundation: 0,
        middle: 1,
        board_10: 2,
        after_10: 2,
        senior: 3,
        after_12: 4,
      },
      stageForIndex,
    };
  }
  if (family === "CAMBRIDGE") {
    return {
      labels: ["Primary", "Lower", "IGCSE", "A Level", "After"],
      indexForStage: {
        foundation: 0,
        middle: 1,
        board_10: 2,
        after_10: 2,
        senior: 3,
        after_12: 4,
      },
      stageForIndex,
    };
  }
  if (family === "STATE") {
    return {
      labels: ["Early", "Middle", "SSC 10", "Inter", "After"],
      indexForStage: {
        foundation: 0,
        middle: 1,
        board_10: 2,
        after_10: 2,
        senior: 3,
        after_12: 4,
      },
      stageForIndex,
    };
  }
  return {
    labels: ["Early", "Middle", "10", "11–12", "After"],
    indexForStage: {
      foundation: 0,
      middle: 1,
      board_10: 2,
      after_10: 2,
      senior: 3,
      after_12: 4,
    },
    stageForIndex,
  };
}

export function stageForStripIndex(index: number): StageId | null {
  const stages: StageId[] = [
    "foundation",
    "middle",
    "board_10",
    "senior",
    "after_12",
  ];
  return stages[index] ?? null;
}

export function parseStageId(raw: string | null | undefined): StageId | null {
  if (!raw) return null;
  const allowed: StageId[] = [
    "foundation",
    "middle",
    "board_10",
    "after_10",
    "senior",
    "after_12",
  ];
  return allowed.includes(raw as StageId) ? (raw as StageId) : null;
}

function stageLead(params: {
  family: BoardFamily;
  primaryStage: StageId;
  includeAfter10Fork: boolean;
}): string {
  if (params.primaryStage === "foundation") {
    return "Early years. Board exams and streams are still far away.";
  }
  if (params.primaryStage === "middle") {
    return "Stream choice is still two years away.";
  }
  if (params.primaryStage === "board_10" || params.includeAfter10Fork) {
    if (params.family === "IB") {
      return "End of MYP. AIU treats this as Class 10, not Class 12.";
    }
    if (params.family === "CAMBRIDGE") {
      return "IGCSE year. After this, pick A Level subjects or switch board.";
    }
    if (params.family === "STATE") {
      return "SSC year. After results, pick Intermediate or polytechnic.";
    }
    return "Class 10 year. After results, pick a stream for 11–12.";
  }
  if (params.primaryStage === "senior") {
    if (params.family === "IB") {
      return "DP year. Six subjects plus core; entrances may collide with May exams.";
    }
    if (params.family === "CAMBRIDGE") {
      return "A Level year. Subject set decides Indian and abroad routes.";
    }
    return "Class 12 board and entrance papers run together.";
  }
  return "School is done. Map Indian UG and abroad routes.";
}

export function buildPathwayContext(input: {
  childId?: string | null;
  childNickname?: string | null;
  curriculumCode: string | null;
  curriculumName?: string | null;
  gradeCode: string | null;
  gradeLabel?: string | null;
  track?: "school" | "preschool" | null;
  locationState?: string | null;
  schoolState?: string | null;
  stream?: HubStream;
  /** Peek another strip stop without changing the child's profile. */
  stageOverride?: StageId | null;
}): PathwayContext | null {
  if (input.track === "preschool") return null;
  const family = boardFamilyFromCurriculum(input.curriculumCode);
  if (!family || !input.curriculumCode) return null;

  const derivedStage = derivePrimaryStage({
    family,
    curriculumCode: input.curriculumCode,
    gradeCode: input.gradeCode,
  });
  const primaryStage = input.stageOverride ?? derivedStage;
  const derivedFinalYear = isFinalClass10Equivalent({
    family,
    curriculumCode: input.curriculumCode,
    gradeCode: input.gradeCode,
    primaryStage: derivedStage,
  });
  // When browsing the Class 10 stop, always show the after-10 fork cards.
  const includeAfter10Fork =
    primaryStage === "board_10" &&
    (input.stageOverride != null || derivedFinalYear);
  const qualificationId = deriveQualificationId({
    family,
    curriculumCode: input.curriculumCode,
    primaryStage,
  });
  const stateCode =
    stateCodeFromLabel(input.locationState) ??
    stateCodeFromLabel(input.schoolState);
  const strip = stripForFamily(family);
  const showStreamChips =
    includeAfter10Fork ||
    primaryStage === "after_10" ||
    primaryStage === "senior";

  return {
    family,
    stateCode,
    stateLabel: stateLabelFromCode(stateCode),
    primaryStage,
    qualificationId,
    includeAfter10Fork,
    stream: input.stream ?? "undecided",
    childId: input.childId ?? null,
    childLabel: input.childNickname?.trim() || "Your child",
    boardLabel:
      family === "CAMBRIDGE"
        ? "Cambridge"
        : family === "STATE"
          ? input.curriculumCode === "SSC"
            ? "SSC"
            : "State board"
          : family === "IB"
            ? input.curriculumCode.replace("_", " ")
            : family,
    gradeLabel: input.gradeLabel ?? input.gradeCode ?? "Grade",
    stripLabels: strip.labels,
    stripIndex: strip.indexForStage[primaryStage] ?? 1,
    stageLead: stageLead({
      family,
      primaryStage,
      includeAfter10Fork,
    }),
    showStreamChips,
    streamChipLabels: streamChipsForFamily(family),
  };
}
