const ENV_API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const WORKER_API_BASE = "https://rocklandcensus.mderasmo56.workers.dev";
function getApiBase() {
  if (ENV_API_BASE) return ENV_API_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    if (o.includes("pages.dev") || o.includes("rocklandcensusinsights.com")) return WORKER_API_BASE;
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
    throw err;
  }
}

export async function fetchAiReport(zips, userPrompt) {
  const prefix = getApiBase();
  const url = `${prefix}/api/ai-report`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zips, user_prompt: userPrompt }),
      signal: controller.signal,
    });
    const data = await handleResponse(res);
    clearTimeout(timeoutId);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
