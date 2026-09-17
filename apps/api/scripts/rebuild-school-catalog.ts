import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { pool } from "@vaara/db";
import { buildSchoolCatalog } from "../src/services/school-catalog.js";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const result = await buildSchoolCatalog(client);
  await client.query("COMMIT");
  console.log(
    JSON.stringify(
      {
        ok: true,
        generation: result.generation,
        rowCount: result.manifest.rowCount,
        url: result.manifest.url,
        checksum: result.manifest.checksum.slice(0, 12) + "…",
      },
      null,
      2
    )
  );
} catch (err) {
  await client.query("ROLLBACK");
  console.error(err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
