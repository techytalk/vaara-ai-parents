import { pool } from "./client.js";

const curricula = [
  { code: "IB_PYP", name: "IB Primary Years Programme", sort: 1 },
  { code: "IB_MYP", name: "IB Middle Years Programme", sort: 2 },
  { code: "IBDP", name: "IB Diploma Programme", sort: 3 },
  { code: "CBSE", name: "CBSE", sort: 4 },
  { code: "SSC", name: "SSC (Telangana/AP)", sort: 5 },
  { code: "IGCSE", name: "IGCSE", sort: 6 },
];

const gradesByCurriculum: Record<string, Array<{ code: string; label: string; sort: number }>> = {
  IB_PYP: [
    { code: "K", label: "Kindergarten", sort: 0 },
    ...Array.from({ length: 5 }, (_, i) => ({
      code: `G${i + 1}`,
      label: `Grade ${i + 1}`,
      sort: i + 1,
    })),
  ],
  IB_MYP: Array.from({ length: 5 }, (_, i) => ({
    code: `G${i + 6}`,
    label: `Grade ${i + 6}`,
    sort: i,
  })),
  IBDP: [
    { code: "G11", label: "Grade 11", sort: 0 },
    { code: "G12", label: "Grade 12", sort: 1 },
  ],
  CBSE: [
    { code: "NURSERY", label: "Nursery", sort: 0 },
    { code: "LKG", label: "LKG", sort: 1 },
    { code: "UKG", label: "UKG", sort: 2 },
    ...Array.from({ length: 12 }, (_, i) => ({
      code: `G${i + 1}`,
      label: `Grade ${i + 1}`,
      sort: i + 3,
    })),
  ],
  SSC: Array.from({ length: 10 }, (_, i) => ({
    code: `G${i + 1}`,
    label: `Grade ${i + 1}`,
    sort: i,
  })),
  IGCSE: Array.from({ length: 11 }, (_, i) => ({
    code: `Y${i + 1}`,
    label: `Year ${i + 1}`,
    sort: i,
  })),
};

async function seed() {
  const client = await pool.connect();
  try {
    for (const c of curricula) {
      await client.query(
        `INSERT INTO curricula (code, name, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name, c.sort]
      );
    }

    for (const [code, grades] of Object.entries(gradesByCurriculum)) {
      const { rows } = await client.query(
        "SELECT id FROM curricula WHERE code = $1",
        [code]
      );
      if (rows.length === 0) continue;
      const curriculumId = rows[0].id;

      for (const g of grades) {
        await client.query(
          `INSERT INTO curriculum_grades (curriculum_id, code, label, sort_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (curriculum_id, code) DO NOTHING`,
          [curriculumId, g.code, g.label, g.sort]
        );
      }
    }

    console.log("Seed completed: curricula and grades");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
