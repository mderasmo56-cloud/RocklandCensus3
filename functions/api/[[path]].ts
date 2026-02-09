// Cloudflare Pages Function / Worker to mirror the Python FastAPI backend.
// Endpoints:
// - GET /api/health
// - GET /api/zip-data?zips=10901,10952
// - POST /api/ai-report { zips?: string[], user_prompt?: string, temperature?: number }

export interface Env {
  CENSUS_API_KEY: string;
  OPENAI_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

type RecordMap = Record<string, any>;

const BASE_URL = "https://api.census.gov/data/2021/acs/acs5";
const BASE_URL_SUBJECT = "https://api.census.gov/data/2021/acs/acs5/subject";
const BASE_URL_2020_DHC = "https://api.census.gov/data/2020/dec/dhc";
const DEFAULT_TEMPERATURE = 0.85;

const ROCKLAND_ZIPS_TOWNS: Record<string, string> = {
  "10901": "Airmont, Suffern",
  "10913": "Blauvelt",
  "10920": "Congers",
  "10923": "Garnerville",
  "10927": "Haverstraw",
  "10931": "Hillburn",
  "10952": "Monsey",
  "10956": "New City",
  "10960": "Nyack, Grand View-on-Hudson",
  "10962": "Orangeburg",
  "10964": "Palisades",
  "10965": "Pearl River",
  "10968": "Piermont",
  "10970": "Pomona",
  "10974": "Sloatsburg",
  "10976": "Sparkill",
  "10977": "Spring Valley, Chestnut Ridge",
  "10980": "Stony Point",
  "10983": "Tappan",
  "10986": "Tomkins Cove",
  "10989": "Valley Cottage",
  "10993": "West Haverstraw",
  "10994": "West Nyack",
};

const incomeVars: Record<string, string> = {
  B19013_001E: "MedianIncome",
  B19001_002E: "Income_Less_Than_10K",
  B19001_003E: "Income_10K_14K",
  B19001_004E: "Income_15K_24K",
  B19001_005E: "Income_25K_34K",
  B19001_006E: "Income_35K_49K",
  B19001_007E: "Income_50K_74K",
  B19001_008E: "Income_75K_99K",
  B19001_009E: "Income_100K_149K",
  B19001_010E: "Income_150K_199K",
  B19001_011E: "Income_200K_Plus",
};

const occupationVars: Record<string, string> = {
  S2401_C01_001E: "CivEmp16Over",
  S2401_C01_002E: "MgmtBusSciArts",
  S2401_C01_003E: "MgmtBusFin",
  S2401_C01_004E: "MgmtOccupations",
  S2401_C01_005E: "BusinessFinOps",
  S2401_C01_006E: "CompEngSci",
  S2401_C01_007E: "ComputerMath",
  S2401_C01_008E: "ArchitectureEng",
  S2401_C01_009E: "LifePhysSci",
  S2401_C01_010E: "EducLegalCommArtsMedia",
  S2401_C01_011E: "CommunitySocService",
  S2401_C01_012E: "Legal",
  S2401_C01_013E: "EduInstructionLibrary",
  S2401_C01_014E: "ArtsDesignEntertainmentSportsMedia",
  S2401_C01_015E: "HealthcarePracTech",
  S2401_C01_016E: "HealthDiagTreat",
  S2401_C01_017E: "HealthTechs",
  S2401_C01_018E: "ServiceOcc",
  S2401_C01_019E: "HealthcareSupport",
  S2401_C01_020E: "ProtectiveService",
  S2401_C01_021E: "FirefightingPreventionEtc",
  S2401_C01_022E: "LawEnforcementEtc",
  S2401_C01_023E: "FoodPrepServing",
  S2401_C01_024E: "BuildingGroundsMaint",
  S2401_C01_025E: "PersonalCareService",
  S2401_C01_026E: "SalesOfficeOcc",
  S2401_C01_027E: "SalesRelated",
  S2401_C01_028E: "OfficeAdminSupport",
  S2401_C01_029E: "NatResConstMaint",
  S2401_C01_030E: "FarmFishForestry",
  S2401_C01_031E: "ConstructionExtraction",
  S2401_C01_032E: "InstallMaintRepair",
  S2401_C01_033E: "ProdTransMoving",
  S2401_C01_034E: "Production",
  S2401_C01_035E: "Transportation",
  S2401_C01_036E: "MaterialMoving",
};

const p8Labels: Record<string, string> = {
  P8_001N: "Total",
  P8_002N: "Population of one race",
  P8_003N: "White alone",
  P8_004N: "Black or African American alone",
  P8_005N: "American Indian and Alaska Native alone",
  P8_006N: "Asian alone",
  P8_007N: "Native Hawaiian and Other Pacific Islander alone",
  P8_008N: "Some Other Race alone",
  P8_009N: "Population of two or more races",
  P8_010N: "Population of two races",
  P8_011N: "White; Black or African American",
  P8_012N: "White; American Indian and Alaska Native",
  P8_013N: "White; Asian",
  P8_014N: "White; Native Hawaiian and Other Pacific Islander",
  P8_015N: "White; Some Other Race",
  P8_016N: "Black or African American; American Indian and Alaska Native",
  P8_017N: "Black or African American; Asian",
  P8_018N: "Black or African American; Native Hawaiian and Other Pacific Islander",
  P8_019N: "Black or African American; Some Other Race",
  P8_020N: "American Indian and Alaska Native; Asian",
  P8_021N: "American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
  P8_022N: "American Indian and Alaska Native; Some Other Race",
  P8_023N: "Asian; Native Hawaiian and Other Pacific Islander",
  P8_024N: "Asian; Some Other Race",
  P8_025N: "Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_026N: "Population of three races",
  P8_027N: "White; Black or African American; American Indian and Alaska Native",
  P8_028N: "White; Black or African American; Asian",
  P8_029N: "White; Black or African American; Native Hawaiian and Other Pacific Islander",
  P8_030N: "White; Black or African American; Some Other Race",
  P8_031N: "White; American Indian and Alaska Native; Asian",
  P8_032N: "White; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
  P8_033N: "White; American Indian and Alaska Native; Some Other Race",
  P8_034N: "White; Asian; Native Hawaiian and Other Pacific Islander",
  P8_035N: "White; Asian; Some Other Race",
  P8_036N: "White; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_037N: "Black or African American; American Indian and Alaska Native; Asian",
  P8_038N: "Black or African American; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
  P8_039N: "Black or African American; American Indian and Alaska Native; Some Other Race",
  P8_040N: "Black or African American; Asian; Native Hawaiian and Other Pacific Islander",
  P8_041N: "Black or African American; Asian; Some Other Race",
  P8_042N: "Black or African American; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_043N: "American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander",
  P8_044N: "American Indian and Alaska Native; Asian; Some Other Race",
  P8_045N: "American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_046N: "Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_047N: "Population of four races",
  P8_048N: "White; Black or African American; American Indian and Alaska Native; Asian",
  P8_049N: "White; Black or African American; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander",
  P8_050N: "White; Black or African American; American Indian and Alaska Native; Some Other Race",
  P8_051N: "White; Black or African American; Asian; Native Hawaiian and Other Pacific Islander",
  P8_052N: "White; Black or African American; Asian; Some Other Race",
  P8_053N: "White; Black or African American; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_054N: "White; American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander",
  P8_055N: "White; American Indian and Alaska Native; Asian; Some Other Race",
  P8_056N: "White; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_057N: "White; Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_058N: "Black or African American; American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander",
  P8_059N: "Black or African American; American Indian and Alaska Native; Asian; Some Other Race",
  P8_060N: "Black or African American; American Indian and Alaska Native; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_061N: "Black or African American; Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_062N: "American Indian and Alaska Native; Asian; Native Hawaiian and Other Pacific Islander; Some Other Race",
  P8_063N: "Population of five or six races",
};

const p8Codes = Object.keys(p8Labels);
const chunkA = p8Codes.slice(0, 31);
const chunkB = p8Codes.slice(31);

const ALLOWED_ZIPS = Object.keys(ROCKLAND_ZIPS_TOWNS);

function toNumber(val: string | null | undefined) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseZips(zipsParam: string | null): string[] {
  if (!zipsParam) return ALLOWED_ZIPS;
  const list = zipsParam
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);
  if (list.length === 0) return ALLOWED_ZIPS;
  for (const z of list) {
    if (!ROCKLAND_ZIPS_TOWNS[z]) {
      throw new Response(JSON.stringify({ error: `ZIP ${z} is not allowed` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  return list;
}

function corsHeaders(env: Env, request?: Request): HeadersInit {
  const raw = (env.ALLOWED_ORIGIN || "").trim();
  const allowed = raw ? raw.split(",").map((o) => o.trim()).filter(Boolean) : [];
  const requestOrigin = request?.headers.get("Origin")?.trim() || null;
  let origin: string;
  if (requestOrigin && allowed.length > 0 && allowed.includes(requestOrigin)) {
    origin = requestOrigin;
  } else if (allowed.length > 0) {
    origin = allowed[0];
  } else if (requestOrigin) {
    origin = requestOrigin;
  } else {
    origin = "*";
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function cors(response: Response, env: Env, request?: Request) {
  const headers = new Headers(response.headers);
  const extra = corsHeaders(env, request);
  Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

function json(data: any, env: Env, status = 200, request?: Request) {
  return cors(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
    env,
    request,
  );
}

async function fetchIncome(zip: string, env: Env) {
  const params = new URLSearchParams({
    get: "NAME,B01001_001E," + Object.keys(incomeVars).join(","),
    for: `zip code tabulation area:${zip}`,
    key: env.CENSUS_API_KEY,
  });
  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`ACS income error ${zip}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as string[][];
  if (data.length <= 1) return null;
  const row = data[1];
  const headers = data[0];
  const rec: RecordMap = {};
  headers.forEach((h, idx) => (rec[h] = row[idx]));
  const out: RecordMap = {
    ZipCode: rec["zip code tabulation area"],
    TownName: ROCKLAND_ZIPS_TOWNS[rec["zip code tabulation area"]],
    ZCTA_Name: rec["NAME"],
    TotalPopulation: toNumber(rec["B01001_001E"]),
  };
  Object.entries(incomeVars).forEach(([code, label]) => {
    out[label] = toNumber(rec[code]);
  });
  return out;
}

async function fetchOccupation(zip: string, env: Env) {
  const params = new URLSearchParams({
    get: "NAME," + Object.keys(occupationVars).join(","),
    for: `zip code tabulation area:${zip}`,
    key: env.CENSUS_API_KEY,
  });
  const res = await fetch(`${BASE_URL_SUBJECT}?${params.toString()}`);
  if (!res.ok) throw new Error(`ACS occupation error ${zip}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as string[][];
  if (data.length <= 1) return null;
  const row = data[1];
  const headers = data[0];
  const rec: RecordMap = {};
  headers.forEach((h, idx) => (rec[h] = row[idx]));
  const out: RecordMap = {
    ZipCode: rec["zip code tabulation area"],
    TownName: ROCKLAND_ZIPS_TOWNS[rec["zip code tabulation area"]],
    ZCTA_Name: rec["NAME"],
  };
  Object.entries(occupationVars).forEach(([code, label]) => {
    out[label] = toNumber(rec[code]);
  });
  return out;
}

async function fetchP8Chunk(zipCodes: string[], chunk: string[], env: Env) {
  const params = new URLSearchParams({
    get: ["NAME", ...chunk].join(","),
    for: `zip code tabulation area:${zipCodes.join(",")}`,
    key: env.CENSUS_API_KEY,
  });
  const res = await fetch(`${BASE_URL_2020_DHC}?${params.toString()}`);
  if (!res.ok) throw new Error(`P8 chunk error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as string[][];
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map((row) => {
    const rec: RecordMap = {};
    headers.forEach((h, idx) => (rec[h] = row[idx]));
    return rec;
  });
}

async function fetchRace(zipCodes: string[], env: Env) {
  const a = await fetchP8Chunk(zipCodes, chunkA, env);
  const b = await fetchP8Chunk(zipCodes, chunkB, env);
  const byZip: Record<string, RecordMap> = {};

  const upsert = (rec: RecordMap) => {
    const zip = rec["zip code tabulation area"];
    if (!byZip[zip]) byZip[zip] = { ZipCode: zip, TownName: ROCKLAND_ZIPS_TOWNS[zip], NAME: rec["NAME"] };
    Object.assign(byZip[zip], rec);
  };
  a.forEach(upsert);
  b.forEach(upsert);

  return Object.values(byZip).map((rec) => {
    const out: RecordMap = {
      ZipCode: rec["zip code tabulation area"],
      TownName: ROCKLAND_ZIPS_TOWNS[rec["zip code tabulation area"]],
      ZCTA_Name: rec["NAME"],
    };
    Object.entries(p8Labels).forEach(([code, label]) => {
      out[label] = toNumber(rec[code]);
    });
    return out;
  });
}

async function buildFinalDataset(zipCodes: string[], env: Env) {
  const [incomeList, occList, raceList] = await Promise.all([
    Promise.all(zipCodes.map((z) => fetchIncome(z, env))),
    Promise.all(zipCodes.map((z) => fetchOccupation(z, env))),
    fetchRace(zipCodes, env),
  ]);

  const map: Record<string, RecordMap> = {};
  const ensure = (zip: string) => {
    if (!map[zip]) {
      map[zip] = {
        ZipCode: zip,
        TownName: ROCKLAND_ZIPS_TOWNS[zip],
      };
    }
    return map[zip];
  };

  for (const rec of incomeList) {
    if (!rec) continue;
    Object.assign(ensure(rec.ZipCode), rec);
  }
  for (const rec of occList) {
    if (!rec) continue;
    Object.assign(ensure(rec.ZipCode), rec);
  }
  for (const rec of raceList) {
    if (!rec) continue;
    Object.assign(ensure(rec.ZipCode), rec);
  }

  return zipCodes.map((z) => map[z] || { ZipCode: z, TownName: ROCKLAND_ZIPS_TOWNS[z] });
}

function arrayToCsv(rows: RecordMap[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    const s = val === null || val === undefined ? "" : String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function buildPrompt(rows: RecordMap[], userPrompt?: string) {
  const csv = arrayToCsv(rows);
  let userSection = "";
  if (userPrompt) {
    let trimmed = userPrompt.trim();
    if (trimmed.length > 1000) trimmed = trimmed.slice(0, 1000);
    userSection = `\n\nUser request:\n${trimmed}\n\nIncorporate the user's request above while staying data-grounded.`;
  }
  return (
    "You are an analytical assistant. Below is a merged dataset that combines:\n" +
    "- Income data (from 2021 ACS, B19001/B19013)\n" +
    "- Occupational data (from 2021 ACS Subject Table S2401)\n" +
    "- Race data (from 2020 Decennial Census DHC Table P8, including 63 race categories)\n\n" +
    `Here is the data in CSV format:\n\n${csv}\n` +
    userSection +
    "Please provide a comprehensive semantic analysis exploring the relationship between income distribution, occupational profile, and racial composition in these Rockland County ZIP codes."
  );
}

async function callOpenAI(prompt: string, temperature: number, env: Env) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: temperature ?? DEFAULT_TEMPERATURE,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI error: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), env, request);
    }

    if (path === "/api/health") {
      const openai = !!env.OPENAI_API_KEY;
      const census = !!env.CENSUS_API_KEY;
      return json(
        { status: "ok", openai_key: openai, census_key: census, allowed_origin: env.ALLOWED_ORIGIN || "*" },
        env,
        200,
        request,
      );
    }

    if (path === "/api/zip-data" && request.method === "GET") {
      let zips: string[];
      try {
        zips = parseZips(url.searchParams.get("zips"));
      } catch (err: any) {
        if (err instanceof Response) return cors(err, env, request);
        return json({ error: err?.message || "Invalid zips" }, env, 400, request);
      }
      try {
        const data = await buildFinalDataset(zips, env);
        return json({ zips, data }, env, 200, request);
      } catch (err: any) {
        return json({ error: err?.message || "Failed to fetch data" }, env, 500, request);
      }
    }

    if (path === "/api/ai-report" && request.method === "POST") {
      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, env, 400, request);
      }
      let zips: string[];
      try {
        zips = parseZips(Array.isArray(body.zips) ? body.zips.join(",") : body.zips || null);
      } catch (err: any) {
        if (err instanceof Response) return cors(err, env, request);
        return json({ error: err?.message || "Invalid zips" }, env, 400, request);
      }
      const temperature = typeof body.temperature === "number" ? body.temperature : DEFAULT_TEMPERATURE;
      const userPrompt = typeof body.user_prompt === "string" ? body.user_prompt : undefined;

      try {
        const data = await buildFinalDataset(zips, env);
        const prompt = buildPrompt(data, userPrompt);
        const ai_summary = await callOpenAI(prompt, temperature, env);
        return json({ zips, data, ai_summary }, env, 200, request);
      } catch (err: any) {
        return json({ error: err?.message || "Failed to generate AI report" }, env, 500, request);
      }
    }

    return cors(new Response("Not found", { status: 404 }), env, request);
  },
};
