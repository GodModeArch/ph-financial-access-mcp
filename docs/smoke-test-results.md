# Smoke Test Results

## Latest Run: 2026-03-16 (v1.0.0)

**Endpoint:** `https://ph-financial-access.godmode.ph`
**Branch:** `main`
**Protocol:** MCP over Streamable HTTP (JSON-RPC 2.0, protocol version `2025-03-26`)

### Root Endpoint

```
GET https://ph-financial-access.godmode.ph/
```

**Response (200 OK):**
```json
{
  "name": "ph-financial-access-mcp",
  "version": "1.0.0",
  "description": "Philippine financial access data from BSP. 587 supervised institutions across 7 categories, 37,834 financial access points (bank offices, ATMs, NSSLAs), and coverage analytics with PSGC and 2024 Census population data.",
  "mcp_endpoint": "/mcp",
  "tools": [
    "search_institutions",
    "get_institution",
    "list_institutions",
    "get_institution_stats",
    "search_access_points",
    "get_access_point",
    "get_coverage",
    "find_unbanked_areas",
    "find_underserved_areas",
    "get_institution_footprint",
    "compare_coverage"
  ],
  "source": "Bangko Sentral ng Pilipinas (BSP)"
}
```

**Result:** PASS -- 11 tools listed, correct names.

---

### MCP Endpoint (Protocol Check)

```
GET https://ph-financial-access.godmode.ph/mcp
```

**Response:** 406 Not Acceptable

**Result:** PASS -- correctly rejects non-MCP HTTP requests.

---

### MCP Initialize

```
POST /mcp
{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}
```

**Response (200 OK, SSE):**
```json
{"result":{"protocolVersion":"2025-03-26","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"ph-financial-access-mcp","version":"1.0.0"}},"jsonrpc":"2.0","id":0}
```

**Result:** PASS -- session established, `mcp-session-id` header returned.

---

### Tool Tests (11/11 PASS)

All tools called via `tools/call` over the same MCP session.

#### search_institutions
```json
// Params: {"query":"BDO"}
// Pagination: total=6
{
  "first_result": {
    "institution_code": "166107",
    "registration_name": "BDO Capital & Investment Corporation",
    "bank_type": "non_bank_fi",
    "status": "active"
  }
}
```

#### get_institution
```json
// Params: {"institution_code":"165713"}
{
  "institution_code": "165713",
  "registration_name": "Banco Cooperativa De Zamboanga",
  "bank_type": "cooperative",
  "status": "active",
  "head_office_address": "Sta Cruz Commercial Complex Bus Terminal, Camino Nuevo, Zamboanga City"
}
```

#### list_institutions
```json
// Params: {"institution_type":"digital"}
// Pagination: total=6
{
  "banks": [
    "GoTyme Bank Corporation",
    "Maya Bank, Inc.",
    "Overseas Filipino Bank, Inc., A Digital Bank of LANDBANK",
    "Tonik Digital Bank, Inc.",
    "UnionDigital Bank, Inc.",
    "UNObank, Inc."
  ]
}
```

#### get_institution_stats
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

#### search_access_points
```json
// Params: {"query":"BDO","industry":"ATM ONLY"}
// Pagination: total=2282
{
  "first_result": {
    "id": "17135",
    "institution_name": "BDO UNIBANK INC",
    "branch_name": "SM MEGA B",
    "town": "MANDALUYONG CITY",
    "has_atm": true
  }
}
```

#### get_access_point
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

#### get_coverage
```json
// Params: {"psgc_code":"1300000000"}
{
  "psgc_code": "1300000000",
  "area_name": "National Capital Region (NCR)",
  "area_level": "Region",
  "population": 14001751,
  "total_access_points": 11826,
  "by_industry": {"BANK": 8330, "NSSLA": 58, "ATM ONLY": 3438},
  "unique_institutions": 2966,
  "with_atm": 8076,
  "population_per_access_point": 1184
}
```

#### find_unbanked_areas
```json
// Params: {"region_code":"1900000000","limit":3}
{
  "unbanked_municipalities": [
    {"psgc_code": "1900705000", "area_name": "Sumisip", "population": 55778},
    {"psgc_code": "1907001000", "area_name": "Panglima Sugala", "population": 52657},
    {"psgc_code": "1903611000", "area_name": "Lumba-Bayabao", "population": 50959}
  ]
}
```

#### find_underserved_areas
```json
// Params: {"level":"province","limit":3}
{
  "areas": [
    {"psgc_code": "1900700000", "area_name": "Basilan", "population": 541947, "access_point_count": 8, "population_per_access_point": 67743},
    {"psgc_code": "0906600000", "area_name": "Sulu", "population": 1146097, "access_point_count": 18, "population_per_access_point": 63672},
    {"psgc_code": "1907000000", "area_name": "Tawi-Tawi", "population": 482645, "access_point_count": 9, "population_per_access_point": 53627}
  ]
}
```

#### get_institution_footprint
```json
// Params: {"institution_name":"BDO"}
{
  "institution_name": "BDO UNIBANK INC",
  "total_access_points": 7479,
  "top_regions": {
    "NATIONAL CAPITAL REGION": 2783,
    "CALABARZON": 1260,
    "CENTRAL LUZON": 782,
    "CENTRAL VISAYAS": 442,
    "WESTERN VISAYAS": 396
  }
}
```

#### compare_coverage
```json
// Params: {"psgc_code_a":"1300000000","psgc_code_b":"1900000000"}
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

---

### Unit Tests

```
npm test
```

```
 ✓ test/data.test.ts (19 tests) 10ms
 ✓ test/access-point-data.test.ts (30 tests) 22ms

 Test Files  2 passed (2)
      Tests  49 passed (49)
   Duration  390ms
```

**Result:** PASS -- 49/49 tests passed.

---

## Summary

| Check | Result |
|---|---|
| Root endpoint (GET /) | PASS |
| MCP rejection (GET /mcp) | PASS |
| MCP initialize (POST /mcp) | PASS |
| search_institutions | PASS |
| get_institution | PASS |
| list_institutions | PASS |
| get_institution_stats | PASS |
| search_access_points | PASS |
| get_access_point | PASS |
| get_coverage | PASS |
| find_unbanked_areas | PASS |
| find_underserved_areas | PASS |
| get_institution_footprint | PASS |
| compare_coverage | PASS |
| Unit tests (49/49) | PASS |
| **Total** | **15/15 PASS** |
