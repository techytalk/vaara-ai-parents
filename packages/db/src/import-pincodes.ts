import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { pool } from "./client.js";

const require = createRequire(import.meta.url);

function cleanOfficeName(name: string): string {
  return name
    .replace(/\s+(S\.?O\.?|B\.?O\.?|H\.?O\.?|G\.?P\.?O\.?)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

type BundledDataset = {
  states: string[];
  pincodes: Record<string, [number, string, Array<[string, string]>]>;
};

function resolveDatasetPath(): string {
  const packageJsonPath = require.resolve("@twin.techies/india-pincode/package.json");
  return resolve(dirname(packageJsonPath), "data/pincodes.json");
}

async function importBundledDataset() {
  const datasetPath = resolveDatasetPath();
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as BundledDataset;
  const pinCodes = Object.keys(dataset.pincodes);
  console.log(`Importing ${pinCodes.length} Indian pincodes from ${datasetPath}…`);

  const client = await pool.connect();
  let importedPins = 0;
  let importedOffices = 0;
  try {
    await client.query("BEGIN");
    for (const postalCode of pinCodes) {
      const [stateIdx, district, offices] = dataset.pincodes[postalCode];
      const stateName = dataset.states[stateIdx];
      for (const [officeName] of offices) {
        await client.query(
          `INSERT INTO postal_code_offices
             (country_code, postal_code, office_name, district, state_name, office_type, delivery_status)
           VALUES ('IN', $1, $2, $3, $4, NULL, NULL)
           ON CONFLICT (country_code, postal_code, office_name) DO NOTHING`,
          [postalCode, cleanOfficeName(officeName), district, stateName]
        );
        importedOffices += 1;
      }
      importedPins += 1;
      if (importedPins % 1000 === 0) {
        console.log(`  …${importedPins} pincodes`);
      }
    }
    await client.query("COMMIT");
    console.log(
      `Imported ${importedPins} pincodes (${importedOffices} offices) successfully`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importBundledDataset().catch((error) => {
  console.error("Pincode import failed:", error);
  process.exit(1);
});
