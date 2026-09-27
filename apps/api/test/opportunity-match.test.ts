import assert from "node:assert/strict";
import test from "node:test";
import {
  cardDateFacts,
  cardFeeLabel,
  deriveRegistrationState,
  eligibilityCoversGrade,
  evaluateEligibility,
  searchScore,
} from "../src/services/opportunity-match.js";

test("class range includes the boundary grades", () => {
  assert.equal(eligibilityCoversGrade("Classes 1–10", 1), true);
  assert.equal(eligibilityCoversGrade("Classes 1–10", 10), true);
  assert.equal(eligibilityCoversGrade("Classes 1–10", 11), false);
});

test("missing class text is not a match", () => {
  assert.equal(eligibilityCoversGrade(null, 5), false);
});

test("cancelled edition is not open", () => {
  assert.equal(
    deriveRegistrationState({
      eventStatus: "cancelled",
      registrationMethod: "direct",
      schedules: [],
      now: new Date("2026-09-27T00:00:00Z"),
    }),
    "cancelled"
  );
});

test("a future close date stays open", () => {
  assert.equal(
    deriveRegistrationState({
      eventStatus: "scheduled",
      registrationMethod: "direct",
      schedules: [
        {
          scheduleType: "registration",
          startsOn: "2026-09-01",
          endsOn: "2026-10-01",
          dateStatus: "verified",
        },
      ],
      now: new Date("2026-09-27T00:00:00Z"),
    }),
    "open"
  );
});

test("through school with no dates asks the school", () => {
  assert.equal(
    deriveRegistrationState({
      eventStatus: "scheduled",
      registrationMethod: "through_school",
      schedules: [],
    }),
    "check_with_school"
  );
});

test("a failed class check is not called eligible", () => {
  const result = evaluateEligibility({
    eligibilityText: "Classes 6–8",
    grade: 4,
    scopeLevel: "national",
    schoolState: "Telangana",
    editionState: null,
    curriculumPolicy: "unknown",
  });
  assert.equal(result.summary, "does_not_match");
  assert.equal(result.copy, "A requirement does not match");
});

test("a matching class still needs confirmation when the board is unknown", () => {
  const result = evaluateEligibility({
    eligibilityText: "Classes 1–10",
    grade: 5,
    scopeLevel: "national",
    schoolState: "Telangana",
    editionState: null,
    curriculumPolicy: "unknown",
  });
  assert.equal(result.grade, "pass");
  assert.equal(result.summary, "needs_confirmation");
});

test("search ranks a near title above a miss", () => {
  const hit = searchScore("IMO", {
    title: "SOF IMO",
    organizer: "Science Olympiad Foundation",
    editionLabel: "2026-27",
  });
  const miss = searchScore("zzzz", {
    title: "SOF IMO",
    organizer: "Science Olympiad Foundation",
    editionLabel: "2026-27",
  });
  assert.ok(hit > miss);
  assert.equal(miss, 0);
});

test("fee label is only Free or Paid when the status says so", () => {
  assert.equal(cardFeeLabel("free"), "Free");
  assert.equal(cardFeeLabel("paid"), "Paid");
  assert.equal(cardFeeLabel("varies"), "Paid");
  assert.equal(cardFeeLabel("unknown"), null);
  assert.equal(cardFeeLabel(null), null);
});

test("card dates keep the next registration close and the exam window", () => {
  const facts = cardDateFacts(
    [
      {
        scheduleType: "registration",
        startsOn: null,
        endsOn: "2026-09-10",
        dateStatus: "estimated",
      },
      {
        scheduleType: "registration",
        startsOn: null,
        endsOn: "2026-11-10",
        dateStatus: "estimated",
      },
      {
        scheduleType: "event",
        startsOn: "2026-11-18",
        endsOn: null,
        dateStatus: "estimated",
      },
    ],
    new Date("2026-09-27T00:00:00Z")
  );
  assert.equal(facts.registrationClosesOn, "2026-11-10");
  assert.equal(facts.registrationDateCount, 2);
  assert.equal(facts.eventStartsOn, "2026-11-18");
  assert.equal(facts.eventDateCount, 1);
});
