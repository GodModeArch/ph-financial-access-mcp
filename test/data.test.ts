import { describe, it, expect } from "vitest";
import {
  searchInstitutions,
  getInstitutionByCode,
  listInstitutions,
  getInstitutionStats,
} from "../src/data.js";
import type { Institution, PopulationLookup } from "../src/types.js";

const MOCK_INSTITUTIONS: Institution[] = [
  {
    institution_code: "101",
    registration_name: "BDO Unibank Inc.",
    trade_name: "BDO",
    bank_type: "universal_commercial",
    bsp_type_id: "1",
    bsp_type_id2: "2",
    bsp_type_id3: "3",
    status: "active",
    head_office_address: "7899 Makati Avenue, Makati City",
    psgc_muni_code: "1376001000",
    region_code: "1300000000",
    province_code: "1376000000",
    date_sourced: "2026-03-12",
    source_document: "bsp-sharepoint-api",
  },
  {
    institution_code: "202",
    registration_name: "Bank of the Philippine Islands",
    trade_name: "BPI",
    bank_type: "universal_commercial",
    bsp_type_id: "1",
    bsp_type_id2: "2",
    bsp_type_id3: "3",
    status: "active",
    head_office_address: "Ayala Avenue, Makati City",
    psgc_muni_code: "1376001000",
    region_code: "1300000000",
    province_code: "1376000000",
    date_sourced: "2026-03-12",
    source_document: "bsp-sharepoint-api",
  },
  {
    institution_code: "303",
    registration_name: "Tonik Digital Bank Inc.",
    bank_type: "digital",
    bsp_type_id: "14",
    bsp_type_id2: "14",
    bsp_type_id3: "14",
    status: "active",
    head_office_address: "Taguig City",
    psgc_muni_code: "1376300000",
    region_code: "1300000000",
    province_code: "1376000000",
    date_sourced: "2026-03-12",
    source_document: "bsp-sharepoint-api",
  },
  {
    institution_code: "404",
    registration_name: "Rural Bank of Closed Town",
    bank_type: "rural",
    bsp_type_id: "11",
    bsp_type_id2: "12",
    bsp_type_id3: "12",
    status: "closed",
    head_office_address: "Some Province",
    psgc_muni_code: "0400100000",
    region_code: "0400000000",
    province_code: "0400100000",
    date_sourced: "2026-03-12",
    source_document: "bsp-sharepoint-api",
  },
];

const MOCK_POPULATION: PopulationLookup = {
  "1300000000": {
    name: "National Capital Region (NCR)",
    level: "Reg",
    population: 14001751,
    region_code: "1300000000",
    province_code: null,
  },
  "1376001000": {
    name: "City of Makati",
    level: "City",
    population: 309770,
    region_code: "1300000000",
    province_code: "1376000000",
  },
  "1376300000": {
    name: "City of Taguig",
    level: "City",
    population: 966940,
    region_code: "1300000000",
    province_code: "1376000000",
  },
  "0400000000": {
    name: "CALABARZON",
    level: "Reg",
    population: 16195042,
    region_code: "0400000000",
    province_code: null,
  },
  "0400100000": {
    name: "Batangas",
    level: "Prov",
    population: 2908945,
    region_code: "0400000000",
    province_code: "0400100000",
  },
};

