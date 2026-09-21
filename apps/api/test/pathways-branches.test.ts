import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPathBranchMap,
  buildPathwayContext,
  buildPathwayHub,
  isClass10Fork,
} from "@vaara/shared/pathways";

test("IB MYP Grade 10 defaults to Diploma, A Level, CBSE 11–12", () => {
  const ctx = buildPathwayContext({
    curriculumCode: "IB_MYP",
    gradeCode: "G10",
    gradeLabel: "Grade 10",
    childNickname: "Aarav",
    locationState: "Telangana",
  });
  assert.ok(ctx);
  assert.equal(ctx.family, "IB");
  assert.equal(isClass10Fork(ctx), true);
  const map = buildPathBranchMap(ctx);
  assert.equal(map.defaultBranchId, "ib-diploma");
  assert.deepEqual(
    map.primary.map((b) => b.title),
    ["IB Diploma", "A Level", "CBSE 11–12"]
  );
  assert.equal(map.primary[0]?.kicker, "Continue IB");
  assert.ok(map.overflow.some((b) => b.id === "ib-cp"));
  assert.equal(map.locationTitle, "IB MYP · Grade 10");
});

test("Cambridge Y11 fork continues to A Level", () => {
  const ctx = buildPathwayContext({
    curriculumCode: "IGCSE",
    gradeCode: "Y11",
    gradeLabel: "Year 11",
    locationState: "TG",
  });
  assert.ok(ctx);
  assert.equal(isClass10Fork(ctx), true);
  const map = buildPathBranchMap(ctx);
  assert.equal(map.primary[0]?.id, "cambridge-a-level");
  assert.equal(map.forkCaption, "Some options after IGCSE");
});

test("CBSE Grade 9 is Class 10 stage but not the after-10 fork", () => {
  const ctx = buildPathwayContext({
    curriculumCode: "CBSE",
    gradeCode: "G9",
    gradeLabel: "Grade 9",
  });
  assert.ok(ctx);
  assert.equal(ctx.primaryStage, "board_10");
  assert.equal(isClass10Fork(ctx), false);
  assert.equal(buildPathBranchMap(ctx).primary.length, 1);
});

test("CBSE Grade 10 hub includes stay stream card and TG Polytechnic overflow", () => {
  const ctx = buildPathwayContext({
    curriculumCode: "CBSE",
    gradeCode: "G10",
    gradeLabel: "Grade 10",
    locationState: "Telangana",
  });
  assert.ok(ctx);
  const hub = buildPathwayHub(ctx);
  assert.ok(hub.branchMap);
  assert.equal(hub.branchMap.primary[0]?.id, "cbse-after-10-streams");
  assert.ok(hub.branchMap.overflow.some((b) => b.id === "tg-polycet"));
  const withPcm = buildPathwayHub({ ...ctx, stream: "pcm" });
  const jee = withPcm.groups
    .flatMap((g) => g.cards)
    .find((c) => c.slug === "jee-main");
  assert.ok(jee);
  assert.equal(jee.visibility, "dimmed");
});

test("SSC G10 shows Intermediate, not CBSE stream names as tree cards", () => {
  const ctx = buildPathwayContext({
    curriculumCode: "SSC",
    gradeCode: "G10",
    gradeLabel: "Grade 10",
    locationState: "Telangana",
  });
  assert.ok(ctx);
  const map = buildPathBranchMap(ctx);
  assert.equal(map.primary[0]?.title, "Intermediate");
  assert.ok(map.overflow.some((b) => b.id === "tg-polycet"));
});
