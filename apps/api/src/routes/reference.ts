import { Hono } from "hono";
import { pool } from "@vaara/db";
import {
  getPostalCountry,
  isValidIndianPinCode,
  listCommunitySuggestions,
  listPostalCountries,
  lookupPostalCode,
  normalizeCountryCode,
} from "../lib/postal-code/index.js";

const STATIC_REFERENCE_CACHE =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const POSTAL_LOOKUP_CACHE = "public, max-age=3600, s-maxage=86400";

export function createReferenceRoutes() {
  const app = new Hono();

  app.get("/curricula", async (c) => {
    const client = await pool.connect();
    try {
      const { rows: curricula } = await client.query(
        `SELECT id, code, name, sort_order FROM curricula ORDER BY sort_order`
      );

      const { rows: grades } = await client.query(
        `SELECT id, curriculum_id, code, label, sort_order
         FROM curriculum_grades ORDER BY sort_order`
      );

      const gradesByCurriculum = new Map<string, typeof grades>();
      for (const g of grades) {
        const list = gradesByCurriculum.get(g.curriculum_id) ?? [];
        list.push(g);
        gradesByCurriculum.set(g.curriculum_id, list);
      }

      c.header("Cache-Control", STATIC_REFERENCE_CACHE);
      return c.json(
        curricula.map((cur) => ({
          id: cur.id,
          code: cur.code,
          name: cur.name,
          grades: (gradesByCurriculum.get(cur.id) ?? []).map((g) => ({
            id: g.id,
            code: g.code,
            label: g.label,
          })),
        }))
      );
    } finally {
      client.release();
    }
  });

  app.get("/postal-countries", (c) => {
    c.header("Cache-Control", STATIC_REFERENCE_CACHE);
    return c.json(
      listPostalCountries().map((country) => ({
        code: country.code,
        name: country.name,
        postalLabel: country.postalLabel,
        placeholder: country.placeholder,
        provider: country.provider,
        lookupSupported: country.provider !== "manual",
      }))
    );
  });

  app.get("/postal-codes/:country/:code", async (c) => {
    const countryCode = normalizeCountryCode(c.req.param("country"));
    const postalCode = c.req.param("code");
    const country = getPostalCountry(countryCode);
    if (!country) {
      return c.json({ error: "Unsupported country" }, 400);
    }

    const client = await pool.connect();
    try {
      const lookup = await lookupPostalCode(client, countryCode, postalCode);
      if (!lookup) {
        return c.json({ error: "Postal code not found" }, 404);
      }

      const communities = await listCommunitySuggestions(
        client,
        countryCode,
        lookup.postalCode
      );
      c.header("Cache-Control", POSTAL_LOOKUP_CACHE);
      return c.json({ ...lookup, communities, pinCode: lookup.postalCode });
    } finally {
      client.release();
    }
  });

  app.get("/pin-codes/:pin", async (c) => {
    const pin = c.req.param("pin");
    if (!isValidIndianPinCode(pin)) {
      return c.json({ error: "Invalid pin code" }, 400);
    }

    const client = await pool.connect();
    try {
      const lookup = await lookupPostalCode(client, "IN", pin);
      if (!lookup) {
        return c.json({ error: "Pin code not found" }, 404);
      }

      const communities = await listCommunitySuggestions(client, "IN", pin);
      c.header("Cache-Control", POSTAL_LOOKUP_CACHE);
      return c.json({ ...lookup, communities, pinCode: lookup.postalCode });
    } finally {
      client.release();
    }
  });

  return app;
}
