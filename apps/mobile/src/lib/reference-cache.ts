import * as FileSystem from "expo-file-system";
import { api, type Curriculum, type PostalCountry } from "@/lib/api";
import {
  getOnboardingCurricula,
  setOnboardingCurricula,
} from "@/lib/onboarding-draft";

const CACHE_VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_DIR = `${FileSystem.documentDirectory ?? ""}vaara-reference/`;

type CacheEnvelope<T> = {
  version: number;
  savedAt: number;
  data: T;
};

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
