# Smoke Test Results

> **Note:** Results below are from a pre-release run with old tool names (`search_banks`, `search_branches`, etc.). Re-run smoke tests after deploying.

## Latest Run: 2026-03-16 (pre-release)

**Endpoint:** `https://ph-financial-access.godmode.ph`
**Branch:** `main`

### Root Endpoint

```
GET https://ph-financial-access.godmode.ph/
```

**Response (200 OK):**
```json
{
  "name": "ph-financial-access-mcp",
  "version": "1.0.0",
  "description": "Philippine financial access data from BSP — 587 supervised institutions across 7 categories, 37,834 branch and ATM locations, and financial inclusion analytics with PSGC support",
  "mcp_endpoint": "/mcp",
  "tools": [
    "search_banks",
    "get_bank",
    "list_banks_by_type",
    "list_banks_by_location",
    "get_bank_stats",
    "get_banking_density",
    "find_underbanked_areas",
    "search_branches",
    "get_branch",
    "get_coverage",
    "find_unbanked_areas",
    "find_underserved_areas",
    "get_institution_footprint",
    "compare_coverage"
  ],
  "source": "Bangko Sentral ng Pilipinas (BSP)"
}
```

**Result:** PASS -- name, version, description, and all 14 tools returned correctly.

---

### MCP Endpoint (Protocol Check)

```
GET https://ph-financial-access.godmode.ph/mcp
```

**Response:** 406 Not Acceptable

**Result:** PASS -- correctly rejects non-MCP HTTP requests.

---

### Unit Tests

```
npm test
```

**Output:**
```
 ✓ test/data.test.ts (28 tests) 25ms
 ✓ test/branch-data.test.ts (30 tests) 41ms

 Test Files  2 passed (2)
      Tests  58 passed (58)
   Duration  727ms
```

**Result:** PASS -- 58/58 tests passed.

---

## Previous Run: 2026-03-13

**Endpoint:** `https://ph-financial.godmode.ph` (old domain)

14 tools, 1 call each. All passed. Full results preserved below for reference.

### search_banks
```json
// Params: {"query":"BDO"}
{
  "total": 6,
  "first_3": [
    {"code": "166107", "name": "BDO Capital & Investment Corporation", "type": "non_bank_fi"},
    {"code": "166102", "name": "BDO Finance Corporation", "type": "non_bank_fi"},
    {"code": "165698", "name": "BDO Network Bank, Inc.", "type": "thrift"}
  ]
}
```

### get_bank
```json
// Params: {"institution_code":"165713"}
{
  "code": "165713",
  "name": "Banco Cooperativa De Zamboanga",
  "type": "cooperative",
  "status": "active"
}
```

### list_banks_by_type
```json
// Params: {"bank_type":"digital"}
{
  "total": 6,
  "banks": [
    {"code": "166076", "name": "GoTyme Bank Corporation"},
    {"code": "166073", "name": "Maya Bank, Inc."},
    {"code": "166071", "name": "Overseas Filipino Bank, Inc., A Digital Bank of LANDBANK"},
    {"code": "166072", "name": "Tonik Digital Bank, Inc."},
    {"code": "166075", "name": "UnionDigital Bank, Inc."},
    {"code": "166074", "name": "UNObank, Inc."}
  ]
}
```

### list_banks_by_location
```json
// Params: {"psgc_code":"1300000000 (NCR)"}
{
  "total": 201,
  "first_5": [
    "Network Consolidated Cooperative Bank",
    "One Cooperative Bank",
    "GoTyme Bank Corporation",
    "Maya Bank, Inc.",
    "Overseas Filipino Bank, Inc., A Digital Bank of LANDBANK"
  ]
}
```

### get_bank_stats
```json
// Params: {}
{
  "total": 587,
  "total_active": 587,
  "total_inactive": 0,
  "by_type": {
    "cooperative": 21,
    "digital": 6,
    "non_bank_fi": 109,
    "quasi_bank": 5,
    "rural": 351,
    "thrift": 42,
    "universal_commercial": 53
  }
}
```

### get_banking_density
```json
// Params: {"psgc_code":"1300000000 (NCR)"}
{
  "psgc_code": "1300000000",
  "area_name": "National Capital Region (NCR)",
  "population": 14001751,
  "bank_count": 201,
  "population_per_bank": 69660
}
```

