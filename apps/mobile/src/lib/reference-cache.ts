import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";
import {
  api,
  type Curriculum,
  type PostalCountry,
  type SchoolCatalogManifest,
  type SchoolCatalogRow,
  type SchoolListItem,
} from "@/lib/api";
import {
  getOnboardingCurricula,
  setCatalogueGeneration,
  setOnboardingCurricula,
} from "@/lib/onboarding-draft";
import { trackEvent } from "@/lib/analytics";

const CACHE_VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_DIR = `${FileSystem.documentDirectory ?? ""}vaara-reference/`;
const CATALOG_ACTIVE = `${CACHE_DIR}schools-catalog-active.json`;
const CATALOG_TEMP = `${CACHE_DIR}schools-catalog-temp.json`;
const CATALOG_BACKUP = `${CACHE_DIR}schools-catalog-backup.json`;

type CacheEnvelope<T> = {
  version: number;
  savedAt: number;
  data: T;
};

type CatalogDisk = {
  generation: number;
  checksum: string;
  rows: SchoolCatalogRow[];
};

let memoryCatalog: CatalogDisk | null = null;
let memoryShortlist: { key: string; rows: SchoolListItem[]; at: number } | null =
  null;

async function ensureDir(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  if (!FileSystem.documentDirectory) return null;
  try {
    await ensureDir();
    const path = `${CACHE_DIR}${key}.json`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.version !== CACHE_VERSION || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  try {
    await ensureDir();
    const envelope: CacheEnvelope<T> = {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      data,
    };
    await FileSystem.writeAsStringAsync(
      `${CACHE_DIR}${key}.json`,
      JSON.stringify(envelope)
    );
  } catch {
    // Cache write failures should never block onboarding.
  }
}

function isFresh(savedAt: number): boolean {
  return Date.now() - savedAt < MAX_AGE_MS;
}

export async function getPostalCountriesCached(): Promise<PostalCountry[]> {
  const cached = await readCache<PostalCountry[]>("postal-countries");
  if (cached && isFresh(cached.savedAt)) {
    void api
      .getPostalCountries()
      .then((fresh) => writeCache("postal-countries", fresh))
      .catch(() => undefined);
    return cached.data;
  }

  try {
    const fresh = await api.getPostalCountries();
    await writeCache("postal-countries", fresh);
    return fresh;
  } catch (error) {
    if (cached?.data) return cached.data;
    throw error;
  }
}

export async function getCurriculaCached(): Promise<Curriculum[]> {
  const draft = getOnboardingCurricula();
  if (draft) return draft;

  const cached = await readCache<Curriculum[]>("curricula");
  if (cached && isFresh(cached.savedAt)) {
    setOnboardingCurricula(cached.data);
    void api
      .getCurricula()
      .then((fresh) => {
        setOnboardingCurricula(fresh);
        return writeCache("curricula", fresh);
      })
      .catch(() => undefined);
    return cached.data;
  }

  try {
    const fresh = await api.getCurricula();
    setOnboardingCurricula(fresh);
    await writeCache("curricula", fresh);
    return fresh;
  } catch (error) {
    if (cached?.data) {
      setOnboardingCurricula(cached.data);
      return cached.data;
    }
    throw error;
  }
}

async function readActiveCatalog(): Promise<CatalogDisk | null> {
  if (memoryCatalog) return memoryCatalog;
  if (!FileSystem.documentDirectory) return null;
  try {
    await ensureDir();
    const info = await FileSystem.getInfoAsync(CATALOG_ACTIVE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(CATALOG_ACTIVE);
    const parsed = JSON.parse(raw) as CatalogDisk;
    if (!parsed?.rows || !parsed.generation) return null;
    memoryCatalog = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function activateCatalog(
  generation: number,
  checksum: string,
  rows: SchoolCatalogRow[]
): Promise<void> {
  const disk: CatalogDisk = { generation, checksum, rows };
  if (!FileSystem.documentDirectory) {
    memoryCatalog = disk;
    setCatalogueGeneration(generation);
    return;
  }
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(CATALOG_TEMP, JSON.stringify(disk));
    const activeInfo = await FileSystem.getInfoAsync(CATALOG_ACTIVE);
    if (activeInfo.exists) {
      const backupInfo = await FileSystem.getInfoAsync(CATALOG_BACKUP);
      if (backupInfo.exists) {
        await FileSystem.deleteAsync(CATALOG_BACKUP, { idempotent: true });
      }
      await FileSystem.moveAsync({ from: CATALOG_ACTIVE, to: CATALOG_BACKUP });
    }
    await FileSystem.moveAsync({ from: CATALOG_TEMP, to: CATALOG_ACTIVE });
    memoryCatalog = disk;
    setCatalogueGeneration(generation);
  } catch {
    // Keep previous memory/disk catalogue if activation fails.
    try {
      const backup = await FileSystem.getInfoAsync(CATALOG_BACKUP);
      if (backup.exists) {
        await FileSystem.moveAsync({ from: CATALOG_BACKUP, to: CATALOG_ACTIVE });
      }
    } catch {
      // ignore
    }
  }
}

export async function ensureSchoolCatalog(): Promise<CatalogDisk | null> {
  const started = Date.now();
  try {
    const manifest = await api.getSchoolManifest();
    const existing = await readActiveCatalog();
    if (
      existing &&
      existing.generation === manifest.generation &&
      existing.checksum === manifest.checksum
    ) {
      return existing;
    }
    const downloaded = await api.getSchoolCatalog(manifest.generation);
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      downloaded.text
    );
    if (digest !== manifest.checksum) {
      throw new Error("Catalogue checksum mismatch");
    }
    const rows = JSON.parse(downloaded.text) as SchoolCatalogRow[];
    if (!Array.isArray(rows)) {
      throw new Error("Catalogue payload invalid");
    }
    if (
      typeof manifest.rowCount === "number" &&
      rows.length !== manifest.rowCount
    ) {
      throw new Error("Catalogue row count mismatch");
    }
    await activateCatalog(manifest.generation, manifest.checksum, rows);
    trackEvent("school_catalog_ready", {
      ms: Date.now() - started,
      size: rows.length,
      generation: manifest.generation,
    });
    return memoryCatalog;
  } catch {
    return readActiveCatalog();
  }
}

export function filterLocalCatalog(query: string, limit = 20): SchoolListItem[] {
  const q = query.trim().toLowerCase();
  if (!memoryCatalog || q.length < 1) return [];
  const scored = memoryCatalog.rows
    .map((row) => {
      const hay = [
        row.name,
        row.branch ?? "",
        row.locality ?? "",
        ...(row.aliases ?? []),
      ]
        .join(" ")
        .toLowerCase();
      const prefix = hay.startsWith(q) || row.name.toLowerCase().startsWith(q);
      const includes = hay.includes(q);
      if (!includes) return null;
      const verifiedBoost = row.verified === false ? 2 : 0;
      return { row, score: (prefix ? 0 : 1) + verifiedBoost };
    })
    .filter(Boolean) as Array<{ row: SchoolCatalogRow; score: number }>;

  scored.sort((a, b) => a.score - b.score || a.row.name.localeCompare(b.row.name));
  return scored.slice(0, limit).map(({ row }) => ({
    id: row.id,
    name: row.name,
    branch: row.branch,
    city: row.locality || row.region || "",
    state: null,
    pinCode: null,
    verified: row.verified !== false,
    displayLabel: [row.name, row.branch, row.locality].filter(Boolean).join(" · "),
    ratingAvg: null,
    ratingCount: 0,
    boardCodes: row.boards,
  }));
}

export async function getSchoolShortlistCached(params: {
  country?: string;
  pin: string;
  locality?: string;
}): Promise<SchoolListItem[]> {
  const key = `${params.country ?? "IN"}:${params.pin}:${params.locality ?? ""}`;
  if (
    memoryShortlist &&
    memoryShortlist.key === key &&
    Date.now() - memoryShortlist.at < 10 * 60 * 1000
  ) {
    return memoryShortlist.rows;
  }
  const started = Date.now();
  const rows = await api.getSchoolShortlist(params);
  memoryShortlist = { key, rows, at: Date.now() };
  trackEvent("shortlist_ready", { ms: Date.now() - started, size: rows.length });
  return rows;
}

export async function prefetchSchoolsForLocation(params: {
  country?: string;
  pin: string;
  locality?: string;
}): Promise<void> {
  await Promise.all([
    getSchoolShortlistCached(params).catch(() => []),
    ensureSchoolCatalog().catch(() => null),
  ]);
}

export function getManifestFromMemory(): SchoolCatalogManifest | null {
  if (!memoryCatalog) return null;
  return {
    schemaVersion: 1,
    generation: memoryCatalog.generation,
    checksum: memoryCatalog.checksum,
    compressedSize: null,
    rowCount: memoryCatalog.rows.length,
    createdAt: new Date().toISOString(),
    url: `/v1/reference/schools/catalog/v${memoryCatalog.generation}`,
  };
}
