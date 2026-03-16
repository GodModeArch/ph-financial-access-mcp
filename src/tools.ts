import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Institution, AccessPoint, PopulationLookup } from "./types.js";
import {
  searchInstitutions,
  getInstitutionByCode,
  listInstitutions,
  getInstitutionStats,
} from "./data.js";
import {
  searchAccessPoints,
  buildAccessPointIndex,
  getAccessPointById,
  getCoverage,
  findUnbankedAreas,
  findUnderservedAreas,
  getInstitutionFootprint,
  compareCoverage,
} from "./access-point-data.js";
import { buildMeta, buildDensityMeta, toolResult, toolPaginatedResult, toolError } from "./response.js";

const InstitutionTypeSchema = z.enum([
  "universal_commercial",
  "thrift",
  "rural",
  "cooperative",
  "digital",
  "emi_bank",
  "emi_nonbank",
  "quasi_bank",
  "non_bank_fi",
]);

const StatusSchema = z.enum(["active", "closed", "under_receivership", "merged"]);

export function registerTools(
  server: McpServer,
  institutions: Institution[],
  accessPoints: AccessPoint[],
  pop: PopulationLookup,
  env: Cloudflare.Env
) {
  const meta = buildMeta(env);
  const coverageMeta = buildDensityMeta(env);
  const accessPointIndex = buildAccessPointIndex(accessPoints);

  // --- Institution tools ---

  server.tool(
    "search_institutions",
    "Search BSP-supervised institutions by name. Fuzzy matches against registration name and trade name. Returns active institutions by default.",
    {
      query: z.string().min(1).describe("Institution name to search for, e.g. 'BDO' or 'Rural Bank of Sagay'"),
      institution_type: InstitutionTypeSchema.optional().describe("Filter by institution type"),
      status: StatusSchema.optional().describe("Filter by status. Default: 'active'"),
      limit: z.number().min(1).max(100).optional().describe("Max results to return. Default: 20"),
      offset: z.number().min(0).optional().describe("Results offset for pagination. Default: 0"),
    },
    async ({ query, institution_type, status, limit = 20, offset = 0 }) => {
      const results = searchInstitutions(institutions, { query, institution_type, status });
      const page = results.slice(offset, offset + limit);

      return toolPaginatedResult(page, meta, {
        total: results.length,
        offset,
        limit,
        has_more: offset + limit < results.length,
      });
    }
  );

  server.tool(
    "get_institution",
    "Look up a specific BSP-supervised institution by its institution code (BSP SharePoint ID). Codes are stable across ETL runs.",
    {
      institution_code: z.string().describe("Institution code (BSP SharePoint ID), e.g. '123'"),
    },
    async ({ institution_code }) => {
      const inst = getInstitutionByCode(institutions, institution_code);
      if (!inst) {
        return toolError(`Institution not found with code: ${institution_code}`);
      }
      return toolResult(inst, meta);
    }
  );

  server.tool(
    "list_institutions",
    "List BSP-supervised institutions with optional filters. Filter by institution type (universal_commercial, thrift, rural, cooperative, digital, etc.), PSGC location code, and status. Returns active institutions by default.",
    {
      institution_type: InstitutionTypeSchema.optional().describe("Filter by institution type"),
      psgc_code: z.string().length(10).optional().describe("10-digit PSGC code: region, province, or municipality. Use the psgc-mcp server to look up codes."),
      status: StatusSchema.optional().describe("Filter by status. Default: 'active'"),
      limit: z.number().min(1).max(100).optional().describe("Max results. Default: 50"),
      offset: z.number().min(0).optional().describe("Pagination offset. Default: 0"),
    },
    async ({ institution_type, psgc_code, status, limit = 50, offset = 0 }) => {
      const results = listInstitutions(institutions, pop, { institution_type, psgc_code, status });
      const page = results.slice(offset, offset + limit);

      return toolPaginatedResult(page, meta, {
        total: results.length,
        offset,
        limit,
        has_more: offset + limit < results.length,
      });
    }
  );

  server.tool(
    "get_institution_stats",
    "Get summary statistics of BSP-supervised institutions: counts by type, region, and status.",
    {},
    async () => {
      const stats = getInstitutionStats(institutions);
      return toolResult(stats, meta);
    }
  );

  // --- Access point tools ---

  server.tool(
    "search_access_points",
    "Search BSP-registered financial service access points (bank offices, ATMs, NSSLAs) by institution or location name. Each record represents a single access point. A physical office with multiple ATMs may appear as multiple records. Filterable by region, province, town, industry, and ATM availability.",
    {
      query: z.string().min(1).describe("Institution or location name to search, e.g. 'BDO' or 'Metrobank Makati'"),
      region: z.string().optional().describe("Filter by region name, e.g. 'NATIONAL CAPITAL REGION'"),
      province: z.string().optional().describe("Filter by province name"),
      town: z.string().optional().describe("Filter by town/city name"),
      industry: z.string().optional().describe("Filter by industry: 'BANK', 'NSSLA', or 'ATM ONLY'"),
      has_atm: z.boolean().optional().describe("Filter access points with ATM"),
      limit: z.number().min(1).max(100).optional().describe("Max results. Default: 20"),
      offset: z.number().min(0).optional().describe("Pagination offset. Default: 0"),
    },
    async ({ query, region, province, town, industry, has_atm, limit = 20, offset = 0 }) => {
      const results = searchAccessPoints(accessPoints, {
        query,
        region,
        province,
        town,
        industry,
        has_atm,
      });
      const page = results.slice(offset, offset + limit);

      return toolPaginatedResult(page, coverageMeta, {
        total: results.length,
        offset,
        limit,
        has_more: offset + limit < results.length,
      });
    }
  );

  server.tool(
    "get_access_point",
    "Look up a specific financial access point by its ID.",
    {
      id: z.string().describe("Access point ID"),
    },
    async ({ id }) => {
      const ap = getAccessPointById(accessPointIndex, id);
      if (!ap) {
        return toolError(`Access point not found with ID: ${id}`);
      }
      return toolResult(ap, coverageMeta);
    }
  );

  // --- Coverage analysis tools ---

  server.tool(
    "get_coverage",
    "Get financial access coverage for a PSGC area. Counts access points by industry (BANK, ATM ONLY, NSSLA), unique institutions, and ATM availability. Cross-references with 2024 Census population for population-per-access-point ratio.",
    {
      psgc_code: z.string().length(10).describe("10-digit PSGC code: region, province, or municipality"),
      industry: z.string().optional().describe("Filter by industry: 'BANK', 'NSSLA', or 'ATM ONLY'"),
    },
    async ({ psgc_code, industry }) => {
      const result = getCoverage(accessPoints, pop, { psgc_code, industry });
      if (!result) {
        return toolError(`No population data found for PSGC code: ${psgc_code}. Use the psgc-mcp server to look up valid codes.`);
      }
      return toolResult(result, coverageMeta);
    }
  );

  server.tool(
    "find_unbanked_areas",
    "Find municipalities with zero BSP-registered financial access points. Cross-references all municipalities in population data against access points with PSGC codes. Returns unserved municipalities sorted by population (largest unserved first).",
    {
      region_code: z.string().length(10).optional().describe("10-digit PSGC region code to scope the search"),
      limit: z.number().min(1).max(200).optional().describe("Max results. Default: 50"),
    },
    async ({ region_code, limit }) => {
      const results = findUnbankedAreas(accessPoints, pop, { region_code, limit });
      return toolResult({
        unbanked_municipalities: results,
        data_notes: [
          "Municipalities with zero BSP-registered financial access points based on PSGC code matching.",
          "Access points without PSGC codes are excluded, so results may overcount unbanked areas.",
          "Population: 2024 Census of Population (PSA).",
        ],
      }, coverageMeta);
    }
  );

  server.tool(
    "find_underserved_areas",
    "Rank regions or provinces by population-per-access-point ratio (most underserved first). Higher ratio means fewer financial access points relative to population.",
    {
      level: z.enum(["region", "province"]).describe("Geographic level: 'region' or 'province'"),
      industry: z.string().optional().describe("Filter by industry: 'BANK', 'NSSLA', or 'ATM ONLY'"),
      limit: z.number().min(1).max(50).optional().describe("Max results. Default: 20"),
    },
    async ({ level, industry, limit }) => {
      const results = findUnderservedAreas(accessPoints, pop, { level, industry, limit });
      return toolResult({
        areas: results,
        data_notes: [
          "Population: 2024 Census of Population (PSA).",
          "Access point counts use PSGC codes. Access points without codes are excluded.",
          "Higher population_per_access_point = fewer access points relative to population (more underserved).",
          "Each BSP-registered access point is counted individually. A physical office with multiple ATMs appears as multiple access points.",
        ],
      }, coverageMeta);
    }
  );

  server.tool(
    "get_institution_footprint",
    "Map a financial institution's nationwide access point distribution. Shows total access points, distribution by region and province, ATM count, and industry breakdown (BANK, ATM ONLY, NSSLA). Uses fuzzy matching on institution name.",
    {
      institution_name: z.string().min(1).describe("Institution name to search, e.g. 'BDO' or 'METROBANK'"),
    },
    async ({ institution_name }) => {
      const result = getInstitutionFootprint(accessPoints, { institution_name });
      if (!result) {
        return toolError(`No access points found matching institution name: ${institution_name}`);
      }
      return toolResult(result, coverageMeta);
    }
  );

  server.tool(
    "compare_coverage",
    "Compare financial access coverage between two PSGC areas. Returns side-by-side access point counts, industry breakdowns, and population ratios.",
    {
      psgc_code_a: z.string().length(10).describe("10-digit PSGC code for the first area"),
      psgc_code_b: z.string().length(10).describe("10-digit PSGC code for the second area"),
    },
    async ({ psgc_code_a, psgc_code_b }) => {
      const result = compareCoverage(accessPoints, pop, { psgc_code_a, psgc_code_b });
      if (!result) {
        const coverageA = getCoverage(accessPoints, pop, { psgc_code: psgc_code_a });
        if (!coverageA) {
          return toolError(`No population data found for PSGC code: ${psgc_code_a}. Use the psgc-mcp server to look up valid codes.`);
        }
        return toolError(`No population data found for PSGC code: ${psgc_code_b}. Use the psgc-mcp server to look up valid codes.`);
      }
      return toolResult(result, coverageMeta);
    }
  );
}
