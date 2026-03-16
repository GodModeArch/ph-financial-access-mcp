import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Institution, AccessPoint, PopulationLookup } from "./types.js";
import { registerTools } from "./tools.js";

// Static imports - bundled into the worker at build time
import institutionsData from "../data/banks.json";
import accessPointsData from "../data/branches.json";
import populationData from "../data/population.json";

const institutions = institutionsData as unknown as Institution[];
const accessPoints = accessPointsData as unknown as AccessPoint[];
const population = populationData as unknown as PopulationLookup;

export class BSPBanksMCP extends McpAgent {
  server = new McpServer({
    name: "ph-financial-access-mcp",
    version: "1.0.0",
  });

  async init() {
    registerTools(this.server, institutions, accessPoints, population, this.env);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return BSPBanksMCP.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(
        JSON.stringify({
          name: "ph-financial-access-mcp",
          version: "1.0.0",
          description: "Philippine financial access data from BSP. 587 supervised institutions across 7 categories, 37,834 financial access points (bank offices, ATMs, NSSLAs), and coverage analytics with PSGC and 2024 Census population data.",
          mcp_endpoint: "/mcp",
          tools: [
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
            "compare_coverage",
          ],
          source: "Bangko Sentral ng Pilipinas (BSP)",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
