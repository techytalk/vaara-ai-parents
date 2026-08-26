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

    const topics = [
      { slug: "screen-time", name: "Screen time", category: "Daily life" },
      { slug: "exam-stress", name: "Exam stress", category: "School" },
      { slug: "picky-eating", name: "Picky eating", category: "Daily life" },
      { slug: "sleep", name: "Sleep routines", category: "Daily life" },
      { slug: "tantrums", name: "Tantrums", category: "Behaviour" },
      { slug: "teen-behaviour", name: "Teen behaviour", category: "Behaviour" },
      { slug: "learning-differences", name: "Learning differences", category: "School" },
      { slug: "admissions", name: "Admissions", category: "School" },
      { slug: "board-choice", name: "Board choice", category: "School" },
      { slug: "pregnancy", name: "Pregnancy", category: "Early years" },
      { slug: "infant-care", name: "Infant care", category: "Early years" },
      { slug: "sibling-rivalry", name: "Sibling rivalry", category: "Family" },
      { slug: "bullying", name: "Bullying", category: "Safety" },
      { slug: "extracurriculars", name: "Extracurriculars", category: "School" },
      { slug: "transport-safety", name: "Transport safety", category: "Safety" },
      { slug: "homework", name: "Homework help", category: "School" },
      { slug: "friendships", name: "Friendships", category: "Social" },
      { slug: "anxiety", name: "Anxiety", category: "Wellbeing" },
      { slug: "discipline", name: "Discipline", category: "Behaviour" },
      { slug: "nutrition", name: "Nutrition", category: "Daily life" },
      { slug: "potty-training", name: "Potty training", category: "Early years" },
      { slug: "daycare", name: "Daycare & childcare", category: "Early years" },
      { slug: "work-life-balance", name: "Work-life balance", category: "Family" },
      { slug: "single-parenting", name: "Single parenting", category: "Family" },
      { slug: "special-needs", name: "Special needs support", category: "Wellbeing" },
      { slug: "reading", name: "Reading & literacy", category: "School" },
      { slug: "maths-help", name: "Maths help", category: "School" },
      { slug: "sports", name: "Sports & fitness", category: "Activities" },
      { slug: "music-classes", name: "Music classes", category: "Activities" },
      { slug: "summer-camps", name: "Summer camps", category: "Activities" },
      { slug: "tuition", name: "Tuition & coaching", category: "School" },
      { slug: "school-uniforms", name: "School uniforms", category: "School" },
      { slug: "school-fees", name: "School fees", category: "School" },
      { slug: "online-learning", name: "Online learning", category: "School" },
      { slug: "language-learning", name: "Language learning", category: "School" },
      { slug: "gifted-children", name: "Gifted children", category: "School" },
      { slug: "parent-burnout", name: "Parent burnout", category: "Wellbeing" },
      { slug: "grandparent-care", name: "Grandparent care", category: "Family" },
      { slug: "pet-allergies", name: "Allergies", category: "Health" },
      { slug: "vaccinations", name: "Vaccinations", category: "Health" },
      { slug: "dental-care", name: "Dental care", category: "Health" },
      { slug: "mental-health", name: "Mental health", category: "Wellbeing", sensitive: true },
      { slug: "divorce", name: "Co-parenting after separation", category: "Family", sensitive: true },
      { slug: "device-addiction", name: "Device addiction", category: "Daily life" },
      { slug: "career-guidance", name: "Career guidance", category: "Teens" },
      { slug: "college-prep", name: "College preparation", category: "Teens" },
    ];

    for (const topic of topics) {
      await client.query(
        `INSERT INTO topics (slug, name, category, sensitive)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO NOTHING`,
        [topic.slug, topic.name, topic.category, topic.sensitive ?? false]
      );
    }

    await client.query(
      `INSERT INTO topic_aliases (alias, topic_id)
       SELECT 'exam-anxiety', id FROM topics WHERE slug = 'exam-stress'
       ON CONFLICT DO NOTHING`
    );

    console.log(`Seed completed: ${topics.length} topics`);

    await client.query(
      `INSERT INTO experts (display_name, credentials, bio, verified)
       SELECT 'Dr. Ananya Rao',
              'MBBS, DCH · Paediatrician',
              'School health and developmental milestones.',
              true
       WHERE NOT EXISTS (SELECT 1 FROM experts WHERE display_name = 'Dr. Ananya Rao')`
    );

    await client.query(
      `INSERT INTO expert_sessions (expert_id, title, description, status, starts_at, ends_at)
       SELECT e.id,
              'Ask a paediatrician: winter illnesses',
              'Logistics-only Q&A on when to visit a clinic — not diagnosis or dosing.',
              'collecting',
              now() + interval '3 days',
              now() + interval '3 days 1 hour'
       FROM experts e
       WHERE e.display_name = 'Dr. Ananya Rao'
         AND NOT EXISTS (SELECT 1 FROM expert_sessions LIMIT 1)`
    );

    console.log("Seed completed: demo expert session");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
