const ENV_API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const WORKER_API_BASE = "https://rocklandcensus.mderasmo56.workers.dev";
function getApiBase() {
  if (ENV_API_BASE) return ENV_API_BASE;
  // On Pages, use same-origin (Pages Functions handle /api/* automatically)
  // Only use Worker URL if explicitly set via env var
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    // For localhost, return empty (uses proxy to local backend)
    if (o.includes("localhost")) return "";
    // For Pages, use same-origin (Pages Functions)
    if (o.includes("pages.dev") || o.includes("rocklandcensusinsights.com")) return "";
  }
  return "";
}
export const API_BASE = ENV_API_BASE;
export { getApiBase };

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const j = JSON.parse(text);
      if (j && typeof j.detail === "string") message = j.detail;
      else if (j && Array.isArray(j.detail)) message = j.detail.join("; ");
    } catch (_) {}
    throw new Error(message);
  }
  return res.json();
}

export async function fetchZipData(zips) {
  const list = zips && zips.length > 0 ? zips : [];
  const qs = encodeURIComponent(list.join(","));
  const prefix = getApiBase();
  const url = `${prefix}/api/zip-data${qs ? `?zips=${qs}` : ""}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await handleResponse(res);
    clearTimeout(timeoutId);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    const enhanced = new Error(err?.message || "Failed to fetch");
    enhanced.name = err?.name || "NetworkError";
    enhanced.cause = err;
    enhanced.url = url;
    throw enhanced;
  }
}

export async function fetchAiReport(zips, userPrompt) {
  const prefix = getApiBase();
  const url = `${prefix}/api/ai-report`;
  console.log(`[API] fetchAiReport - getApiBase()="${prefix}", origin="${typeof window !== "undefined" ? window.location.origin : "N/A"}", final URL="${url}"`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zips, user_prompt: userPrompt }),
      signal: controller.signal,
    });
    const corsHeader = res.headers.get("Access-Control-Allow-Origin");
    console.log(`[API] POST ${url} - Status: ${res.status}, CORS: ${corsHeader || "MISSING"}`);
    if (!res.ok) {
      const text = await res.text();
      console.error(`[API] Error response: ${text.substring(0, 200)}`);
    }
    const data = await handleResponse(res);
    clearTimeout(timeoutId);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[API] Fetch error for ${url}:`, err);
    const enhanced = new Error(err?.message || "Failed to fetch");
    enhanced.name = err?.name || "NetworkError";
    enhanced.cause = err;
    enhanced.url = url;
    throw enhanced;
  }
}

export async function checkWorkerHealth() {
  const base = getApiBase() || "https://rocklandcensus.mderasmo56.workers.dev";
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    const corsHeader = res.headers.get("Access-Control-Allow-Origin");
    console.log(`[API] Health check - Status: ${res.status}, CORS: ${corsHeader || "MISSING"}`);
    if (res.ok) {
      const data = await res.json();
      return { ok: true, data };
    }
    const text = await res.text();
    console.error(`[API] Health check failed: ${res.status} ${res.statusText} - ${text.substring(0, 100)}`);
    return { ok: false, status: res.status, statusText: res.statusText, body: text };
  } catch (err) {
    console.error(`[API] Health check error:`, err);
    return { ok: false, error: err?.message || "Failed to reach Worker" };
  }
}
