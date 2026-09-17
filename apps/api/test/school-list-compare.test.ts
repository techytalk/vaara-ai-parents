import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  comparePastedToCatalog,
  parsePastedSchoolList,
  summarizeCompare,
  type CatalogSchool,
} from "../src/services/school-list-compare.js";

const catalog: CatalogSchool[] = [
  {
    id: "1",
    name: "Goldcrest School",
    branch: "Gachibowli",
    locality: "Gachibowli",
    region: "west-hyderabad",
    city: "Hyderabad",
    board_codes: ["CBSE"],
    grades_offered: "Nursery-12",
    normalized_key: "goldcrest_school|gachibowli|hyderabad",
    verified: true,
  },
  {
    id: "2",
    name: "Blue Blocks Complete School",
    branch: "Osman Nagar",
    locality: "Osman Nagar",
    region: "west-hyderabad",
    city: "Hyderabad",
    board_codes: [],
    grades_offered: null,
    normalized_key: "blue_blocks_complete_school|osman_nagar|hyderabad",
    verified: true,
  },
  {
    id: "3",
    name: "CHIREC International School",
    branch: "Kondapur",
    locality: "Kondapur",
    region: "west-hyderabad",
    city: "Hyderabad",
    board_codes: ["CBSE"],
    grades_offered: "Nursery-12",
    normalized_key: "chirec_international_school|kondapur|hyderabad",
    verified: true,
  },
];

describe("school-list-compare", () => {
  it("parses markdown tables", () => {
    const text = `
| # | School | Type / area |
| -: | --- | --- |
| 1 | Goldcrest School | CBSE — Gachibowli |
| 2 | Nasr Boys School | ICSE — Gachibowli |
`;
    const rows = parsePastedSchoolList(text, "Gachibowli");
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.name, "Goldcrest School");
    assert.match(rows[0]?.area ?? "", /Gachibowli/i);
  });

  it("buckets on_site vs brand_elsewhere vs missing", () => {
    const pasted = parsePastedSchoolList(
      `Goldcrest School — Gachibowli
Blue Blocks Complete School — Gachibowli
Mystery Preschool — Gachibowli`,
      "Gachibowli"
    );
    const results = comparePastedToCatalog(pasted, catalog, "Gachibowli");
    assert.equal(results[0]?.status, "on_site");
    assert.equal(results[1]?.status, "brand_elsewhere");
    assert.equal(results[2]?.status, "missing");
    const summary = summarizeCompare(results);
    assert.equal(summary.on_site, 1);
    assert.equal(summary.brand_elsewhere, 1);
    assert.equal(summary.missing, 1);
  });

  it("matches CHIREC brand elsewhere when only Kondapur exists", () => {
    const pasted = parsePastedSchoolList(
      "CHIREC International School - Gachibowli (Preschool) Campus — Telecom Officers Colony",
      "Gachibowli"
    );
    const results = comparePastedToCatalog(pasted, catalog, "Gachibowli");
    assert.equal(results[0]?.status, "brand_elsewhere");
    assert.match(results[0]?.match?.name ?? "", /CHIREC/i);
  });
});
