import { useMemo, useState } from "react";
import { API_BASE, fetchAiReport, fetchZipData } from "./api";

const ROCKLAND_ZIPS = {
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

const PREVIEW_COLUMNS = [
  "ZipCode",
  "TownName",
  "TotalPopulation",
  "MedianIncome",
  "CivEmp16Over",
  "MgmtBusSciArts",
  "ProdTransMoving",
  "Total",
];

function App() {
  const [selected, setSelected] = useState(new Set(Object.keys(ROCKLAND_ZIPS)));
  const [rows, setRows] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const zipOptions = useMemo(
    () =>
      Object.entries(ROCKLAND_ZIPS).map(([zip, town]) => ({
        zip,
        label: `${zip} — ${town}`,
      })),
    []
  );

  const toggleZip = (zip) => {
    const next = new Set(selected);
    if (next.has(zip)) {
      next.delete(zip);
    } else {
      next.add(zip);
    }
    setSelected(next);
  };

  const handleSelectAll = () => {
    setSelected(new Set(Object.keys(ROCKLAND_ZIPS)));
  };

  const handleClear = () => {
    setSelected(new Set());
  };

  const handleFetch = async () => {
    setError("");
    setLoading(true);
    setAiSummary("");
    try {
      const zips = Array.from(selected);
      const res = await fetchZipData(zips);
      setRows(res.data || []);
    } catch (err) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleAi = async () => {
    setError("");
    setAiLoading(true);
    try {
      if (userPrompt && userPrompt.length > 1000) {
        setError("Custom prompt too long (max 1000 characters).");
        setAiLoading(false);
        return;
      }
      const zips = Array.from(selected);
      const res = await fetchAiReport(zips, userPrompt.trim());
      setRows(res.data || []);
      setAiSummary(res.ai_summary || "");
    } catch (err) {
      setError(err.message || "Failed to generate AI report");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <h1>Rockland Census Explorer</h1>
      <p className="status">
        Backend: <strong>{API_BASE}</strong> | Selected ZIPs:{" "}
        {selected.size} / {zipOptions.length}
      </p>

      <div className="card section">
        <div className="flex" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>ZIP codes</h2>
          <div className="flex">
            <button onClick={handleSelectAll}>Select all</button>
            <button className="secondary" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
        <div className="zip-list section">
          {zipOptions.map(({ zip, label }) => (
            <label key={zip} className="chip">
              <input
                type="checkbox"
                checked={selected.has(zip)}
                onChange={() => toggleZip(zip)}
              />{" "}
              {label}
            </label>
          ))}
        </div>

        <div className="section">
          <h3 style={{ marginBottom: "0.35rem" }}>Custom prompt (optional)</h3>
          <textarea
            className="textarea"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Ask anything: highlight specific ZIPs, compare towns, focus on occupations, etc."
          />
        </div>

        <div className="section flex">
          <button onClick={handleFetch} disabled={loading}>
            {loading ? "Loading data..." : "Fetch data"}
          </button>
          <button onClick={handleAi} disabled={aiLoading}>
            {aiLoading ? "Thinking..." : "AI narrative"}
          </button>
          {error && <span className="error">{error}</span>}
        </div>
      </div>

      <div className="grid section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Data preview</h3>
          {rows.length === 0 ? (
            <p className="status">No data yet. Fetch to see results.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  {PREVIEW_COLUMNS.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={`${row.ZipCode}-${idx}`}>
                    {PREVIEW_COLUMNS.map((col) => (
                      <td key={col}>{row[col] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>AI narrative</h3>
          <textarea
            className="textarea"
            value={aiSummary}
            readOnly
            placeholder="Generate the AI narrative to see insights."
          />
        </div>
      </div>
    </div>
  );
}

export default App;
