import type {
  AccessPoint,
  CoverageResult,
  InstitutionFootprint,
  PopulationLookup,
} from "./types.js";
import { resolvePsgcMatch, getPopulation } from "./data.js";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const COVERAGE_NOTES = [
  "Population: 2024 Census of Population (PSA). Point-in-time count.",
  "Access points: BSP-registered financial service locations (bank offices, ATMs, NSSLAs).",
  "Each record is a single access point. A physical office with multiple ATMs may appear as multiple records.",
];

// --- Search ---

interface AccessPointSearchParams {
  query: string;
  region?: string;
  province?: string;
  town?: string;
  industry?: string;
  has_atm?: boolean;
}

export function searchAccessPoints(
  accessPoints: AccessPoint[],
  params: AccessPointSearchParams
): AccessPoint[] {
  const { query, region, province, town, industry, has_atm } = params;

  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const scored: { accessPoint: AccessPoint; score: number }[] = [];

  for (const ap of accessPoints) {
    if (region && normalize(ap.region) !== normalize(region)) continue;
    if (province && normalize(ap.province) !== normalize(province)) continue;
    if (town && normalize(ap.town) !== normalize(town)) continue;
    if (industry && normalize(ap.industry) !== normalize(industry)) continue;
    if (has_atm !== undefined && ap.has_atm !== has_atm) continue;

    const normInstitution = normalize(ap.institution_name);
    const normBranch = normalize(ap.branch_name);

    let score = 0;

    if (normInstitution === normalizedQuery || normBranch === normalizedQuery) {
      score = 3;
    } else if (
      normInstitution.startsWith(normalizedQuery) ||
      normBranch.startsWith(normalizedQuery)
    ) {
      score = 2;
    } else if (
      normInstitution.includes(normalizedQuery) ||
      normBranch.includes(normalizedQuery)
    ) {
      score = 1;
    }

    if (score > 0) {
      scored.push({ accessPoint: ap, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.accessPoint.institution_name.localeCompare(b.accessPoint.institution_name);
  });

  return scored.map((s) => s.accessPoint);
}

// --- Index for O(1) lookup ---

export function buildAccessPointIndex(accessPoints: AccessPoint[]): Map<string, AccessPoint> {
  return new Map(accessPoints.map((ap) => [ap.id, ap]));
}

export function getAccessPointById(
  index: Map<string, AccessPoint>,
  id: string
): AccessPoint | undefined {
  return index.get(id);
}

// --- Coverage ---

interface CoverageParams {
  psgc_code: string;
  industry?: string;
}

export function getCoverage(
  accessPoints: AccessPoint[],
  pop: PopulationLookup,
  params: CoverageParams
): CoverageResult | null {
  const { psgc_code, industry } = params;
  const { field, code } = resolvePsgcMatch(pop, psgc_code);

  const popData = getPopulation(pop, psgc_code);
  if (!popData) return null;

  const areaPoints = accessPoints.filter((ap) => {
    if (industry && normalize(ap.industry) !== normalize(industry)) return false;
    return ap[field] === code;
  });

  const by_industry: Record<string, number> = {};
  for (const ap of areaPoints) {
    by_industry[ap.industry] = (by_industry[ap.industry] || 0) + 1;
  }

  const uniqueInstitutions = new Set(
    areaPoints.map((ap) => normalize(ap.institution_name))
  ).size;
  const withAtm = areaPoints.filter((ap) => ap.has_atm).length;
  const totalAccessPoints = areaPoints.length;

  const levelLabel =
    field === "region_code"
      ? "Region"
      : field === "province_code"
        ? "Province"
        : "City/Municipality";

  return {
    psgc_code,
    area_name: popData.name,
    area_level: levelLabel,
    population: popData.population,
    total_access_points: totalAccessPoints,
    by_industry,
    unique_institutions: uniqueInstitutions,
    with_atm: withAtm,
    population_per_access_point:
      totalAccessPoints > 0
        ? Math.round(popData.population / totalAccessPoints)
        : null,
    data_notes: COVERAGE_NOTES,
  };
}

// --- Find unbanked areas ---

interface UnbankedParams {
  region_code?: string;
  limit?: number;
}

interface UnbankedArea {
  psgc_code: string;
  area_name: string;
  population: number;
}

export function findUnbankedAreas(
  accessPoints: AccessPoint[],
  pop: PopulationLookup,
  params: UnbankedParams
): UnbankedArea[] {
  const { region_code, limit = 50 } = params;

  const servedMunis = new Set<string>();
  for (const ap of accessPoints) {
    if (ap.psgc_muni_code) {
      servedMunis.add(ap.psgc_muni_code);
    }
  }

  const unbanked: UnbankedArea[] = [];

  for (const [code, entry] of Object.entries(pop)) {
    if (entry.level !== "Mun" && entry.level !== "City" && entry.level !== "SubMun")
      continue;
    if (region_code && entry.region_code !== region_code) continue;
    if (servedMunis.has(code)) continue;

    // SubMun entities (e.g. Manila city districts) inherit coverage from
    // their parent city. BSP tags branches at city level, not district
    // level, so districts always show 0 access points even though the
    // parent city is heavily served. PSGC SubMun codes differ from their
    // parent city at positions 5-6 (district ID); the parent city has
    // "00000" at positions 5-9. Derive by taking the first 5 chars.
    if (entry.level === "SubMun") {
      const parentCityCode = code.slice(0, 5) + "00000";
      if (servedMunis.has(parentCityCode)) continue;
    }

    unbanked.push({
      psgc_code: code,
      area_name: entry.name,
      population: entry.population,
    });
  }

  unbanked.sort((a, b) => b.population - a.population);
  return unbanked.slice(0, limit);
}

// --- Find underserved areas ---

interface UnderservedParams {
  level: "region" | "province";
  industry?: string;
  limit?: number;
}

interface UnderservedArea {
  psgc_code: string;
  area_name: string;
  area_level: string;
  population: number;
  access_point_count: number;
  population_per_access_point: number;
}

export function findUnderservedAreas(
  accessPoints: AccessPoint[],
  pop: PopulationLookup,
  params: UnderservedParams
): UnderservedArea[] {
  const { level, industry, limit = 20 } = params;

  const areaField: "region_code" | "province_code" =
    level === "region" ? "region_code" : "province_code";

  const filtered = industry
    ? accessPoints.filter((ap) => normalize(ap.industry) === normalize(industry))
    : accessPoints;

  const areaCodes = new Set<string>();
  for (const [code, entry] of Object.entries(pop)) {
    if (level === "region" && entry.level === "Reg") {
      areaCodes.add(code);
    } else if (level === "province" && entry.level === "Prov") {
      areaCodes.add(code);
    }
  }

  const results: UnderservedArea[] = [];

  for (const code of areaCodes) {
    const popData = getPopulation(pop, code);
    if (!popData || popData.population === 0) continue;

    const { code: resolvedCode } = resolvePsgcMatch(pop, code);

    const apCount = filtered.filter(
      (ap) => ap[areaField] === resolvedCode
    ).length;

    results.push({
      psgc_code: code,
      area_name: popData.name,
      area_level: level === "region" ? "Region" : "Province",
      population: popData.population,
      access_point_count: apCount,
      population_per_access_point:
        apCount > 0
          ? Math.round(popData.population / apCount)
          : popData.population,
    });
  }

  results.sort(
    (a, b) => b.population_per_access_point - a.population_per_access_point
  );

  return results.slice(0, limit);
}

// --- Institution footprint ---

interface FootprintParams {
  institution_name: string;
}

export function getInstitutionFootprint(
  accessPoints: AccessPoint[],
  params: FootprintParams
): InstitutionFootprint | null {
  const normalizedQuery = normalize(params.institution_name);
  if (!normalizedQuery) return null;

  const matched = accessPoints.filter((ap) =>
    normalize(ap.institution_name).includes(normalizedQuery)
  );

  if (matched.length === 0) return null;

  const nameCounts: Record<string, number> = {};
  for (const ap of matched) {
    nameCounts[ap.institution_name] =
      (nameCounts[ap.institution_name] || 0) + 1;
  }
  const canonicalName = Object.entries(nameCounts).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  const by_region: Record<string, number> = {};
  const by_province: Record<string, number> = {};
  const by_industry: Record<string, number> = {};
  let with_atm = 0;

  for (const ap of matched) {
    by_region[ap.region] = (by_region[ap.region] || 0) + 1;
    by_province[ap.province] = (by_province[ap.province] || 0) + 1;
    by_industry[ap.industry] = (by_industry[ap.industry] || 0) + 1;
    if (ap.has_atm) with_atm++;
  }

  return {
    institution_name: canonicalName,
    total_access_points: matched.length,
    by_region,
    by_province,
    with_atm,
    by_industry,
  };
}

// --- Compare coverage ---

interface CompareParams {
  psgc_code_a: string;
  psgc_code_b: string;
}

interface CoverageComparison {
  area_a: CoverageResult;
  area_b: CoverageResult;
}

export function compareCoverage(
  accessPoints: AccessPoint[],
  pop: PopulationLookup,
  params: CompareParams
): CoverageComparison | null {
  const area_a = getCoverage(accessPoints, pop, { psgc_code: params.psgc_code_a });
  const area_b = getCoverage(accessPoints, pop, { psgc_code: params.psgc_code_b });

  if (!area_a || !area_b) return null;

  return { area_a, area_b };
}
