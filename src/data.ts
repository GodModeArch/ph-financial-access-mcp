import type { Institution, InstitutionType, InstitutionStatus, PopulationLookup } from "./types.js";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Search ---

interface SearchParams {
  query: string;
  institution_type?: InstitutionType;
  status?: InstitutionStatus;
}

export function searchInstitutions(institutions: Institution[], params: SearchParams): Institution[] {
  const { query, institution_type, status = "active" } = params;
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const scored: { institution: Institution; score: number }[] = [];

  for (const inst of institutions) {
    if (inst.status !== status) continue;
    if (institution_type && inst.bank_type !== institution_type) continue;

    const normName = normalize(inst.registration_name);
    const normTrade = inst.trade_name ? normalize(inst.trade_name) : "";

    let score = 0;

    if (normName === normalizedQuery || normTrade === normalizedQuery) {
      score = 3;
    } else if (normName.startsWith(normalizedQuery) || normTrade.startsWith(normalizedQuery)) {
      score = 2;
    } else if (normName.includes(normalizedQuery) || normTrade.includes(normalizedQuery)) {
      score = 1;
    }

    if (score > 0) {
      scored.push({ institution: inst, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.institution.registration_name.localeCompare(b.institution.registration_name);
  });

  return scored.map((s) => s.institution);
}

// --- Get by code ---

export function getInstitutionByCode(institutions: Institution[], code: string): Institution | undefined {
  return institutions.find((inst) => inst.institution_code === code);
}

// --- List with filters ---

interface ListParams {
  institution_type?: InstitutionType;
  psgc_code?: string;
  status?: InstitutionStatus;
}

export function listInstitutions(
  institutions: Institution[],
  pop: PopulationLookup,
  params: ListParams
): Institution[] {
  const { institution_type, psgc_code, status = "active" } = params;

  let results = institutions.filter((inst) => inst.status === status);

  if (institution_type) {
    results = results.filter((inst) => inst.bank_type === institution_type);
  }

  if (psgc_code) {
    const { field, code } = resolvePsgcMatch(pop, psgc_code);
    results = results.filter((inst) => inst[field] === code);
  }

  return results;
}

// --- Stats ---

interface InstitutionStats {
  total: number;
  total_active: number;
  total_inactive: number;
  by_type: Record<string, number>;
  by_region: Record<string, number>;
  by_status: Record<string, number>;
}

export function getInstitutionStats(institutions: Institution[]): InstitutionStats {
  const by_type: Record<string, number> = {};
  const by_region: Record<string, number> = {};
  const by_status: Record<string, number> = {};

  for (const inst of institutions) {
    by_type[inst.bank_type] = (by_type[inst.bank_type] || 0) + 1;
    by_status[inst.status] = (by_status[inst.status] || 0) + 1;

    if (inst.region_code) {
      by_region[inst.region_code] = (by_region[inst.region_code] || 0) + 1;
    }
  }

  return {
    total: institutions.length,
    total_active: institutions.filter((inst) => inst.status === "active").length,
    total_inactive: institutions.filter((inst) => inst.status !== "active").length,
    by_type,
    by_region,
    by_status,
  };
}

// --- PSGC resolution (shared utility) ---

function detectPsgcLevel(code: string): "region" | "province" | "municipality" {
  if (code.endsWith("00000000")) return "region";
  if (code.endsWith("000000")) return "province";
  return "municipality";
}

export interface PsgcMatch {
  level: "region" | "province" | "municipality";
  field: "region_code" | "province_code" | "psgc_muni_code";
  code: string;
}

export function resolvePsgcMatch(pop: PopulationLookup, psgc_code: string): PsgcMatch {
  const entry = pop[psgc_code];
  if (entry) {
    if (entry.level === "Reg") {
      return { level: "region", field: "region_code", code: psgc_code };
    }
    if (entry.level === "Prov" || entry.level === "Dist") {
      return { level: "province", field: "province_code", code: entry.province_code ?? psgc_code };
    }
    return { level: "municipality", field: "psgc_muni_code", code: psgc_code };
  }
  // Fallback to trailing-zero detection
  if (psgc_code.endsWith("00000000")) {
    return { level: "region", field: "region_code", code: psgc_code };
  }
  if (psgc_code.endsWith("000000")) {
    return { level: "province", field: "province_code", code: psgc_code };
  }
  return { level: "municipality", field: "psgc_muni_code", code: psgc_code };
}

export function getPopulation(pop: PopulationLookup, code: string): { name: string; population: number } | null {
  const direct = pop[code];
  if (direct) {
    return { name: direct.name, population: direct.population };
  }

  const level = detectPsgcLevel(code);
  if (level === "province") {
    const children = Object.values(pop).filter(
      (e) => e.province_code === code && (e.level === "City" || e.level === "Mun" || e.level === "SubMun")
    );
    if (children.length > 0) {
      const total = children.reduce((sum, e) => sum + e.population, 0);
      return { name: `Province ${code}`, population: total };
    }
  }

  return null;
}
