export type BoardFamily = "CBSE" | "ICSE" | "STATE" | "CAMBRIDGE" | "IB";
export type PathwayKind =
  | "pathway"
  | "exam"
  | "olympiad"
  | "admission_route";
export type PathwayPillar = "what_next" | "opportunities";
export type StageId =
  | "foundation"
  | "middle"
  | "board_10"
  | "after_10"
  | "senior"
  | "after_12";
export type StreamId =
  | "all"
  | "pcm"
  | "pcb"
  | "pcmb"
  | "commerce"
  | "arts"
  | "vocational"
  | "undecided";
export type QualificationId =
  | "cbse_10"
  | "cbse_12"
  | "icse_10"
  | "isc_12"
  | "ssc_10"
  | "state_10"
  | "state_12"
  | "igcse"
  | "a_level"
  | "ib_pyp"
  | "ib_myp"
  | "ib_dp"
  | "ib_cp";
export type PathwayStatus = "draft" | "published" | "inactive";
export type ContentDepth = "full" | "compact" | "thin";
export type AdmissionPattern =
  | "own_cet"
  | "jee_counselling"
  | "class12_merit"
  | "national"
  | "not_applicable";

export type DetailRow = {
  label: string;
  value: string;
};

export type PathwayItem = {
  slug: string;
  kind: PathwayKind;
  pillar: PathwayPillar;
  boardFamilies: BoardFamily[];
  stateCodes: string[];
  stageIds: StageId[];
  previewStageIds: StageId[];
  streamIds: Exclude<StreamId, "undecided">[];
  contrastForStreamIds: Exclude<StreamId, "undecided" | "all">[];
  eligibleQualificationIds: QualificationId[];
  title: string;
  summary: string;
  lead: string;
  detailRows: DetailRow[];
  requiredDetailRowLabels: string[];
  admissionPattern: AdmissionPattern;
  contentDepth: ContentDepth;
  status: PathwayStatus;
  officialUrl: string | null;
  sourceUrls: string[];
  lastReviewedOn: string;
  sortOrder: number;
};

export type PathwayLink = {
  fromSlug: string;
  toSlug: string;
  rel: "leads_to" | "requires" | "related";
};

export type PathwayCatalogue = {
  schemaVersion: 1;
  items: PathwayItem[];
  links: PathwayLink[];
};

export type HubStream = Exclude<StreamId, "all">;

export type PathwayVisibility =
  | "live"
  | "dimmed"
  | "contrast"
  | "inactive";

export type PathwayCard = PathwayItem & {
  visibility: PathwayVisibility;
  whenLabel: string | null;
};

export type PathwayHubGroup = {
  id: string;
  title: string;
  cards: PathwayCard[];
};

export type PathwayContext = {
  family: BoardFamily;
  stateCode: string | null;
  stateLabel: string | null;
  primaryStage: StageId;
  qualificationId: QualificationId;
  includeAfter10Fork: boolean;
  stream: HubStream;
  childId: string | null;
  childLabel: string;
  boardLabel: string;
  gradeLabel: string;
  stripLabels: string[];
  stripIndex: number;
  stageLead: string;
  showStreamChips: boolean;
  streamChipLabels: Array<{ id: HubStream; label: string }>;
};

export type PathwayHubPayload = {
  context: PathwayContext;
  groups: PathwayHubGroup[];
};