describe("searchInstitutions", () => {
  it("finds institutions by partial name match", () => {
    const results = searchInstitutions(MOCK_INSTITUTIONS, { query: "BDO" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].registration_name).toContain("BDO");
  });

  it("finds institutions by trade name", () => {
    const results = searchInstitutions(MOCK_INSTITUTIONS, { query: "BPI" });
    expect(results.length).toBe(1);
    expect(results[0].registration_name).toContain("Philippine Islands");
  });

  it("filters by institution_type", () => {
    const results = searchInstitutions(MOCK_INSTITUTIONS, { query: "Bank", institution_type: "digital" });
    expect(results.length).toBe(1);
    expect(results[0].bank_type).toBe("digital");
  });

  it("defaults to active institutions only", () => {
    const results = searchInstitutions(MOCK_INSTITUTIONS, { query: "Rural Bank" });
    expect(results.length).toBe(0);
  });

  it("can include non-active institutions with status filter", () => {
    const results = searchInstitutions(MOCK_INSTITUTIONS, { query: "Rural Bank", status: "closed" });
    expect(results.length).toBe(1);
  });

  it("scores exact matches higher than substring matches", () => {
    const results = searchInstitutions(MOCK_INSTITUTIONS, { query: "BDO Unibank" });
    expect(results[0].institution_code).toBe("101");
  });

  it("returns empty array for empty or special-character queries", () => {
    expect(searchInstitutions(MOCK_INSTITUTIONS, { query: "" })).toEqual([]);
    expect(searchInstitutions(MOCK_INSTITUTIONS, { query: "!!@#$" })).toEqual([]);
    expect(searchInstitutions(MOCK_INSTITUTIONS, { query: "   " })).toEqual([]);
  });
});

describe("getInstitutionByCode", () => {
  it("returns institution by code", () => {
    const inst = getInstitutionByCode(MOCK_INSTITUTIONS, "101");
    expect(inst).toBeDefined();
    expect(inst!.registration_name).toBe("BDO Unibank Inc.");
  });

  it("returns undefined for unknown code", () => {
    expect(getInstitutionByCode(MOCK_INSTITUTIONS, "999")).toBeUndefined();
  });
});

describe("listInstitutions", () => {
  it("lists all active institutions by type", () => {
    const results = listInstitutions(MOCK_INSTITUTIONS, MOCK_POPULATION, {
      institution_type: "universal_commercial",
    });
    expect(results.length).toBe(2);
  });

  it("filters by status", () => {
    const results = listInstitutions(MOCK_INSTITUTIONS, MOCK_POPULATION, {
      institution_type: "rural",
      status: "closed",
    });
    expect(results.length).toBe(1);
  });

  it("lists by PSGC province code", () => {
    const results = listInstitutions(MOCK_INSTITUTIONS, MOCK_POPULATION, {
      psgc_code: "1376000000",
    });
    expect(results.length).toBe(3);
  });

  it("lists by municipality PSGC code", () => {
    const results = listInstitutions(MOCK_INSTITUTIONS, MOCK_POPULATION, {
      psgc_code: "1376300000",
    });
    expect(results.length).toBe(1);
  });

  it("lists by region code", () => {
    const results = listInstitutions(MOCK_INSTITUTIONS, MOCK_POPULATION, {
      psgc_code: "1300000000",
    });
    expect(results.length).toBe(3);
  });

  it("combines type and location filters", () => {
    const results = listInstitutions(MOCK_INSTITUTIONS, MOCK_POPULATION, {
      psgc_code: "1300000000",
      institution_type: "digital",
    });
    expect(results.length).toBe(1);
  });

  it("resolves province entity code via population lookup", () => {
    const results = listInstitutions(MOCK_INSTITUTIONS, MOCK_POPULATION, {
      psgc_code: "0400100000",
      status: "closed",
    });
    expect(results.length).toBe(1);
    expect(results[0].institution_code).toBe("404");
  });
});

describe("getInstitutionStats", () => {
  it("returns counts by type", () => {
    const stats = getInstitutionStats(MOCK_INSTITUTIONS);
    expect(stats.by_type.universal_commercial).toBe(2);
    expect(stats.by_type.digital).toBe(1);
    expect(stats.by_type.rural).toBe(1);
  });

  it("returns active vs inactive counts", () => {
    const stats = getInstitutionStats(MOCK_INSTITUTIONS);
    expect(stats.total_active).toBe(3);
    expect(stats.total_inactive).toBe(1);
  });

  it("returns total count", () => {
    const stats = getInstitutionStats(MOCK_INSTITUTIONS);
    expect(stats.total).toBe(4);
  });
});
