export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function fetchZipData(zips) {
  const list = zips && zips.length > 0 ? zips : [];
  const qs = encodeURIComponent(list.join(","));
  const prefix = API_BASE ? API_BASE : "";
  const url = `${prefix}/api/zip-data${qs ? `?zips=${qs}` : ""}`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function fetchAiReport(zips, userPrompt) {
  const prefix = API_BASE ? API_BASE : "";
  const res = await fetch(`${prefix}/api/ai-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zips, user_prompt: userPrompt }),
  });
  return handleResponse(res);
}