### find_underbanked_areas
```json
// Params: {"level":"region","limit":5}
[
  {"psgc_code": "1900000000", "area_name": "Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)", "population": 4545486, "bank_count": 0, "population_per_bank": 4545486},
  {"psgc_code": "1200000000", "area_name": "Region XII (SOCCSKSARGEN)", "population": 4462776, "bank_count": 6, "population_per_bank": 743796},
  {"psgc_code": "1600000000", "area_name": "Region XIII (Caraga)", "population": 2865196, "bank_count": 5, "population_per_bank": 573039},
  {"psgc_code": "1100000000", "area_name": "Region XI (Davao Region)", "population": 5389422, "bank_count": 10, "population_per_bank": 538942},
  {"psgc_code": "0800000000", "area_name": "Region VIII (Eastern Visayas)", "population": 4625929, "bank_count": 9, "population_per_bank": 513992}
]
```

### search_branches
```json
// Params: {"query":"BDO","industry":"ATM ONLY"}
{
  "total": 2282,
  "first_3": [
    {"id": "17135", "institution": "BDO UNIBANK INC", "branch": "SM MEGA B", "town": "MANDALUYONG CITY"},
    {"id": "17136", "institution": "BDO UNIBANK INC", "branch": "SM CUBAO", "town": "QUEZON CITY"},
    {"id": "17137", "institution": "BDO UNIBANK INC", "branch": "SM QUIAPO", "town": "QUIAPO (CITY DIST.)"}
  ]
}
```

### get_branch
```json
// Params: {"id":"1"}
{
  "id": "1",
  "institution_name": "CTBC BANK (PHILIPPINES) CORP",
  "branch_name": "HEAD OFFICE",
  "industry": "BANK",
  "town": "TAGUIG CITY",
  "latitude": 14.5539393,
  "longitude": 121.0468744
}
```

### get_coverage
```json
// Params: {"psgc_code":"1300000000 (NCR)"}
{
  "psgc_code": "1300000000",
  "area_name": "National Capital Region (NCR)",
  "population": 14001751,
  "total_access_points": 11826,
  "bank_branches": 8330,
  "atm_only": 3438,
  "nssla": 58,
  "population_per_access_point": 1184
}
```

### find_unbanked_areas
```json
// Params: {"region_code":"1900000000 (BARMM)","limit":10}
{
  "total": 10,
  "areas": [
    {"psgc_code": "1900705000", "area_name": "Sumisip", "population": 55778},
    {"psgc_code": "1907001000", "area_name": "Panglima Sugala", "population": 52657},
    {"psgc_code": "1903611000", "area_name": "Lumba-Bayabao", "population": 50959},
    {"psgc_code": "1908822000", "area_name": "South Upi", "population": 50018},
    {"psgc_code": "1908816000", "area_name": "Pagalungan", "population": 49326}
  ]
}
```

### find_underserved_areas
```json
// Params: {"level":"province","limit":5}
[
  {"psgc_code": "1900700000", "area_name": "Basilan", "population": 541947, "access_point_count": 8, "population_per_access_point": 67743},
  {"psgc_code": "0906600000", "area_name": "Sulu", "population": 1146097, "access_point_count": 18, "population_per_access_point": 63672},
  {"psgc_code": "1907000000", "area_name": "Tawi-Tawi", "population": 482645, "access_point_count": 9, "population_per_access_point": 53627},
  {"psgc_code": "1903600000", "area_name": "Lanao del Sur", "population": 1368137, "access_point_count": 38, "population_per_access_point": 36004},
  {"psgc_code": "1208000000", "area_name": "Sarangani", "population": 580915, "access_point_count": 53, "population_per_access_point": 10961}
]
```

### get_institution_footprint
```json
// Params: {"institution_name":"LANDBANK"}
{
  "institution_name": "OVERSEAS FILIPINO BANK INC A DIGITAL BANK OF LANDBANK",
  "total_branches": 1,
  "by_region": {"NATIONAL CAPITAL REGION": 1},
  "with_atm": 0
}
```

### compare_coverage
```json
// Params: {"psgc_code_a":"1300000000 (NCR)","psgc_code_b":"1900000000 (BARMM)"}
{
  "area_a": {
    "area_name": "National Capital Region (NCR)",
    "population": 14001751,
    "total_access_points": 11826,
    "population_per_access_point": 1184
  },
  "area_b": {
    "area_name": "Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)",
    "population": 4545486,
    "total_access_points": 158,
    "population_per_access_point": 28769
  }
}
```
