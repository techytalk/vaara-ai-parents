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
import { authMiddleware } from "../middleware/auth.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";
import {
  ensureCatalogExists,
  getCatalogManifest,
  getCatalogPayload,
} from "../services/school-catalog.js";
import {
  getSchoolShortlist,
  searchVerifiedSchools,
} from "../services/school-shortlist.js";

const STATIC_REFERENCE_CACHE =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const POSTAL_LOOKUP_CACHE = "public, max-age=3600, s-maxage=86400";
const MANIFEST_CACHE = "public, max-age=30, s-maxage=60";
const CATALOG_CACHE = "public, max-age=31536000, immutable";
const SHORTLIST_CACHE = "public, max-age=600, s-maxage=3600";
const SEARCH_CACHE = "public, max-age=120, s-maxage=600";

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

  app.get(
    "/postal-codes/:country/:code",
    rateLimitMiddleware({
      prefix: "ref-postal",
      limit: 60,
      windowSeconds: 60,
      keyFn: (ctx) => ctx.req.header("x-forwarded-for") ?? "anon",
    }),
    async (c) => {
      const countryParam = c.req.param("country") ?? "";
      const postalCode = c.req.param("code") ?? "";
      const countryCode = normalizeCountryCode(countryParam);
      const country = getPostalCountry(countryCode);
      if (!country) {
        return c.json({ error: "Unsupported country" }, 400);
      }

      const started = Date.now();
      const client = await pool.connect();
      try {
        const lookup = await lookupPostalCode(client, countryCode, postalCode);
        if (!lookup) {
          return c.json({ error: "Postal code not found" }, 404);
        }

        console.log(
          JSON.stringify({
            event: "postal_lookup",
            country: countryCode,
            source: lookup.source ?? "unknown",
            ms: Date.now() - started,
          })
        );

        // Communities intentionally omitted — user-derived; fetch behind auth.
        c.header("Cache-Control", POSTAL_LOOKUP_CACHE);
        return c.json({ ...lookup, pinCode: lookup.postalCode });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/pin-codes/:pin",
    rateLimitMiddleware({
      prefix: "ref-pin",
      limit: 60,
      windowSeconds: 60,
      keyFn: (ctx) => ctx.req.header("x-forwarded-for") ?? "anon",
    }),
    async (c) => {
      const pin = c.req.param("pin") ?? "";
      if (!isValidIndianPinCode(pin)) {
        return c.json({ error: "Invalid pin code" }, 400);
      }

      const client = await pool.connect();
      try {
        const lookup = await lookupPostalCode(client, "IN", pin);
        if (!lookup) {
          return c.json({ error: "Pin code not found" }, 404);
        }
        c.header("Cache-Control", POSTAL_LOOKUP_CACHE);
        return c.json({ ...lookup, pinCode: lookup.postalCode });
      } finally {
        client.release();
      }
    }
  );

  // Authenticated communities for a PIN (moved off the public postal object).
  // Keep this as a route-level auth handler — do not mount a sub-app at "/"
  // with `use("*", authMiddleware)` or public school routes get 401.
  app.get(
    "/communities",
    authMiddleware,
    rateLimitMiddleware({
      prefix: "ref-communities",
      limit: 30,
      windowSeconds: 60,
    }),
    async (c) => {
      const countryCode = normalizeCountryCode(
        c.req.query("country") ?? "IN"
      );
      const pin = c.req.query("pin")?.trim() ?? c.req.query("postalCode")?.trim();
      if (!pin) return c.json({ error: "pin is required" }, 400);
      const client = await pool.connect();
      try {
        const communities = await listCommunitySuggestions(
          client,
          countryCode,
          pin
        );
        return c.json({ communities });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/schools/manifest",
    rateLimitMiddleware({
      prefix: "ref-school-manifest",
      limit: 120,
      windowSeconds: 60,
      keyFn: (ctx) => ctx.req.header("x-forwarded-for") ?? "anon",
    }),
    async (c) => {
      const client = await pool.connect();
      try {
        await ensureCatalogExists(client);
        const manifest = await getCatalogManifest(client);
        if (!manifest) return c.json({ error: "Catalogue unavailable" }, 503);
        c.header("Cache-Control", MANIFEST_CACHE);
        return c.json(manifest);
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/schools/catalog/v:gen",
    rateLimitMiddleware({
      prefix: "ref-school-catalog",
      limit: 30,
      windowSeconds: 60,
      keyFn: (ctx) => ctx.req.header("x-forwarded-for") ?? "anon",
    }),
    async (c) => {
      const gen = Number(c.req.param("gen"));
      if (!Number.isFinite(gen) || gen < 1) {
        return c.json({ error: "Invalid generation" }, 400);
      }
      const client = await pool.connect();
      try {
        const payload = await getCatalogPayload(client, gen);
        if (!payload) return c.json({ error: "Generation not found" }, 404);
        c.header("Cache-Control", CATALOG_CACHE);
        c.header("ETag", `"${payload.checksum}"`);
        c.header("Content-Type", "application/json; charset=utf-8");
        // Serve exact checksummed bytes when available.
        return c.body(payload.raw);
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/schools/shortlist",
    rateLimitMiddleware({
      prefix: "ref-school-shortlist",
      limit: 60,
      windowSeconds: 60,
      keyFn: (ctx) => ctx.req.header("x-forwarded-for") ?? "anon",
    }),
    async (c) => {
      const country = (c.req.query("country") ?? "IN").toUpperCase();
      const pin = c.req.query("pin")?.trim() ?? "";
      const locality = c.req.query("locality")?.trim() || null;
      const region = c.req.query("region")?.trim() || null;
      if (!pin) return c.json({ error: "pin is required" }, 400);

      const client = await pool.connect();
      try {
        const schools = await getSchoolShortlist(client, {
          countryCode: country,
          pinCode: pin,
          locality,
          region,
        });
        c.header("Cache-Control", SHORTLIST_CACHE);
        return c.json(schools);
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/schools/search",
    rateLimitMiddleware({
      prefix: "ref-school-search",
      limit: 40,
      windowSeconds: 60,
      keyFn: (ctx) => ctx.req.header("x-forwarded-for") ?? "anon",
    }),
    async (c) => {
      const q = (c.req.query("q")?.trim() ?? "").slice(0, 80);
      if (q.length < 3) return c.json([]);
      const rawLimit = Number(c.req.query("limit") ?? 20);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(Math.floor(rawLimit), 20)
          : 20;
      const started = Date.now();
      const client = await pool.connect();
      try {
        const schools = await searchVerifiedSchools(client, q, limit);
        console.log(
          JSON.stringify({
            event: "school_search",
            source: "public",
            ms: Date.now() - started,
            results: schools.length,
            qLen: q.length,
          })
        );
        c.header("Cache-Control", SEARCH_CACHE);
        return c.json(schools);
      } finally {
        client.release();
      }
    }
  );

  return app;
}
